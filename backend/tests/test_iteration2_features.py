"""Iteration 2 public API regression tests for PDFs, media, approval, reminders, admin edits, and payments."""
import base64
import os
import re
import time
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")


def load_credentials():
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    email = re.search(r"(?im)^\s*[-*]\s*Email:\s*([^\s]+)", content)
    password = re.search(r"(?im)^\s*[-*]\s*Password:\s*([^\s]+)", content)
    if not email or not password:
        pytest.skip("No usable credentials in /app/memory/test_credentials.md")
    return email.group(1), password.group(1)


@pytest.fixture(scope="module")
def feature_state():
    """Create isolated API data and clean it from local Mongo after the module."""
    stamp = str(int(time.time() * 1000))
    email, password = load_credentials()
    admin = requests.Session()
    login = admin.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    if login.status_code != 200:
        pytest.fail(f"Admin authentication failed: {login.status_code} {login.text[:500]}")
    token = login.json().get("token")
    if not token:
        pytest.fail("Admin authentication response did not contain token")
    admin.headers.update({"Authorization": f"Bearer {token}"})

    customer_payload = {
        "first_name": f"TEST_I2_{stamp}", "last_name": "Customer", "phone": "05551112233",
        "email": f"test.i2.{stamp}@example.test", "city": "Ankara", "district": "Çankaya",
    }
    customer_response = admin.post(f"{BASE_URL}/api/customers", json=customer_payload, timeout=30)
    assert customer_response.status_code == 200, customer_response.text
    customer = customer_response.json()

    moto_payload = {
        "customer_id": customer["id"], "brand": "TEST_I2_Brand", "model": "Iteration 2",
        "year": 2026, "type": "Naked", "engine_cc": 500, "plate": f"06I2{stamp[-3:]}", "km": 2000,
    }
    moto_response = admin.post(f"{BASE_URL}/api/motorcycles", json=moto_payload, timeout=30)
    assert moto_response.status_code == 200, moto_response.text
    motorcycle = moto_response.json()

    order_payload = {
        "customer_id": customer["id"], "motorcycle_id": motorcycle["id"], "km": 2500,
        "fuel_level": "1/2", "accessories": ["Kask"], "fault_zones": ["Motor"],
        "complaint": "TEST_I2 Turkish chars: şğüçıö", "diagnosis": "TEST_I2 diagnosis",
        "operations": "TEST_I2 operation", "notes": "TEST_I2 notes",
        "items": [
            {"kind": "part", "name": "TEST_I2 Part", "qty": 2, "unit_price": 100, "vat": 20},
            {"kind": "service", "name": "TEST_I2 Service", "qty": 1, "unit_price": 200, "vat": 20},
        ],
        "labor_total": 50, "discount": 10, "status": "new",
    }
    order_response = admin.post(f"{BASE_URL}/api/service-orders", json=order_payload, timeout=30)
    assert order_response.status_code == 200, order_response.text
    order = order_response.json()

    nonadmin_email = f"test.i2.tech.{stamp}@example.com"
    user_response = admin.post(
        f"{BASE_URL}/api/users",
        json={"email": nonadmin_email, "password": "TEST-I2-pass", "name": "TEST I2 Tech", "role": "technician"},
        timeout=30,
    )
    assert user_response.status_code == 200, user_response.text
    nonadmin = requests.Session()
    nonadmin_login = nonadmin.post(
        f"{BASE_URL}/api/auth/login", json={"email": nonadmin_email, "password": "TEST-I2-pass"}, timeout=30
    )
    assert nonadmin_login.status_code == 200, nonadmin_login.text
    nonadmin.headers.update({"Authorization": f"Bearer {nonadmin_login.json()['token']}"})

    state = {
        "stamp": stamp, "admin": admin, "token": token, "customer": customer, "motorcycle": motorcycle,
        "order": order, "order_payload": order_payload, "nonadmin": nonadmin, "nonadmin_email": nonadmin_email,
        "created_order_ids": [order["id"]], "created_payment_ids": [],
    }
    yield state

    mongo = MongoClient(backend_env["MONGO_URL"])
    db = mongo[backend_env["DB_NAME"]]
    order_ids = state["created_order_ids"]
    payment_ids = state["created_payment_ids"]
    db.file_refs.delete_many({"service_order_id": {"$in": order_ids}})
    db.transactions.delete_many({"$or": [{"service_order_id": {"$in": order_ids}}, {"payment_id": {"$in": payment_ids}}, {"customer_id": customer["id"]}]})
    db.payments.delete_many({"$or": [{"id": {"$in": payment_ids}}, {"customer_id": customer["id"]}]})
    db.audit_logs.delete_many({"entity_id": {"$in": order_ids + payment_ids}})
    db.service_orders.delete_many({"id": {"$in": order_ids}})
    db.motorcycles.delete_one({"id": motorcycle["id"]})
    db.customers.delete_one({"id": customer["id"]})
    db.login_attempts.delete_many({"identifier": {"$in": [f"login:{nonadmin_email}"]}})
    db.users.delete_one({"email": nonadmin_email})
    mongo.close()


