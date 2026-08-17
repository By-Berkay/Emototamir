"""Iteration 5 regression for reminder digests, cron auth, tagged notes, dashboard, quotes, and auth."""
import copy
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import bcrypt
import pytest
import requests
import yaml
from dotenv import dotenv_values
from pymongo import MongoClient

FRONTEND_ENV = dotenv_values("/app/frontend/.env")
BACKEND_ENV = dotenv_values("/app/backend/.env")
BASE_URL = (FRONTEND_ENV.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
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
        pytest.skip(f"Unusable credential section: {section}")
    return email.group(1), password.group(1)


def login(email, password):
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    if response.status_code == 200 and response.json().get("token"):
        session.headers.update({"Authorization": f"Bearer {response.json()['token']}"})
    return session, response


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

    mongo = MongoClient(BACKEND_ENV["MONGO_URL"], serverSelectionTimeoutMS=5000)
    db = mongo[BACKEND_ENV["DB_NAME"]]
    data = {
        "tenant": tenant,
        "tenant_login": tenant_login,
        "tenant_email": tenant_email,
        "tenant_password": tenant_password,
        "super": super_session,
        "super_login": super_login,
        "super_email": super_email,
        "demo_tid": tenant_login.json()["user"]["tenant_id"],
        "db": db,
        "mongo": mongo,
        "created": {},
        "restores": {},
    }
    yield data

    for mid, original_km in data["restores"].get("motorcycle_km", {}).items():
        db.motorcycles.update_one({"id": mid}, {"$set": {"km": original_km}})
    ids = data["created"]
    for qid in ids.get("quote_ids", []):
        db.quotes.delete_many({"id": qid})
        db.audit_logs.delete_many({"entity_id": qid})
    for cid in ids.get("customer_ids", []):
        db.customers.delete_many({"id": cid})
        db.audit_logs.delete_many({"entity_id": cid})
    for mid in ids.get("motorcycle_ids", []):
        db.motorcycles.delete_many({"id": mid})
    for identifier in ids.get("login_identifiers", []):
        db.login_attempts.delete_many({"identifier": identifier})
    mongo.close()


# Both documented accounts authenticate and issue secure HttpOnly cookies.
def test_01_login_roles_and_cookie(state):
    assert state["tenant_login"].json()["user"]["role"] == "admin"
    assert state["super_login"].json()["user"]["role"] == "super_admin"
    for response in (state["tenant_login"], state["super_login"]):
        cookie = response.headers.get("Set-Cookie", "").lower()
        assert "access_token=" in cookie
        assert "httponly" in cookie and "secure" in cookie and "samesite=none" in cookie


# Cron endpoint rejects missing/wrong authorization and acknowledges a valid secret quickly.
def test_02_cron_auth_and_immediate_ack(state):
    endpoint = f"{BASE_URL}/api/cron/reminders-digest"
    missing = requests.post(endpoint, timeout=30)
    wrong = requests.post(endpoint, headers={"Authorization": "Bearer wrong-secret"}, timeout=30)
    assert missing.status_code == 401 and missing.json()["detail"] == "unauthorized"
    assert wrong.status_code == 401 and wrong.json()["detail"] == "unauthorized"

    started = time.monotonic()
    valid = requests.post(
        endpoint,
        headers={"Authorization": f"Bearer {BACKEND_ENV['WEBHOOK_CRON_SECRET']}"},
        timeout=30,
    )
    elapsed = time.monotonic() - started
    assert valid.status_code in (200, 202), valid.text
    assert valid.json() == {"accepted": True}
    assert elapsed < 2.0, f"Cron acknowledgement took {elapsed:.3f}s instead of returning immediately"

    time.sleep(2)
    digest = state["tenant"].get(f"{BASE_URL}/api/dashboard/reminders-today", timeout=30)
    assert digest.status_code == 200, digest.text
    body = digest.json()
    assert body["date"] == datetime.now(timezone.utc).date().isoformat()
    assert isinstance(body["links"], list) and isinstance(body["due_count"], int)
    assert body["generated_at"]


# Tenant-admin manual regeneration persists and returns a complete digest contract.
def test_03_tenant_regenerate_and_dashboard_contract(state):
    response = state["tenant"].post(f"{BASE_URL}/api/dashboard/reminders-today/regenerate", timeout=60)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["tenant_id"] == state["demo_tid"]
    assert body["generated_at"] and body["date"]
    assert isinstance(body["links"], list)
    assert isinstance(body["due_count"], int)
    fetched = state["tenant"].get(f"{BASE_URL}/api/dashboard/reminders-today", timeout=30)
    assert fetched.status_code == 200
    assert fetched.json()["generated_at"] == body["generated_at"]

    dashboard = state["tenant"].get(f"{BASE_URL}/api/dashboard", timeout=30)
    assert dashboard.status_code == 200
    dashboard_body = dashboard.json()
    assert {"kpi", "monthly_revenue", "status_distribution"}.issubset(dashboard_body)
    assert isinstance(dashboard_body["kpi"], dict)
    assert isinstance(dashboard_body["monthly_revenue"], list)
    assert isinstance(dashboard_body["status_distribution"], list)


# Raising an existing serviced motorcycle's odometer creates a WhatsApp reminder; teardown restores km.
def test_04_manufacture_due_reminder_and_restore_later(state):
    db = state["db"]
    tid = state["demo_tid"]
    order = db.service_orders.find_one({"tenant_id": tid, "motorcycle_id": {"$exists": True}}, sort=[("created_at", -1)])
    assert order, "Demo tenant has no service order suitable for due-reminder test"
    motorcycle = db.motorcycles.find_one({"tenant_id": tid, "id": order["motorcycle_id"]})
    assert motorcycle, "Service order motorcycle is missing"
    state["restores"].setdefault("motorcycle_km", {})[motorcycle["id"]] = motorcycle.get("km", 0)
    tenant = db.tenants.find_one({"id": tid}) or {}
    high_km = int(order.get("km") or motorcycle.get("km") or 0) + int(tenant.get("reminder_km") or 5000) + 100
    db.motorcycles.update_one({"id": motorcycle["id"]}, {"$set": {"km": high_km}})

    response = state["tenant"].post(f"{BASE_URL}/api/dashboard/reminders-today/regenerate", timeout=60)
    assert response.status_code == 200, response.text
    body = response.json()
    matching = [link for link in body["links"] if link["motorcycle_id"] == motorcycle["id"]]
    assert matching, f"Manufactured due motorcycle absent from links: {body}"
    link = matching[0]
    assert link["km_over"] is True
    assert link["url"].startswith("https://wa.me/") and "?text=" in link["url"]
    state["due_motorcycle_id"] = motorcycle["id"]


# Tagged note CRUD persists vip -> borclu, list top_tag, invalid tag coercion, and deletion.
def test_05_note_tag_crud_top_tag_and_validation(state):
    suffix = uuid.uuid4().hex[:8]
    customer = state["tenant"].post(
        f"{BASE_URL}/api/customers",
        json={"first_name": "TEST_I5", "last_name": "Tagged", "phone": "05320001122", "email": f"test.i5.{suffix}@example.test"},
        timeout=30,
    )
    assert customer.status_code == 200, customer.text
    cid = customer.json()["id"]
    state["created"].setdefault("customer_ids", []).append(cid)
    state["customer_id"] = cid

    made = state["tenant"].post(
        f"{BASE_URL}/api/customers/{cid}/notes",
        json={"text": "TEST_I5 VIP note", "tag": "vip"}, timeout=30,
    )
    assert made.status_code == 200, made.text
    note = made.json()
    assert note["tag"] == "vip"

    listed = state["tenant"].get(f"{BASE_URL}/api/customers", timeout=30)
    assert listed.status_code == 200
    row = next(c for c in listed.json() if c["id"] == cid)
    assert "top_tag" in row and row["top_tag"] == "vip"

    updated = state["tenant"].put(
        f"{BASE_URL}/api/customers/{cid}/notes/{note['id']}",
        json={"text": "TEST_I5 debt note", "tag": "borclu"}, timeout=30,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["tag"] == "borclu" and updated.json()["updated_at"]

    invalid_add = state["tenant"].post(
        f"{BASE_URL}/api/customers/{cid}/notes",
        json={"text": "TEST_I5 invalid tag", "tag": "foo"}, timeout=30,
    )
    assert invalid_add.status_code == 200, invalid_add.text
    assert invalid_add.json()["tag"] == ""

    invalid_update = state["tenant"].put(
        f"{BASE_URL}/api/customers/{cid}/notes/{note['id']}",
        json={"text": "TEST_I5 invalid update tag", "tag": "foo"}, timeout=30,
    )
    assert invalid_update.status_code == 200, invalid_update.text
    assert invalid_update.json()["tag"] == "", "Unsupported update tag must silently coerce to empty"

    for nid in (note["id"], invalid_add.json()["id"]):
        deleted = state["tenant"].delete(f"{BASE_URL}/api/customers/{cid}/notes/{nid}", timeout=30)
        assert deleted.status_code == 200 and deleted.json() == {"ok": True}
    detail = state["tenant"].get(f"{BASE_URL}/api/customers/{cid}", timeout=30).json()
    assert detail.get("note_entries", []) == []


# Quotes create/read/update/delete remain functional after this feature batch.
def test_06_quotes_crud_regression(state):
    suffix = uuid.uuid4().hex[:7]
    cid = state["customer_id"]
    motorcycle = state["tenant"].post(
        f"{BASE_URL}/api/motorcycles",
        json={"customer_id": cid, "brand": "TEST_I5", "model": "Quote", "plate": f"34I5{suffix[:4]}", "km": 100},
        timeout=30,
    )
    assert motorcycle.status_code == 200, motorcycle.text
    mid = motorcycle.json()["id"]
    state["created"].setdefault("motorcycle_ids", []).append(mid)
    payload = {
        "customer_id": cid,
        "motorcycle_id": mid,
        "items": [{"kind": "service", "name": "TEST_I5 Service", "qty": 1, "unit_price": 250, "vat": 20}],
        "labor_total": 50,
        "discount": 10,
        "notes": "TEST_I5 quote",
        "valid_until": "2030-01-01T00:00:00+00:00",
    }
    made = state["tenant"].post(f"{BASE_URL}/api/quotes", json=payload, timeout=30)
    assert made.status_code == 200, made.text
    quote = made.json()
    state["created"].setdefault("quote_ids", []).append(quote["id"])
    assert quote["grand_total"] == 340 and quote["status"] == "draft"
    fetched = state["tenant"].get(f"{BASE_URL}/api/quotes/{quote['id']}", timeout=30)
    assert fetched.status_code == 200 and fetched.json()["notes"] == "TEST_I5 quote"
    changed_payload = copy.deepcopy(payload)
    changed_payload["notes"] = "TEST_I5 changed"
    changed_payload["labor_total"] = 60
    changed = state["tenant"].put(f"{BASE_URL}/api/quotes/{quote['id']}", json=changed_payload, timeout=30)
    assert changed.status_code == 200 and changed.json()["grand_total"] == 350
    deleted = state["tenant"].delete(f"{BASE_URL}/api/quotes/{quote['id']}", timeout=30)
    assert deleted.status_code == 200 and deleted.json() == {"ok": True}
    missing = state["tenant"].get(f"{BASE_URL}/api/quotes/{quote['id']}", timeout=30)
    assert missing.status_code == 404


# Cron YAML parses and contains exactly the requested daily Istanbul job.
def test_07_cron_yaml_contract():
    path = Path("/app/.emergent/crons.yml")
    assert path.exists()
    parsed = yaml.safe_load(path.read_text(encoding="utf-8"))
    jobs = parsed["crons"]
    assert len(jobs) == 1
    job = jobs[0]
    assert job["name"] == "reminders-daily"
    assert job["cron"] == "0 9 * * *"
    assert job["timezone"] == "Europe/Istanbul"
    assert job["method"] == "POST" and job["enabled"] is True
    assert job["endpoint"].endswith("/api/cron/reminders-digest")


# Auth playbook: bcrypt format, lockout, explicit credentialed CORS, and seed reconciliation code.
def test_08_auth_playbook_security(state):
    db = state["db"]
    tenant_user = db.users.find_one({"email": state["tenant_email"]})
    super_user = db.users.find_one({"email": state["super_email"]})
    assert tenant_user["password_hash"].startswith("$2b$")
    assert super_user["password_hash"].startswith("$2b$")
    assert bcrypt.checkpw(state["tenant_password"].encode(), tenant_user["password_hash"].encode())

    fake_email = f"test.i5.lockout.{uuid.uuid4().hex}@example.com"
    identifier = f"login:{fake_email}"
    state["created"].setdefault("login_identifiers", []).append(identifier)
    statuses = []
    for _ in range(6):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": fake_email, "password": "wrong"}, timeout=30,
        )
        statuses.append(response.status_code)
    assert statuses[:5] == [401] * 5 and statuses[5] == 429

    trusted = FRONTEND_ENV["REACT_APP_BACKEND_URL"]
    cors = requests.options(
        f"{BASE_URL}/api/auth/login",
        headers={"Origin": trusted, "Access-Control-Request-Method": "POST"}, timeout=30,
    )
    assert cors.status_code in (200, 204)
    assert cors.headers.get("Access-Control-Allow-Origin") == trusted
    assert cors.headers.get("Access-Control-Allow-Credentials") == "true"
    untrusted = requests.options(
        f"{BASE_URL}/api/auth/login",
        headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST"}, timeout=30,
    )
    assert untrusted.headers.get("Access-Control-Allow-Origin") is None

    source = Path("/app/backend/server.py").read_text(encoding="utf-8")
    assert 'if not verify_password(pwd, existing["password_hash"]):' in source
    assert 'updates["password_hash"] = hash_password(pwd)' in source
