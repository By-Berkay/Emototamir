"""Iteration 4 public API regression for notes, reminders, quotes, audit diffs, and rebrand PDF."""
import copy
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import fitz
import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
BASE_URL = (frontend_env.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
CREDS_PATH = Path("/app/memory/test_credentials.md")


def credential_for(section):
    if not CREDS_PATH.exists():
        pytest.skip("Missing /app/memory/test_credentials.md")
    text = CREDS_PATH.read_text(encoding="utf-8")
    match = re.search(rf"(?ims)^##\s+{re.escape(section)}.*?(?=^##\s+|\Z)", text)
    if not match:
        pytest.skip(f"Missing credential section: {section}")
    block = match.group(0)
    email = re.search(r"(?im)^- Email:\s*`?([^`\s]+)", block)
    password = re.search(r"(?im)^- Password:\s*`?([^`\s]+)", block)
    if not email or not password:
        pytest.skip(f"Unusable credentials in section: {section}")
    return email.group(1), password.group(1)


def login(email, password):
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30
    )
    if response.status_code == 200 and response.json().get("token"):
        session.headers.update({"Authorization": f"Bearer {response.json()['token']}"})
    return session, response


def tenant_payload(detail):
    return {k: copy.deepcopy(v) for k, v in detail.items() if k not in {"id", "created_at", "users", "stats", "users_count", "orders_count"}}


@pytest.fixture(scope="module")
def state():
    tenant_email, tenant_password = credential_for("Demo Firma")
    super_email, super_password = credential_for("Super Admin")
    tenant, tenant_login = login(tenant_email, tenant_password)
    super_session, super_login = login(super_email, super_password)
    if tenant_login.status_code != 200:
        pytest.fail(f"Tenant login failed: {tenant_login.status_code} {tenant_login.text[:500]}")
    if super_login.status_code != 200:
        pytest.fail(f"Super login failed: {super_login.status_code} {super_login.text[:500]}")
    data = {
        "tenant": tenant,
        "tenant_login": tenant_login,
        "tenant_email": tenant_email,
        "super": super_session,
        "super_login": super_login,
        "demo_tid": tenant_login.json()["user"]["tenant_id"],
        "created": {},
    }
    yield data

    mongo = MongoClient(backend_env["MONGO_URL"])
    db = mongo[backend_env["DB_NAME"]]
    ids = data["created"]
    for quote_id in ids.get("quote_ids", []):
        db.audit_logs.delete_many({"entity_id": quote_id})
        db.quotes.delete_many({"id": quote_id})
    for order_id in ids.get("order_ids", []):
        db.transactions.delete_many({"service_order_id": order_id})
        db.payments.delete_many({"service_order_id": order_id})
        db.audit_logs.delete_many({"entity_id": order_id})
        db.service_orders.delete_many({"id": order_id})
    for customer_id in ids.get("customer_ids", []):
        db.transactions.delete_many({"customer_id": customer_id})
        db.audit_logs.delete_many({"entity_id": customer_id})
        db.customers.delete_many({"id": customer_id})
    for motorcycle_id in ids.get("motorcycle_ids", []):
        db.motorcycles.delete_many({"id": motorcycle_id})
    for user_id in ids.get("user_ids", []):
        user = db.users.find_one({"id": user_id})
        if user:
            db.login_attempts.delete_many({"identifier": f"login:{user['email']}"})
        db.users.delete_many({"id": user_id})
    # Required handoff state: restore demo policy and prevent an expired date from blocking login.
    restore = {"reminder_km": 5000, "reminder_months": 6, "reminder_mode": "or", "is_active": True}
    tenant_doc = db.tenants.find_one({"id": data["demo_tid"]}) or {}
    now = datetime.now(timezone.utc)
    for field in ("trial_ends_at", "subscription_ends_at"):
        value = tenant_doc.get(field)
        if value:
            try:
                if datetime.fromisoformat(value.replace("Z", "+00:00")) < now:
                    restore[field] = None
            except Exception:
                pass
    db.tenants.update_one({"id": data["demo_tid"]}, {"$set": restore})
    mongo.close()