def create_order(state, suffix):
    payload = {**state["order_payload"], "complaint": f"TEST_I2 {suffix}"}
    response = state["admin"].post(f"{BASE_URL}/api/service-orders", json=payload, timeout=30)
    assert response.status_code == 200, response.text
    order = response.json()
    state["created_order_ids"].append(order["id"])
    return order


# PDF exports must be authenticated, valid, non-trivial PDF documents for both form types.
def test_01_pdf_kabul_and_teslim(feature_state):
    state = feature_state
    for kind in ("kabul", "teslim"):
        response = requests.get(
            f"{BASE_URL}/api/service-orders/{state['order']['id']}/pdf/{kind}",
            params={"auth": state["token"]}, timeout=60,
        )
        assert response.status_code == 200, response.text[:500]
        assert response.headers["Content-Type"].startswith("application/pdf")
        assert response.content.startswith(b"%PDF-")
        assert len(response.content) > 5_000, f"{kind} PDF was only {len(response.content)} bytes"
        assert f"-{kind}.pdf" in response.headers.get("Content-Disposition", "")


# Photo lifecycle: multipart upload, protected byte download, order persistence, and soft reference deletion.
def test_02_photo_upload_download_delete(feature_state):
    state = feature_state
    png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4WQAAAAASUVORK5CYII="
    )
    response = state["admin"].post(
        f"{BASE_URL}/api/service-orders/{state['order']['id']}/photos",
        files={"file": ("TEST_I2.png", png, "image/png")}, data={"caption": "TEST_I2 damage"}, timeout=120,
    )
    assert response.status_code == 200, response.text[:1000]
    photo = response.json()
    assert isinstance(photo["id"], str) and photo["id"]
    assert photo["caption"] == "TEST_I2 damage"
    assert photo["path"].endswith(".png")
    assert photo["content_type"] == "image/png"

    order = state["admin"].get(f"{BASE_URL}/api/service-orders/{state['order']['id']}", timeout=30).json()
    assert any(p["id"] == photo["id"] and p["caption"] == "TEST_I2 damage" for p in order["photos"])

    downloaded = requests.get(f"{BASE_URL}/api/files/{photo['path']}", params={"auth": state["token"]}, timeout=60)
    assert downloaded.status_code == 200, downloaded.text[:500]
    assert downloaded.headers["Content-Type"].startswith("image/png")
    assert downloaded.content == png

    deleted = state["admin"].delete(
        f"{BASE_URL}/api/service-orders/{state['order']['id']}/photos/{photo['id']}", timeout=30
    )
    assert deleted.status_code == 200 and deleted.json() == {"ok": True}
    order = state["admin"].get(f"{BASE_URL}/api/service-orders/{state['order']['id']}", timeout=30).json()
    assert all(p["id"] != photo["id"] for p in order.get("photos", []))
    unavailable = requests.get(f"{BASE_URL}/api/files/{photo['path']}", params={"auth": state["token"]}, timeout=30)
    assert unavailable.status_code == 404


