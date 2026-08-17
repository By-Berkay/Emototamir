"""Iteration 3 public API regression for tenant cloning, subscriptions, audit, PDFs, and order CRUD."""
import copy
import re
import time
import uuid
from pathlib import Path

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
    email = re.search(r"(?im)^- Email:\s*(\S+)", block)
    password = re.search(r"(?im)^- Password:\s*(\S+)", block)
    if not email or not password:
        pytest.skip(f"Unusable credentials in section: {section}")
    return email.group(1), password.group(1)


def login(email, password):
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30
    )
    return session, response


@pytest.fixture(scope="module")
def state():
    super_email, super_password = credential_for("Süper Admin")
    tenant_email, tenant_password = credential_for("Demo Firma")
    super_session, super_login = login(super_email, super_password)
    if super_login.status_code != 200:
        pytest.fail(f"Super admin login failed: {super_login.status_code} {super_login.text[:500]}")
    super_token = super_login.json().get("token")
    if not super_token:
        pytest.fail("Super admin login returned no token")
    super_session.headers.update({"Authorization": f"Bearer {super_token}"})

    tenant_session, tenant_login = login(tenant_email, tenant_password)
    if tenant_login.status_code != 200:
        pytest.fail(f"Tenant admin login failed: {tenant_login.status_code} {tenant_login.text[:500]}")
    tenant_token = tenant_login.json().get("token")
    if not tenant_token:
        pytest.fail("Tenant admin login returned no token")
    tenant_session.headers.update({"Authorization": f"Bearer {tenant_token}"})
    demo_tid = tenant_login.json()["user"]["tenant_id"]

    data = {
        "super": super_session,
        "super_login": super_login,
        "super_email": super_email,
        "tenant": tenant_session,
        "tenant_login": tenant_login,
        "tenant_email": tenant_email,
        "tenant_password": tenant_password,
        "tenant_token": tenant_token,
        "demo_tid": demo_tid,
        "clone_tid": None,
        "created": {},
    }
    yield data

    # Restore demo subscription regardless of assertion failures.
    mongo = MongoClient(backend_env["MONGO_URL"])
    db = mongo[backend_env["DB_NAME"]]
    original = data.get("original_demo_tenant")
    if original:
        restore = {k: v for k, v in original.items() if k != "_id"}
        db.tenants.replace_one({"id": demo_tid}, restore)
    ids = data.get("created", {})
    order_id = ids.get("order_id")
    customer_id = ids.get("customer_id")
    motorcycle_id = ids.get("motorcycle_id")
    if order_id:
        db.transactions.delete_many({"service_order_id": order_id})
        db.payments.delete_many({"service_order_id": order_id})
        db.audit_logs.delete_many({"entity_id": order_id})
        db.service_orders.delete_many({"id": order_id})
    if motorcycle_id:
        db.motorcycles.delete_many({"id": motorcycle_id})
    if customer_id:
        db.transactions.delete_many({"customer_id": customer_id})
        db.customers.delete_many({"id": customer_id})
    if data.get("clone_tid"):
        tid = data["clone_tid"]
        for collection in ["customers", "motorcycles", "service_orders", "payments", "transactions", "products", "service_catalog", "audit_logs", "counters", "file_refs", "users"]:
            db[collection].delete_many({"tenant_id": tid})
        db.tenants.delete_many({"id": tid})
    db.login_attempts.delete_many({"identifier": {"$regex": r"^login:test\.i3\."}})
    mongo.close()


# Both documented roles must authenticate and receive secure cookies and correct identity data.
def test_01_login_regression_and_security_cookie(state):
    assert state["super_login"].json()["user"]["role"] == "super_admin"
    assert state["tenant_login"].json()["user"]["role"] == "admin"
    assert state["tenant_login"].json()["tenant"]["id"] == state["demo_tid"]
    for response in (state["super_login"], state["tenant_login"]):
        cookie = response.headers.get("Set-Cookie", "").lower()
        assert "access_token=" in cookie
        assert "httponly" in cookie and "secure" in cookie and "samesite=none" in cookie


# Super-admin list/detail contract and demo catalog baseline used for cloning.
def test_02_tenant_list_and_detail(state):
    response = state["super"].get(f"{BASE_URL}/api/admin/tenants", timeout=30)
    assert response.status_code == 200, response.text
    tenants = response.json()
    demo = next(t for t in tenants if t["id"] == state["demo_tid"])
    assert demo["name"]
    assert isinstance(demo["users_count"], int) and demo["users_count"] >= 1
    assert isinstance(demo["orders_count"], int)

    detail = state["super"].get(f"{BASE_URL}/api/admin/tenants/{state['demo_tid']}", timeout=30)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["id"] == state["demo_tid"]
    assert isinstance(body["users"], list) and isinstance(body["stats"], dict)
    mongo = MongoClient(backend_env["MONGO_URL"])
    state["original_demo_tenant"] = mongo[backend_env["DB_NAME"]].tenants.find_one({"id": state["demo_tid"]})
    mongo.close()