# Auth baseline and documented roles.
def test_01_auth_roles_and_secure_cookie(state):
    assert state["tenant_login"].json()["user"]["role"] == "admin"
    assert state["super_login"].json()["user"]["role"] == "super_admin"
    for response in (state["tenant_login"], state["super_login"]):
        cookie = response.headers.get("Set-Cookie", "").lower()
        assert "access_token=" in cookie and "httponly" in cookie and "secure" in cookie


# Isolated customer/motorcycle records used by notes, reminders, and quotes.
def test_02_create_customer_and_motorcycle(state):
    suffix = uuid.uuid4().hex[:8]
    customer = state["tenant"].post(
        f"{BASE_URL}/api/customers",
        json={"first_name": "TEST_I4", "last_name": "Customer", "phone": "05321110022", "email": f"test.i4.{suffix}@example.test"},
        timeout=30,
    )
    assert customer.status_code == 200, customer.text
    c = customer.json()
    motorcycle = state["tenant"].post(
        f"{BASE_URL}/api/motorcycles",
        json={"customer_id": c["id"], "brand": "TEST_I4", "model": "Quote Bike", "plate": f"34I4{suffix[:4]}", "km": 12345},
        timeout=30,
    )
    assert motorcycle.status_code == 200, motorcycle.text
    m = motorcycle.json()
    state["created"].setdefault("customer_ids", []).append(c["id"])
    state["created"].setdefault("motorcycle_ids", []).append(m["id"])
    state["customer"] = c
    state["motorcycle"] = m
    detail = state["tenant"].get(f"{BASE_URL}/api/customers/{c['id']}", timeout=30)
    assert detail.status_code == 200 and detail.json().get("note_entries", []) == []


# Customer note create/read/update/delete persistence and metadata.
def test_03_customer_notes_crud(state):
    cid = state["customer"]["id"]
    created = state["tenant"].post(f"{BASE_URL}/api/customers/{cid}/notes", json={"text": "TEST_I4 first note"}, timeout=30)
    assert created.status_code == 200, created.text
    note = created.json()
    assert note["author"] == state["tenant_email"] and note["text"] == "TEST_I4 first note"
    assert note["at"] and note["updated_at"] is None
    fetched = state["tenant"].get(f"{BASE_URL}/api/customers/{cid}", timeout=30).json()
    assert any(n["id"] == note["id"] and n["author"] == state["tenant_email"] for n in fetched["note_entries"])

    updated = state["tenant"].put(f"{BASE_URL}/api/customers/{cid}/notes/{note['id']}", json={"text": "TEST_I4 edited note"}, timeout=30)
    assert updated.status_code == 200, updated.text
    assert updated.json()["text"] == "TEST_I4 edited note" and updated.json()["updated_at"]
    persisted = state["tenant"].get(f"{BASE_URL}/api/customers/{cid}", timeout=30).json()
    assert next(n for n in persisted["note_entries"] if n["id"] == note["id"])["text"] == "TEST_I4 edited note"

    deleted = state["tenant"].delete(f"{BASE_URL}/api/customers/{cid}/notes/{note['id']}", timeout=30)
    assert deleted.status_code == 200 and deleted.json() == {"ok": True}
    persisted = state["tenant"].get(f"{BASE_URL}/api/customers/{cid}", timeout=30).json()
    assert all(n["id"] != note["id"] for n in persisted["note_entries"])


# Only note author or admin may edit/delete a note.
def test_04_customer_note_authorization(state):
    suffix = uuid.uuid4().hex[:7]
    sessions = []
    for index in (1, 2):
        email = f"test.i4.note{index}.{suffix}@example.com"
        made = state["tenant"].post(
            f"{BASE_URL}/api/users",
            json={"email": email, "password": "TEST-i4-pass", "name": f"TEST I4 Note {index}", "role": "technician"},
            timeout=30,
        )
        assert made.status_code == 200, made.text
        state["created"].setdefault("user_ids", []).append(made.json()["id"])
        session, response = login(email, "TEST-i4-pass")
        assert response.status_code == 200, response.text
        sessions.append(session)
    cid = state["customer"]["id"]
    made_note = sessions[0].post(f"{BASE_URL}/api/customers/{cid}/notes", json={"text": "TEST_I4 owned by tech one"}, timeout=30)
    assert made_note.status_code == 200, made_note.text
    nid = made_note.json()["id"]
    forbidden_edit = sessions[1].put(f"{BASE_URL}/api/customers/{cid}/notes/{nid}", json={"text": "hijack"}, timeout=30)
    forbidden_delete = sessions[1].delete(f"{BASE_URL}/api/customers/{cid}/notes/{nid}", timeout=30)
    assert forbidden_edit.status_code == 403 and "yetkiniz" in forbidden_edit.json()["detail"].lower()
    assert forbidden_delete.status_code == 403 and "yetkiniz" in forbidden_delete.json()["detail"].lower()
    admin_delete = state["tenant"].delete(f"{BASE_URL}/api/customers/{cid}/notes/{nid}", timeout=30)
    assert admin_delete.status_code == 200


