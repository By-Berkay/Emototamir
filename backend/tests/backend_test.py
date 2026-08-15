"""Public API regression tests for auth, dashboard, service workflow, payments, reports, and RBAC."""
import os
import re
import uuid
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


@pytest.fixture(scope="session")
def state():
    return {}


@pytest.fixture(scope="session")
def api(state):
    email, password = load_credentials()
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    if response.status_code != 200:
        pytest.fail(f"Admin login failed: {response.status_code} {response.text[:500]}")
    payload = response.json()
    token = payload.get("token")
    if not token:
        pytest.fail("Admin login response has no token")
    session.headers.update({"Authorization": f"Bearer {token}"})
    state.update({"admin_email": email, "admin_password": password, "token": token, "login": payload, "set_cookie": response.headers.get("Set-Cookie", "")})
    return session


def assert_no_mongo_id(value):
    if isinstance(value, dict):
        assert "_id" not in value
        for nested in value.values():
            assert_no_mongo_id(nested)
    elif isinstance(value, list):
        for nested in value:
            assert_no_mongo_id(nested)


# Auth login, bearer identity, secure cookie, and persistence checks.
def test_01_admin_login_and_me(api, state):
    login = state["login"]
    assert login["user"]["email"] == state["admin_email"]
    assert login["user"]["role"] == "admin"
    assert isinstance(login["token"], str) and len(login["token"]) > 20
    assert "password_hash" not in login["user"]
    assert api.cookies.get("access_token")
    cookie_header = state["set_cookie"].lower()
    assert "httponly" in cookie_header
    assert "secure" in cookie_header
    assert "samesite=none" in cookie_header

    response = api.get(f"{BASE_URL}/api/auth/me", timeout=30)
    assert response.status_code == 200
    me = response.json()
    assert me["email"] == state["admin_email"]
    assert me["role"] == "admin"
    assert_no_mongo_id(me)


# Dashboard KPI and chart/table contract.
def test_02_dashboard_contract(api):
    response = api.get(f"{BASE_URL}/api/dashboard", timeout=30)
    assert response.status_code == 200
    data = response.json()
    assert set(data) == {"kpi", "monthly_revenue", "status_distribution", "top_operations", "recent_orders"}
    expected_kpis = {"today_services", "open_services", "completed_services", "awaiting_delivery", "today_collection", "month_revenue", "total_receivables", "unpaid_count"}
    assert set(data["kpi"]) == expected_kpis
    assert all(isinstance(data["kpi"][key], (int, float)) for key in expected_kpis)
    assert len(data["monthly_revenue"]) == 12
    assert all(set(row) == {"month", "revenue"} for row in data["monthly_revenue"])
    assert isinstance(data["status_distribution"], list)
    assert isinstance(data["top_operations"], list)
    assert len(data["recent_orders"]) <= 10
    assert_no_mongo_id(data)


# Customer create then detail read with aggregate and child arrays.
def test_03_customer_create_and_detail(api, state):
    payload = {
        "first_name": "TEST_QA",
        "last_name": "Customer",
        "phone": "05550000001",
        "email": "test.qa.customer@example.test",
        "city": "Ankara",
        "district": "Çankaya",
    }
    response = api.post(f"{BASE_URL}/api/customers", json=payload, timeout=30)
    assert response.status_code == 200
    created = response.json()
    assert isinstance(created["id"], str) and created["id"]
    assert created["first_name"] == payload["first_name"]
    assert created["phone"] == payload["phone"]
    state["customer_id"] = created["id"]

    response = api.get(f"{BASE_URL}/api/customers/{created['id']}", timeout=30)
    assert response.status_code == 200
    detail = response.json()
    assert detail["id"] == created["id"]
    assert detail["motorcycles"] == []
    assert detail["service_orders"] == []
    assert detail["transactions"] == []
    assert detail["total_services"] == 0
    assert detail["total_spent"] == 0
    assert detail["balance"] == 0
    assert_no_mongo_id(detail)


# Motorcycle create, plate normalization, customer filter, and persistence.
def test_04_motorcycle_create_filter_and_uppercase(api, state):
    payload = {
        "customer_id": state["customer_id"],
        "brand": "TEST_Brand",
        "model": "QA 500",
        "year": 2025,
        "type": "Naked",
        "engine_cc": 500,
        "plate": "06 test 123",
        "km": 1234,
    }
    response = api.post(f"{BASE_URL}/api/motorcycles", json=payload, timeout=30)
    assert response.status_code == 200
    created = response.json()
    assert created["plate"] == "06TEST123"
    assert created["customer_id"] == state["customer_id"]
    state["motorcycle_id"] = created["id"]

    response = api.get(f"{BASE_URL}/api/motorcycles", params={"customer_id": state["customer_id"]}, timeout=30)
    assert response.status_code == 200
    rows = response.json()
    assert rows and all(row["customer_id"] == state["customer_id"] for row in rows)
    assert any(row["id"] == created["id"] and row["plate"] == "06TEST123" for row in rows)
    assert_no_mongo_id(rows)