# Digital signature saves a base64 data URL and timestamp on the service order.
def test_03_signature_persistence(feature_state):
    signature = "data:image/png;base64," + base64.b64encode(b"TEST_I2_SIGNATURE").decode()
    response = feature_state["admin"].post(
        f"{BASE_URL}/api/service-orders/{feature_state['order']['id']}/signature",
        json={"signature": signature}, timeout=30,
    )
    assert response.status_code == 200 and response.json() == {"ok": True}
    order = feature_state["admin"].get(
        f"{BASE_URL}/api/service-orders/{feature_state['order']['id']}", timeout=30
    ).json()
    assert order["customer_signature"] == signature
    assert isinstance(order["signed_at"], str) and "T" in order["signed_at"]


# WhatsApp link and unauthenticated public approval decision must persist approved state.
def test_04_whatsapp_public_approval_flow(feature_state):
    response = feature_state["admin"].post(
        f"{BASE_URL}/api/service-orders/{feature_state['order']['id']}/approval-link", timeout=30
    )
    assert response.status_code == 200, response.text
    link = response.json()
    assert link["approval_url"].startswith(frontend_env["REACT_APP_BACKEND_URL"] + "/onay/")
    assert link["whatsapp_url"].startswith("https://wa.me/") and "text=" in link["whatsapp_url"]
    assert feature_state["order"]["service_no"] in link["message"]

    public_get = requests.get(f"{BASE_URL}/api/public/approval/{link['token']}", timeout=30)
    assert public_get.status_code == 200, public_get.text
    summary = public_get.json()
    assert summary["service_no"] == feature_state["order"]["service_no"]
    assert summary["grand_total"] == 440
    assert "customer_id" not in summary and "customer_phone" not in summary

    decision = requests.post(
        f"{BASE_URL}/api/public/approval/{link['token']}",
        json={"approve": True, "note": "TEST_I2 approved"}, timeout=30,
    )
    assert decision.status_code == 200
    assert decision.json()["approval_status"] == "approved"
    order = feature_state["admin"].get(
        f"{BASE_URL}/api/service-orders/{feature_state['order']['id']}", timeout=30
    ).json()
    assert order["approval_status"] == "approved"
    assert order["status"] == "approved"
    assert order["approval_note"] == "TEST_I2 approved"
    assert order["status_history"][-1]["by"] == "customer_approval"


# Reminder endpoint contract includes enriched customer and motorcycle rows.
def test_05_reminders_contract(feature_state):
    response = feature_state["admin"].get(f"{BASE_URL}/api/reminders", timeout=30)
    assert response.status_code == 200, response.text
    data = response.json()
    assert set(data) == {"overdue", "upcoming"}
    assert isinstance(data["overdue"], list) and isinstance(data["upcoming"], list)
    for row in data["overdue"] + data["upcoming"]:
        assert isinstance(row["motorcycle_id"], str)
        assert {"brand", "model", "plate", "customer", "next_km", "days_left"}.issubset(row)
        assert row["customer"] is None or {"first_name", "last_name", "phone"}.issubset(row["customer"])
        assert "_id" not in row


# Standalone payment creates a persisted external payment and linked ledger transaction.
def test_06_external_payment_and_transaction(feature_state):
    response = feature_state["admin"].post(
        f"{BASE_URL}/api/payments",
        json={"customer_id": feature_state["customer"]["id"], "service_order_id": None,
              "amount": 500, "method": "cash", "note": "TEST_I2 external"}, timeout=30,
    )
    assert response.status_code == 200, response.text
    payment = response.json()
    feature_state["created_payment_ids"].append(payment["id"])
    feature_state["external_payment_id"] = payment["id"]
    assert payment["service_order_id"] is None
    assert payment["amount"] == 500 and payment["note"] == "TEST_I2 external"

    rows = feature_state["admin"].get(f"{BASE_URL}/api/payments", timeout=30).json()
    assert any(p["id"] == payment["id"] and p["service_order_id"] is None for p in rows)
    txs = feature_state["admin"].get(
        f"{BASE_URL}/api/current-accounts/{feature_state['customer']['id']}/transactions", timeout=30
    ).json()
    assert any(t.get("payment_id") == payment["id"] and t["type"] == "payment" and t["amount"] == -500 for t in txs)