# Reminder response contract and WhatsApp URL generation.
def test_05_reminders_and_whatsapp_batch(state):
    response = state["tenant"].get(f"{BASE_URL}/api/reminders", timeout=60)
    assert response.status_code == 200, response.text
    data = response.json()
    assert set(data) == {"due", "overdue", "upcoming", "policy"}
    assert all(isinstance(data[key], list) for key in ("due", "overdue", "upcoming"))
    assert data["policy"] == {"reminder_km": 5000, "reminder_months": 6, "reminder_mode": "or"}
    batch = state["tenant"].post(
        f"{BASE_URL}/api/reminders/whatsapp-batch",
        json={"motorcycle_ids": [state["motorcycle"]["id"]], "template": "Merhaba {{name}} {{plate}} {{brand_model}} {{km}}"},
        timeout=30,
    )
    assert batch.status_code == 200, batch.text
    body = batch.json()
    assert body["skipped_no_phone"] == 0 and len(body["links"]) == 1
    link = body["links"][0]
    assert link["motorcycle_id"] == state["motorcycle"]["id"]
    assert link["url"].startswith("https://wa.me/905321110022?text=")
    assert state["motorcycle"]["plate"] in link["message"] and "TEST_I4 Quote Bike" in link["message"]


# Reminder CSV should be a downloadable UTF-8 CSV with the documented header.
def test_06_reminder_csv(state):
    response = state["tenant"].get(f"{BASE_URL}/api/reminders/export.csv", params={"scope": "due"}, timeout=60)
    assert response.status_code == 200
    assert response.headers["Content-Type"].startswith("text/csv")
    assert "attachment" in response.headers.get("Content-Disposition", "").lower()
    assert response.content.startswith(b"\xef\xbb\xbf")
    assert "Motosiklet,Plaka,Müşteri" in response.content.decode("utf-8-sig")


# Super-admin policy update must be reflected in tenant reminder results, then restored.
def test_07_tenant_reminder_policy_update_and_restore(state):
    tid = state["demo_tid"]
    detail = state["super"].get(f"{BASE_URL}/api/admin/tenants/{tid}", timeout=30)
    assert detail.status_code == 200, detail.text
    payload = tenant_payload(detail.json())
    payload.update({"reminder_km": 3000, "reminder_months": 3, "reminder_mode": "and"})
    changed = state["super"].put(f"{BASE_URL}/api/admin/tenants/{tid}", json=payload, timeout=30)
    assert changed.status_code == 200, changed.text
    assert changed.json()["reminder_km"] == 3000 and changed.json()["reminder_months"] == 3 and changed.json()["reminder_mode"] == "and"
    reminder = state["tenant"].get(f"{BASE_URL}/api/reminders", timeout=60)
    assert reminder.status_code == 200 and reminder.json()["policy"] == {"reminder_km": 3000, "reminder_months": 3, "reminder_mode": "and"}
    payload.update({"reminder_km": 5000, "reminder_months": 6, "reminder_mode": "or"})
    restored = state["super"].put(f"{BASE_URL}/api/admin/tenants/{tid}", json=payload, timeout=30)
    assert restored.status_code == 200 and restored.json()["reminder_mode"] == "or"