# Clone copies tenant presentation settings and catalogs but no business/customer data.
def test_03_clone_tenant_and_verify_isolation(state):
    stamp = f"{int(time.time())}-{uuid.uuid4().hex[:6]}"
    clone_email = f"test.i3.clone.{stamp}@example.com"
    payload = {
        "new_name": f"TEST_I3 Clone {stamp}",
        "new_slug": f"test-i3-{stamp}",
        "admin_email": clone_email,
        "admin_password": "TEST-I3-pass",
        "admin_name": "TEST I3 Admin",
        "include_products": True,
        "include_services": True,
    }
    source_products = state["tenant"].get(f"{BASE_URL}/api/products", timeout=30).json()
    source_services = state["tenant"].get(f"{BASE_URL}/api/service-catalog", timeout=30).json()
    response = state["super"].post(
        f"{BASE_URL}/api/admin/tenants/{state['demo_tid']}/clone", json=payload, timeout=120
    )
    assert response.status_code == 200, response.text
    body = response.json()
    clone = body["tenant"]
    state["clone_tid"] = clone["id"]
    state["clone_email"] = clone_email
    assert clone["name"] == payload["new_name"]
    assert clone["id"] != state["demo_tid"]
    assert body["parts_copied"] == len(source_products)
    assert body["services_copied"] == len(source_services)

    source = state["super"].get(f"{BASE_URL}/api/admin/tenants/{state['demo_tid']}", timeout=30).json()
    for field in ("theme", "primary_color", "secondary_color", "font_family", "pdf_template"):
        assert clone.get(field) == source.get(field)

    clone_session, clone_login = login(clone_email, payload["admin_password"])
    assert clone_login.status_code == 200, clone_login.text
    clone_session.headers.update({"Authorization": f"Bearer {clone_login.json()['token']}"})
    assert clone_login.json()["user"]["tenant_id"] == clone["id"]
    assert len(clone_session.get(f"{BASE_URL}/api/products", timeout=30).json()) == len(source_products)
    assert len(clone_session.get(f"{BASE_URL}/api/service-catalog", timeout=30).json()) == len(source_services)
    assert clone_session.get(f"{BASE_URL}/api/customers", timeout=30).json() == []
    assert clone_session.get(f"{BASE_URL}/api/motorcycles", timeout=30).json() == []
    assert clone_session.get(f"{BASE_URL}/api/service-orders", timeout=30).json() == []
    assert all(p["stock"] == 0 for p in clone_session.get(f"{BASE_URL}/api/products", timeout=30).json())


# Tenant update/read is persistent; the clone will be deleted in teardown.
def test_04_tenant_update_and_get_persistence(state):
    tid = state["clone_tid"]
    detail = state["super"].get(f"{BASE_URL}/api/admin/tenants/{tid}", timeout=30).json()
    payload = {k: v for k, v in detail.items() if k not in {"id", "created_at", "users", "stats"}}
    payload["billing_notes"] = "TEST_I3 billing note"
    payload["plan"] = "pro"
    response = state["super"].put(f"{BASE_URL}/api/admin/tenants/{tid}", json=payload, timeout=30)
    assert response.status_code == 200, response.text
    assert response.json()["billing_notes"] == "TEST_I3 billing note"
    fetched = state["super"].get(f"{BASE_URL}/api/admin/tenants/{tid}", timeout=30).json()
    assert fetched["plan"] == "pro" and fetched["billing_notes"] == "TEST_I3 billing note"


# Live preview endpoint must return non-trivial PDFs for both kinds and accept unsaved title changes.
def test_05_pdf_preview_both_kinds_and_live_title(state):
    tenant = state["super"].get(f"{BASE_URL}/api/admin/tenants/{state['demo_tid']}", timeout=30).json()
    tenant.pop("users", None)
    tenant.pop("stats", None)
    tenant["pdf_template"] = {**(tenant.get("pdf_template") or {}), "kabul_title": "TEST I3 CANLI KABUL"}
    for kind in ("kabul", "teslim"):
        response = state["super"].post(
            f"{BASE_URL}/api/admin/pdf-preview", json={"tenant": tenant, "kind": kind}, timeout=60
        )
        assert response.status_code == 200, response.text[:500]
        assert response.headers["Content-Type"].startswith("application/pdf")
        assert response.content.startswith(b"%PDF-") and len(response.content) > 5_000
        assert "inline" in response.headers.get("Content-Disposition", "").lower()