# Admin payment amount edit adjusts service paid_total and transaction; delete reverses and removes both records.
def test_07_linked_payment_admin_update_and_delete(feature_state):
    state = feature_state
    created = state["admin"].post(
        f"{BASE_URL}/api/payments",
        json={"customer_id": state["customer"]["id"], "service_order_id": state["order"]["id"],
              "amount": 100, "method": "cash", "note": "TEST_I2 linked"}, timeout=30,
    )
    assert created.status_code == 200, created.text
    payment = created.json()
    state["created_payment_ids"].append(payment["id"])
    assert state["admin"].get(f"{BASE_URL}/api/service-orders/{state['order']['id']}", timeout=30).json()["paid_total"] == 100

    updated = state["admin"].put(
        f"{BASE_URL}/api/payments/{payment['id']}",
        json={"amount": 175, "method": "transfer", "note": "TEST_I2 updated"}, timeout=30,
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["amount"] == 175 and body["method"] == "transfer" and body["note"] == "TEST_I2 updated"
    assert state["admin"].get(f"{BASE_URL}/api/service-orders/{state['order']['id']}", timeout=30).json()["paid_total"] == 175
    txs = state["admin"].get(f"{BASE_URL}/api/current-accounts/{state['customer']['id']}/transactions", timeout=30).json()
    assert any(t.get("payment_id") == payment["id"] and t["amount"] == -175 for t in txs)

    deleted = state["admin"].delete(f"{BASE_URL}/api/payments/{payment['id']}", timeout=30)
    assert deleted.status_code == 200 and deleted.json() == {"ok": True}
    assert state["admin"].get(f"{BASE_URL}/api/service-orders/{state['order']['id']}", timeout=30).json()["paid_total"] == 0
    rows = state["admin"].get(f"{BASE_URL}/api/payments", timeout=30).json()
    assert all(p["id"] != payment["id"] for p in rows)
    txs = state["admin"].get(f"{BASE_URL}/api/current-accounts/{state['customer']['id']}/transactions", timeout=30).json()
    assert all(t.get("payment_id") != payment["id"] for t in txs)


# Payment edit/delete RBAC rejects non-admin users.
def test_08_payment_edit_delete_nonadmin_forbidden(feature_state):
    state = feature_state
    pid = state["external_payment_id"]
    update = state["nonadmin"].put(f"{BASE_URL}/api/payments/{pid}", json={"amount": 750}, timeout=30)
    assert update.status_code == 403 and update.json()["detail"] == "Yetkiniz yok"
    delete = state["nonadmin"].delete(f"{BASE_URL}/api/payments/{pid}", timeout=30)
    assert delete.status_code == 403 and delete.json()["detail"] == "Yetkiniz yok"


# Admin order edit persists item/labor/discount changes, recomputes totals, and adds one adjustment transaction.
def test_09_service_order_admin_edit_recomputes_and_adjusts(feature_state):
    state = feature_state
    before_txs = state["admin"].get(f"{BASE_URL}/api/current-accounts/{state['customer']['id']}/transactions", timeout=30).json()
    payload = {**state["order_payload"]}
    payload.update({
        "status": "approved", "labor_total": 80, "discount": 20,
        "items": [
            {"kind": "part", "name": "TEST_I2 Part edited", "qty": 3, "unit_price": 100, "vat": 20},
            {"kind": "service", "name": "TEST_I2 Service", "qty": 1, "unit_price": 250, "vat": 20},
        ],
    })
    response = state["admin"].put(f"{BASE_URL}/api/service-orders/{state['order']['id']}", json=payload, timeout=30)
    assert response.status_code == 200, response.text
    order = response.json()
    assert order["items"][0]["name"] == "TEST_I2 Part edited"
    assert order["items"][0]["qty"] == 3 and order["items"][1]["unit_price"] == 250
    assert order["parts_total"] == 300 and order["services_total"] == 250
    assert order["labor_total"] == 80 and order["discount"] == 20 and order["grand_total"] == 610

    after_txs = state["admin"].get(f"{BASE_URL}/api/current-accounts/{state['customer']['id']}/transactions", timeout=30).json()
    new_adjusts = [t for t in after_txs if t["type"] == "adjust" and t["service_order_id"] == state["order"]["id"]]
    assert len(new_adjusts) == 1
    assert new_adjusts[0]["amount"] == 170
    assert len(after_txs) == len(before_txs) + 1


# The service-order update endpoint is specified as admin-only.
def test_10_service_order_edit_nonadmin_forbidden(feature_state):
    state = feature_state
    payload = {**state["order_payload"], "labor_total": 999}
    response = state["nonadmin"].put(
        f"{BASE_URL}/api/service-orders/{state['order']['id']}", json=payload, timeout=30
    )
    assert response.status_code == 403, f"Expected 403 for non-admin edit, got {response.status_code}: {response.text[:500]}"


# Soft delete cancels; hard delete removes order, linked payment, and all linked transactions.
def test_11_service_order_soft_and_hard_delete(feature_state):
    state = feature_state
    soft_order = create_order(state, "soft delete")
    soft = state["admin"].delete(f"{BASE_URL}/api/service-orders/{soft_order['id']}", timeout=30)
    assert soft.status_code == 200 and soft.json() == {"ok": True}
    fetched = state["admin"].get(f"{BASE_URL}/api/service-orders/{soft_order['id']}", timeout=30)
    assert fetched.status_code == 200 and fetched.json()["status"] == "cancelled"
    state["admin"].delete(f"{BASE_URL}/api/service-orders/{soft_order['id']}", params={"hard": "true"}, timeout=30)

    hard_order = create_order(state, "hard delete")
    payment = state["admin"].post(
        f"{BASE_URL}/api/payments",
        json={"customer_id": state["customer"]["id"], "service_order_id": hard_order["id"],
              "amount": 50, "method": "card", "note": "TEST_I2 hard-delete payment"}, timeout=30,
    )
    assert payment.status_code == 200, payment.text
    payment_id = payment.json()["id"]
    state["created_payment_ids"].append(payment_id)

    deleted = state["admin"].delete(
        f"{BASE_URL}/api/service-orders/{hard_order['id']}", params={"hard": "true"}, timeout=30
    )
    assert deleted.status_code == 200 and deleted.json() == {"ok": True}
    assert state["admin"].get(f"{BASE_URL}/api/service-orders/{hard_order['id']}", timeout=30).status_code == 404
    payments = state["admin"].get(f"{BASE_URL}/api/payments", timeout=30).json()
    assert all(p["id"] != payment_id and p.get("service_order_id") != hard_order["id"] for p in payments)
    txs = state["admin"].get(f"{BASE_URL}/api/current-accounts/{state['customer']['id']}/transactions", timeout=30).json()
    assert all(t.get("service_order_id") != hard_order["id"] for t in txs)


# Hard and soft service-order deletes reject non-admin users.
def test_12_service_order_delete_nonadmin_forbidden(feature_state):
    state = feature_state
    order = create_order(state, "nonadmin delete")
    for hard in (False, True):
        response = state["nonadmin"].delete(
            f"{BASE_URL}/api/service-orders/{order['id']}", params={"hard": str(hard).lower()}, timeout=30
        )
        assert response.status_code == 403 and response.json()["detail"] == "Yetkiniz yok"
    state["admin"].delete(f"{BASE_URL}/api/service-orders/{order['id']}", params={"hard": "true"}, timeout=30)


# Payment edits must preserve the positive-amount invariant enforced at creation.
def test_13_payment_update_rejects_nonpositive_amount(feature_state):
    state = feature_state
    pid = state["external_payment_id"]
    response = state["admin"].put(f"{BASE_URL}/api/payments/{pid}", json={"amount": -10}, timeout=30)
    assert response.status_code == 400, f"Expected 400 for negative payment update, got {response.status_code}: {response.text[:500]}"