# Quote create/read/update/send and exact monetary totals.
def test_08_quotes_crud_send_and_audit_diff(state):
    payload = {
        "customer_id": state["customer"]["id"],
        "motorcycle_id": state["motorcycle"]["id"],
        "items": [
            {"kind": "part", "name": "TEST_I4 Part", "qty": 2, "unit_price": 100, "vat": 20},
            {"kind": "service", "name": "TEST_I4 Service", "qty": 1, "unit_price": 50, "vat": 10},
        ],
        "labor_total": 30,
        "discount": 5,
        "notes": "TEST_I4 quote draft",
        "valid_until": "2030-01-01T23:59:59+00:00",
    }
    created = state["tenant"].post(f"{BASE_URL}/api/quotes", json=payload, timeout=30)
    assert created.status_code == 200, created.text
    quote = created.json()
    state["created"].setdefault("quote_ids", []).append(quote["id"])
    state["quote"] = quote
    assert quote["status"] == "draft" and quote["quote_no"].startswith("TKF-") and len(quote["share_token"]) == 32
    # Birim fiyatlar KDV dahil: genel toplam = kalemler + işçilik - iskonto; KDV brüt tutardan ayrıştırılır
    assert quote["subtotal"] == 250 and abs(quote["vat_total"] - 37.88) < 0.01 and quote["labor_total"] == 30
    assert quote["discount"] == 5 and quote["grand_total"] == 275
    fetched = state["tenant"].get(f"{BASE_URL}/api/quotes/{quote['id']}", timeout=30)
    assert fetched.status_code == 200 and fetched.json()["notes"] == payload["notes"]
    payload.update({"notes": "TEST_I4 quote updated", "labor_total": 40})
    updated = state["tenant"].put(f"{BASE_URL}/api/quotes/{quote['id']}", json=payload, timeout=30)
    assert updated.status_code == 200, updated.text
    assert updated.json()["notes"] == "TEST_I4 quote updated" and updated.json()["grand_total"] == 285
    sent = state["tenant"].post(f"{BASE_URL}/api/quotes/{quote['id']}/send", timeout=30)
    assert sent.status_code == 200 and sent.json()["status"] == "sent" and sent.json()["sent_at"]

    audit = state["super"].get(f"{BASE_URL}/api/admin/audit-logs", params={"action": "quote.update", "limit": 500}, timeout=30)
    assert audit.status_code == 200, audit.text
    row = next(r for r in audit.json() if r.get("entity_id") == quote["id"])
    fields = {change["field"] for change in row["changes"]}
    assert {"notes", "labor_total", "grand_total"}.issubset(fields)


# Public share payload, approval, immutable second decision, and approved status reload.
def test_09_public_quote_approval(state):
    quote = state["quote"]
    public = requests.get(f"{BASE_URL}/api/public/quotes/{quote['share_token']}", timeout=30)
    assert public.status_code == 200, public.text
    body = public.json()
    assert body["status"] == "sent" and body["customer"]["first_name"] == "TEST_I4"
    assert body["motorcycle"]["plate"] == state["motorcycle"]["plate"]
    assert body["tenant"]["name"] and body["tenant"]["primary_color"]
    assert len(body["items"]) == 2 and body["grand_total"] == 330
    approved = requests.post(
        f"{BASE_URL}/api/public/quotes/{quote['share_token']}/approve",
        json={"action": "approve", "customer_name": "TEST I4 Approver", "note": "Approved in regression"},
        timeout=30,
    )
    assert approved.status_code == 200 and approved.json()["status"] == "approved"
    again = requests.post(
        f"{BASE_URL}/api/public/quotes/{quote['share_token']}/approve",
        json={"action": "reject", "customer_name": "Second User", "note": ""},
        timeout=30,
    )
    assert again.status_code == 400 and "zaten" in again.json()["detail"]
    reloaded = requests.get(f"{BASE_URL}/api/public/quotes/{quote['share_token']}", timeout=30)
    assert reloaded.status_code == 200 and reloaded.json()["status"] == "approved"
    assert reloaded.json()["approval"]["name"] == "TEST I4 Approver"