# Create isolated inventory/catalog records used by the service-order workflow.
def test_05_create_test_product_and_service(api, state):
    product_payload = {
        "code": "TEST-PART-001",
        "name": "TEST Brake Pad",
        "brand": "TEST",
        "category": "Fren",
        "cost_price": 50,
        "sale_price": 120,
        "stock": 10,
        "min_stock": 2,
        "unit": "Adet",
        "vat": 20,
    }
    product = api.post(f"{BASE_URL}/api/products", json=product_payload, timeout=30)
    assert product.status_code == 200
    product_data = product.json()
    assert product_data["stock"] == 10
    assert product_data["sale_price"] == 120
    state["product_id"] = product_data["id"]

    service_payload = {"code": "TEST-SVC-001", "name": "TEST Inspection", "description": "QA", "price": 200, "vat": 20}
    service = api.post(f"{BASE_URL}/api/service-catalog", json=service_payload, timeout=30)
    assert service.status_code == 200
    service_data = service.json()
    assert service_data["price"] == 200
    state["service_id"] = service_data["id"]


# Service order totals, number, enrichment, stock decrement, ledger charge, and customer aggregates.
def test_06_service_order_full_create_flow(api, state):
    payload = {
        "customer_id": state["customer_id"],
        "motorcycle_id": state["motorcycle_id"],
        "km": 1500,
        "fault_zones": ["Ön Fren"],
        "complaint": "TEST braking noise",
        "items": [
            {"kind": "part", "ref_id": state["product_id"], "name": "TEST Brake Pad", "qty": 2, "unit_price": 120, "vat": 20},
            {"kind": "service", "ref_id": state["service_id"], "name": "TEST Inspection", "qty": 1, "unit_price": 200, "vat": 20},
        ],
        "labor_total": 50,
        "discount": 10,
        "status": "new",
    }
    response = api.post(f"{BASE_URL}/api/service-orders", json=payload, timeout=30)
    assert response.status_code == 200
    order = response.json()
    assert re.fullmatch(r"SRV-\d{4}-\d{5}", order["service_no"])
    assert order["parts_total"] == 240
    assert order["services_total"] == 200
    assert order["labor_total"] == 50
    assert order["discount"] == 10
    assert order["grand_total"] == 480
    assert order["paid_total"] == 0
    assert order["customer_name"] == "TEST_QA Customer"
    assert order["plate"] == "06TEST123"
    assert order["brand"] == "TEST_Brand"
    assert order["status_history"][0]["status"] == "new"
    state["service_order_id"] = order["id"]
    state["service_no"] = order["service_no"]

    products = api.get(f"{BASE_URL}/api/products", params={"q": "TEST-PART-001"}, timeout=30).json()
    product = next(p for p in products if p["id"] == state["product_id"])
    assert product["stock"] == 8

    customer = api.get(f"{BASE_URL}/api/customers/{state['customer_id']}", timeout=30).json()
    assert customer["total_services"] == 1
    assert customer["total_spent"] == 480
    assert customer["balance"] == 480
    assert any(tx["type"] == "charge" and tx["amount"] == 480 and tx["service_order_id"] == order["id"] for tx in customer["transactions"])