# Expired trial blocks login with requested detail; future dates plus active restores access.
def test_06_subscription_expiry_block_and_restore(state):
    tid = state["demo_tid"]
    original = state["super"].get(f"{BASE_URL}/api/admin/tenants/{tid}", timeout=30).json()
    base_payload = {k: v for k, v in original.items() if k not in {"id", "created_at", "users", "stats"}}
    expired = copy.deepcopy(base_payload)
    expired.update({"plan": "trial", "trial_ends_at": "2020-01-01T23:59:59+00:00", "subscription_ends_at": None, "is_active": True})
    saved = state["super"].put(f"{BASE_URL}/api/admin/tenants/{tid}", json=expired, timeout=30)
    assert saved.status_code == 200, saved.text
    assert saved.json()["plan"] == "trial" and saved.json()["is_active"] is True

    _, blocked = login(state["tenant_email"], state["tenant_password"])
    assert blocked.status_code == 403, blocked.text
    assert "Firma aboneliği sona erdi" in blocked.json()["detail"]

    restored = copy.deepcopy(base_payload)
    restored.update({
        "plan": "pro",
        "trial_ends_at": "2030-01-01T23:59:59+00:00",
        "subscription_ends_at": "2030-01-01T23:59:59+00:00",
        "is_active": True,
    })
    saved = state["super"].put(f"{BASE_URL}/api/admin/tenants/{tid}", json=restored, timeout=30)
    assert saved.status_code == 200, saved.text
    assert saved.json()["is_active"] is True and saved.json()["subscription_ends_at"].startswith("2030-01-01")
    new_session, active = login(state["tenant_email"], state["tenant_password"])
    assert active.status_code == 200, active.text
    new_session.headers.update({"Authorization": f"Bearer {active.json()['token']}"})
    state["tenant"] = new_session
    state["tenant_token"] = active.json()["token"]


# Audit listing is newest-first and action substring filter returns only tenant.* records.
def test_07_audit_log_list_and_action_filter(state):
    response = state["super"].get(f"{BASE_URL}/api/admin/audit-logs", params={"limit": 500}, timeout=30)
    assert response.status_code == 200, response.text
    logs = response.json()
    assert logs and all({"id", "action", "at", "user"}.issubset(row) for row in logs)
    assert [row["at"] for row in logs] == sorted((row["at"] for row in logs), reverse=True)

    filtered = state["super"].get(
        f"{BASE_URL}/api/admin/audit-logs", params={"action": "tenant", "limit": 500}, timeout=30
    )
    assert filtered.status_code == 200, filtered.text
    rows = filtered.json()
    assert rows and all("tenant" in row["action"].lower() for row in rows)
    assert any(row["action"] == "tenant.clone" and row["entity_id"] == state["clone_tid"] for row in rows)



# Invalid regex filter input must be rejected as a client error rather than causing MongoDB/server failure.
def test_07b_audit_invalid_regex_is_handled(state):
    response = state["super"].get(
        f"{BASE_URL}/api/admin/audit-logs", params={"action": "[", "limit": 20}, timeout=30
    )
    assert response.status_code == 400, (
        f"Expected validated 400 for invalid action regex, got {response.status_code}: {response.text[:500]}"
    )
    assert "detail" in response.json()