# Approved quote conversion persists status and source_quote_id on the new order.
def test_10_quote_convert_to_service_order(state):
    quote = state["quote"]
    converted = state["tenant"].post(f"{BASE_URL}/api/quotes/{quote['id']}/convert", timeout=30)
    assert converted.status_code == 200, converted.text
    body = converted.json()
    state["created"].setdefault("order_ids", []).append(body["service_order_id"])
    order = state["tenant"].get(f"{BASE_URL}/api/service-orders/{body['service_order_id']}", timeout=30)
    assert order.status_code == 200, order.text
    order_data = order.json()
    assert order_data["source_quote_id"] == quote["id"]
    assert order_data["customer_id"] == state["customer"]["id"] and order_data["motorcycle_id"] == state["motorcycle"]["id"]
    assert [i["name"] for i in order_data["items"]] == ["TEST_I4 Part", "TEST_I4 Service"]
    assert order_data["labor_total"] == 40 and order_data["discount"] == 5
    persisted_quote = state["tenant"].get(f"{BASE_URL}/api/quotes/{quote['id']}", timeout=30)
    assert persisted_quote.status_code == 200 and persisted_quote.json()["status"] == "converted"
    assert persisted_quote.json()["converted_service_order_id"] == body["service_order_id"]
    second = state["tenant"].post(f"{BASE_URL}/api/quotes/{quote['id']}/convert", timeout=30)
    assert second.status_code == 400


# Quote validation must reject impossible negative pricing and empty items.
def test_11_quote_input_validation(state):
    base = {"customer_id": state["customer"]["id"], "motorcycle_id": state["motorcycle"]["id"], "labor_total": 0, "discount": 0, "notes": "TEST_I4 invalid"}
    empty = state["tenant"].post(f"{BASE_URL}/api/quotes", json={**base, "items": []}, timeout=30)
    negative = state["tenant"].post(
        f"{BASE_URL}/api/quotes",
        json={**base, "items": [{"kind": "part", "name": "Bad", "qty": -2, "unit_price": -10, "vat": 20}], "discount": 100},
        timeout=30,
    )
    for response in (empty, negative):
        if response.status_code == 200 and response.json().get("id"):
            state["created"].setdefault("quote_ids", []).append(response.json()["id"])
    assert empty.status_code in (400, 422), f"Empty quote accepted: {empty.status_code} {empty.text}"
    assert negative.status_code in (400, 422), f"Negative quote accepted: {negative.status_code} {negative.text}"


# Audit filters remain literal-safe and malformed regex-style input is rejected as requested.
def test_12_audit_filters_and_malformed_regex(state):
    filtered = state["super"].get(
        f"{BASE_URL}/api/admin/audit-logs",
        params={"tenant_id": state["demo_tid"], "action": "tenant.update", "user_email": "berkayozturk27", "limit": 500},
        timeout=30,
    )
    assert filtered.status_code == 200, filtered.text
    rows = filtered.json()
    assert rows and all(r.get("tenant_id") == state["demo_tid"] and "tenant.update" in r["action"] and "berkayozturk27" in r["user"] for r in rows)
    malformed = state["super"].get(f"{BASE_URL}/api/admin/audit-logs", params={"action": "[", "limit": 20}, timeout=30)
    assert malformed.status_code == 400, f"Expected malformed regex rejection, got {malformed.status_code}: {malformed.text[:300]}"


# Generated service PDF contains the new E-Moto Tamir brand footer.
def test_13_pdf_rebrand_footer(state):
    order_id = state["created"]["order_ids"][0]
    pdf = state["tenant"].get(f"{BASE_URL}/api/service-orders/{order_id}/pdf/kabul", timeout=60)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
    document = fitz.open(stream=pdf.content, filetype="pdf")
    text = "\n".join(page.get_text() for page in document)
    document.close()
    assert "E-Moto Tamir · Servis Yönetim Sistemi" in text


# Public quote tokens cannot be guessed and public response contains no tenant internal ID.
def test_14_public_quote_not_found_and_data_minimization(state):
    missing = requests.get(f"{BASE_URL}/api/public/quotes/{uuid.uuid4().hex}", timeout=30)
    assert missing.status_code == 404 and "Teklif bulunamadı" in missing.json()["detail"]
    public = requests.get(f"{BASE_URL}/api/public/quotes/{state['quote']['share_token']}", timeout=30).json()
    assert "tenant_id" not in public and "created_by" not in public and "_id" not in public