# Service status update persistence and history append.
def test_07_status_change_appends_history(api, state):
    before = api.get(f"{BASE_URL}/api/service-orders/{state['service_order_id']}", timeout=30).json()
    old_len = len(before["status_history"])
    response = api.post(
        f"{BASE_URL}/api/service-orders/{state['service_order_id']}/status",
        json={"status": "in_repair", "note": "TEST started"},
        timeout=30,
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["status"] == "in_repair"
    assert len(updated["status_history"]) == old_len + 1
    assert updated["status_history"][-1]["status"] == "in_repair"
    assert updated["status_history"][-1]["note"] == "TEST started"


# Payment persistence, paid total, negative ledger transaction, and current-account balance.
def test_08_payment_and_current_account_flow(api, state):
    response = api.post(
        f"{BASE_URL}/api/payments",
        json={"customer_id": state["customer_id"], "service_order_id": state["service_order_id"], "amount": 180, "method": "card", "note": "TEST payment"},
        timeout=30,
    )
    assert response.status_code == 200
    payment = response.json()
    assert payment["amount"] == 180
    assert payment["method"] == "card"
    assert payment["payment_no"].startswith("THL-")
    state["payment_id"] = payment["id"]

    order = api.get(f"{BASE_URL}/api/service-orders/{state['service_order_id']}", timeout=30).json()
    assert order["paid_total"] == 180
    assert any(p["id"] == payment["id"] and p["amount"] == 180 for p in order["payments"])

    txs = api.get(f"{BASE_URL}/api/current-accounts/{state['customer_id']}/transactions", timeout=30).json()
    assert any(tx["type"] == "payment" and tx["amount"] == -180 and tx["payment_id"] == payment["id"] for tx in txs)
    assert txs[-1]["running_balance"] == 300

    accounts = api.get(f"{BASE_URL}/api/current-accounts", timeout=30)
    assert accounts.status_code == 200
    row = next(r for r in accounts.json() if r["id"] == state["customer_id"])
    assert row["total_spent"] == 480
    assert row["total_paid"] == 180
    assert row["balance"] == 300


# Reports summary contract and test workflow contribution.
def test_09_reports_summary(api, state):
    response = api.get(f"{BASE_URL}/api/reports/summary", timeout=30)
    assert response.status_code == 200
    data = response.json()
    assert set(data) == {"totals", "top_customers", "top_parts", "top_services", "critical_stock"}
    assert set(data["totals"]) == {"total_revenue", "total_collected", "receivables", "orders_count"}
    assert isinstance(data["top_customers"], list)
    assert isinstance(data["top_parts"], list)
    assert isinstance(data["top_services"], list)
    assert isinstance(data["critical_stock"], list)
    assert data["totals"]["orders_count"] >= 1
    assert all({"name", "qty", "revenue"}.issubset(p) for p in data["top_parts"])
    assert all({"name", "count", "revenue"}.issubset(s) for s in data["top_services"])
    assert_no_mongo_id(data)


# RBAC: admin may create users while non-admin is forbidden from doing so.
def test_10_users_rbac(api, state):
    email = f"test.rbac.user.{uuid.uuid4().hex}@example.com"
    payload = {"email": email, "password": "TEST-pass-123", "name": "TEST RBAC User", "role": "technician"}
    created = api.post(f"{BASE_URL}/api/users", json=payload, timeout=30)
    if created.status_code == 400 and "zaten" in created.text:
        users = api.get(f"{BASE_URL}/api/users", timeout=30).json()
        user = next(u for u in users if u["email"] == email)
    else:
        assert created.status_code == 200
        user = created.json()
    assert user["email"] == email
    assert user["role"] == "technician"
    assert "password_hash" not in user

    non_admin = requests.Session()
    login = non_admin.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "TEST-pass-123"}, timeout=30)
    assert login.status_code == 200
    token = login.json()["token"]
    non_admin.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    denied = non_admin.post(
        f"{BASE_URL}/api/users",
        json={"email": "test.forbidden.2026@example.com", "password": "TEST", "name": "TEST Forbidden", "role": "admin"},
        timeout=30,
    )
    assert denied.status_code == 403
    assert denied.json()["detail"] == "Yetkiniz yok"
    state["non_admin_email"] = email


# Security playbook: stored admin password must use bcrypt $2b$ format.
def test_11_admin_bcrypt_hash_format(state):
    client = MongoClient(backend_env["MONGO_URL"], serverSelectionTimeoutMS=5000)
    try:
        user = client[backend_env["DB_NAME"]].users.find_one({"email": state["admin_email"]})
        assert user is not None
        assert user["password_hash"].startswith("$2b$")
        assert user["role"] == "admin"
    finally:
        client.close()


# Security playbook: an account must lock after five failed password attempts.
def test_12_brute_force_lockout_after_five_failures(state):
    session = requests.Session()
    statuses = []
    for _ in range(6):
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": state["non_admin_email"], "password": "definitely-wrong"},
            timeout=30,
        )
        statuses.append(response.status_code)
    assert statuses[:5] == [401, 401, 401, 401, 401]
    assert statuses[5] in (423, 429), f"Expected lockout response after five failures, got {statuses}"


# Security playbook: credentialed CORS must echo only the trusted frontend origin.
def test_13_cors_uses_explicit_origins():
    trusted = frontend_env.get("REACT_APP_BACKEND_URL")
    trusted_response = requests.options(
        f"{BASE_URL}/api/auth/login",
        headers={"Origin": trusted, "Access-Control-Request-Method": "POST"},
        timeout=30,
    )
    assert trusted_response.status_code in (200, 204)
    assert trusted_response.headers.get("Access-Control-Allow-Origin") == trusted
    assert trusted_response.headers.get("Access-Control-Allow-Credentials") == "true"

    untrusted_response = requests.options(
        f"{BASE_URL}/api/auth/login",
        headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST"},
        timeout=30,
    )
    assert untrusted_response.headers.get("Access-Control-Allow-Origin") is None