# Service-order create/read/update/PDF/delete remains functional for tenant admin.
def test_08_service_order_crud_and_real_pdf(state):
    suffix = uuid.uuid4().hex[:8]
    customer_response = state["tenant"].post(
        f"{BASE_URL}/api/customers",
        json={"first_name": "TEST_I3", "last_name": "Customer", "phone": f"0555{suffix[:7]}", "email": f"test.i3.customer.{suffix}@example.test"},
        timeout=30,
    )
    assert customer_response.status_code == 200, customer_response.text
    customer = customer_response.json()
    state["created"]["customer_id"] = customer["id"]

    moto_response = state["tenant"].post(
        f"{BASE_URL}/api/motorcycles",
        json={"customer_id": customer["id"], "brand": "TEST_I3", "model": "Regression", "plate": f"34I3{suffix[:4]}", "km": 100},
        timeout=30,
    )
    assert moto_response.status_code == 200, moto_response.text
    motorcycle = moto_response.json()
    state["created"]["motorcycle_id"] = motorcycle["id"]

    payload = {
        "customer_id": customer["id"], "motorcycle_id": motorcycle["id"], "km": 200,
        "complaint": "TEST_I3 order CRUD", "items": [{"kind": "service", "name": "TEST_I3 Service", "qty": 1, "unit_price": 250, "vat": 20}],
        "labor_total": 50, "discount": 10, "status": "new",
    }
    created_response = state["tenant"].post(f"{BASE_URL}/api/service-orders", json=payload, timeout=30)
    assert created_response.status_code == 200, created_response.text
    order = created_response.json()
    state["created"]["order_id"] = order["id"]
    assert order["grand_total"] == 290 and order["customer_id"] == customer["id"]

    fetched = state["tenant"].get(f"{BASE_URL}/api/service-orders/{order['id']}", timeout=30)
    assert fetched.status_code == 200 and fetched.json()["complaint"] == "TEST_I3 order CRUD"
    payload.update({"complaint": "TEST_I3 order updated", "labor_total": 100})
    updated = state["tenant"].put(f"{BASE_URL}/api/service-orders/{order['id']}", json=payload, timeout=30)
    assert updated.status_code == 200, updated.text
    assert updated.json()["complaint"] == "TEST_I3 order updated" and updated.json()["grand_total"] == 340
    persisted = state["tenant"].get(f"{BASE_URL}/api/service-orders/{order['id']}", timeout=30).json()
    assert persisted["complaint"] == "TEST_I3 order updated" and persisted["labor_total"] == 100

    pdf = requests.get(
        f"{BASE_URL}/api/service-orders/{order['id']}/pdf/kabul",
        params={"auth": state["tenant_token"]}, timeout=60,
    )
    assert pdf.status_code == 200, pdf.text[:500]
    assert pdf.headers["Content-Type"].startswith("application/pdf")
    assert pdf.content.startswith(b"%PDF-") and len(pdf.content) > 5_000

    deleted = state["tenant"].delete(f"{BASE_URL}/api/service-orders/{order['id']}", params={"hard": "true"}, timeout=30)
    assert deleted.status_code == 200 and deleted.json() == {"ok": True}
    assert state["tenant"].get(f"{BASE_URL}/api/service-orders/{order['id']}", timeout=30).status_code == 404
    state["created"].pop("order_id", None)


# Auth implementation playbook: bcrypt format, persistent lockout, seed password reconciliation, and CORS.
def test_09_auth_playbook(state):
    mongo = MongoClient(backend_env["MONGO_URL"])
    db = mongo[backend_env["DB_NAME"]]
    super_user = db.users.find_one({"email": state["super_email"]})
    assert super_user and super_user["password_hash"].startswith("$2b$")
    source = Path("/app/backend/server.py").read_text(encoding="utf-8")
    assert 'if not verify_password(pwd, existing["password_hash"])' in source
    assert 'updates["password_hash"] = hash_password(pwd)' in source
    mongo.close()

    # Use the disposable clone account so the real users remain usable.
    statuses = []
    for _ in range(6):
        _, response = login(state["clone_email"], "definitely-wrong")
        statuses.append(response.status_code)
    assert statuses[:5] == [401] * 5
    assert statuses[5] == 429, statuses

    trusted = requests.options(
        f"{BASE_URL}/api/auth/login",
        headers={"Origin": BASE_URL, "Access-Control-Request-Method": "POST"}, timeout=30,
    )
    assert trusted.status_code in (200, 204)
    assert trusted.headers.get("Access-Control-Allow-Origin") == BASE_URL
    assert trusted.headers.get("Access-Control-Allow-Credentials") == "true"
    untrusted = requests.options(
        f"{BASE_URL}/api/auth/login",
        headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST"}, timeout=30,
    )
    assert untrusted.headers.get("Access-Control-Allow-Origin") is None


# Deletion endpoint purges cloned resources and tenant detail becomes unavailable.
def test_10_delete_cloned_tenant_and_verify_removal(state):
    tid = state["clone_tid"]
    response = state["super"].delete(f"{BASE_URL}/api/admin/tenants/{tid}", params={"purge": "true"}, timeout=60)
    assert response.status_code == 200 and response.json() == {"ok": True}
    assert state["super"].get(f"{BASE_URL}/api/admin/tenants/{tid}", timeout=30).status_code == 404
    mongo = MongoClient(backend_env["MONGO_URL"])
    mongo[backend_env["DB_NAME"]].login_attempts.delete_one({"identifier": f"login:{state['clone_email']}"})
    mongo.close()
    _, clone_login = login(state["clone_email"], "TEST-I3-pass")
    assert clone_login.status_code == 401
    state["clone_tid"] = None
