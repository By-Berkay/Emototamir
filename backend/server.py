from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ---------- Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Motosiklet Servis Yönetim Sistemi")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

JWT_ALG = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

# ---------- Helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def uid() -> str:
    return str(uuid.uuid4())

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role, "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def clean(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if doc is None:
        return None
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc

# ---------- Auth Dependency ----------
async def get_current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Yetkisiz erişim")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
        return clean(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")

def require_role(*roles: str):
    async def dep(user=Depends(get_current_user)):
        if user["role"] not in roles and user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Yetkiniz yok")
        return user
    return dep

# ---------- Models ----------
class LoginInput(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "service_advisor"  # admin, service_advisor, technician, accountant

class CustomerIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    first_name: str
    last_name: str
    phone: str
    alt_phone: Optional[str] = ""
    email: Optional[str] = ""
    tc_no: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    district: Optional[str] = ""
    notes: Optional[str] = ""

class MotorcycleIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    customer_id: str
    brand: str
    model: str
    year: Optional[int] = None
    type: str = "Naked"
    engine_cc: Optional[int] = None
    plate: str
    vin: Optional[str] = ""
    engine_no: Optional[str] = ""
    km: int = 0
    color: Optional[str] = ""
    fuel_type: Optional[str] = "Benzin"
    transmission: Optional[str] = "Manuel"
    owner_name: Optional[str] = ""
    notes: Optional[str] = ""

class ServiceItem(BaseModel):
    id: str = Field(default_factory=uid)
    kind: str  # part | service
    ref_id: Optional[str] = None
    name: str
    qty: float = 1
    unit_price: float = 0
    vat: float = 20

class ServiceOrderIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    customer_id: str
    motorcycle_id: str
    km: int = 0
    fuel_level: Optional[str] = "1/2"
    accessories: List[str] = []
    fault_zones: List[str] = []
    complaint: Optional[str] = ""
    diagnosis: Optional[str] = ""
    operations: Optional[str] = ""
    notes: Optional[str] = ""
    items: List[ServiceItem] = []
    labor_total: float = 0
    discount: float = 0
    status: str = "new"

class StatusUpdate(BaseModel):
    status: str
    note: Optional[str] = ""

class PaymentIn(BaseModel):
    customer_id: str
    service_order_id: Optional[str] = None
    amount: float
    method: str = "cash"  # cash, card, transfer, other
    note: Optional[str] = ""

class ProductIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    code: str
    name: str
    brand: Optional[str] = ""
    category: str = "Diğer"
    cost_price: float = 0
    sale_price: float = 0
    stock: float = 0
    min_stock: float = 0
    unit: str = "Adet"
    vat: float = 20
    description: Optional[str] = ""

class ServiceCatalogIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    code: str
    name: str
    description: Optional[str] = ""
    price: float = 0
    vat: float = 20

# ---------- Auth Endpoints ----------
@api.post("/auth/login")
async def login(inp: LoginInput, request: Request, response: Response):
    email = inp.email.lower().strip()
    identifier = f"login:{email}"
    # brute force check
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and locked_until > datetime.now(timezone.utc).isoformat():
            raise HTTPException(status_code=429, detail="Çok fazla hatalı giriş. 15 dk sonra tekrar deneyin.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(inp.password, user["password_hash"]):
        locked_until = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": locked_until}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
    await db.login_attempts.delete_one({"identifier": identifier})
    token = create_access_token(user["id"], user["email"], user["role"])
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=12*3600, path="/")
    return {"token": token, "user": clean(user)}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

# ---------- Users (admin) ----------
@api.get("/users")
async def list_users(user=Depends(require_role("admin"))):
    docs = await db.users.find({}, {"password_hash": 0, "_id": 0}).to_list(500)
    return docs

@api.post("/users")
async def create_user(inp: UserCreate, user=Depends(require_role("admin"))):
    email = inp.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayıtlı")
    doc = {
        "id": uid(), "email": email, "name": inp.name, "role": inp.role,
        "password_hash": hash_password(inp.password), "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return clean(doc)

# ---------- Customers ----------
async def customer_stats(customer_id: str) -> Dict[str, Any]:
    orders = await db.service_orders.find({"customer_id": customer_id}).to_list(10000)
    total_spent = sum(o.get("grand_total", 0) for o in orders)
    total_paid = sum(o.get("paid_total", 0) for o in orders)
    return {
        "total_services": len(orders),
        "total_spent": total_spent,
        "total_paid": total_paid,
        "balance": total_spent - total_paid,
    }

@api.get("/customers")
async def list_customers(q: str = "", user=Depends(get_current_user)):
    query: Dict[str, Any] = {}
    if q:
        query["$or"] = [
            {"first_name": {"$regex": q, "$options": "i"}},
            {"last_name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for d in docs:
        d.update(await customer_stats(d["id"]))
    return docs

@api.post("/customers")
async def create_customer(inp: CustomerIn, user=Depends(get_current_user)):
    doc = inp.model_dump()
    doc["id"] = uid()
    doc["created_at"] = now_iso()
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/customers/{cid}")
async def get_customer(cid: str, user=Depends(get_current_user)):
    d = await db.customers.find_one({"id": cid}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Müşteri bulunamadı")
    d.update(await customer_stats(cid))
    motos = await db.motorcycles.find({"customer_id": cid}, {"_id": 0}).to_list(500)
    orders = await db.service_orders.find({"customer_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    txs = await db.transactions.find({"customer_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {**d, "motorcycles": motos, "service_orders": orders, "transactions": txs}

@api.put("/customers/{cid}")
async def update_customer(cid: str, inp: CustomerIn, user=Depends(get_current_user)):
    r = await db.customers.update_one({"id": cid}, {"$set": inp.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Müşteri bulunamadı")
    return await get_customer(cid, user)

@api.delete("/customers/{cid}")
async def delete_customer(cid: str, user=Depends(require_role("admin"))):
    await db.customers.delete_one({"id": cid})
    return {"ok": True}

# ---------- Motorcycles ----------
async def motorcycle_stats(mid: str):
    orders = await db.service_orders.find({"motorcycle_id": mid}).to_list(1000)
    total_spent = sum(o.get("grand_total", 0) for o in orders)
    last = orders[-1] if orders else None
    return {
        "total_services": len(orders),
        "total_spent": total_spent,
        "last_service_date": last.get("created_at") if last else None,
        "last_km": last.get("km") if last else None,
    }

@api.get("/motorcycles")
async def list_motorcycles(q: str = "", customer_id: str = "", user=Depends(get_current_user)):
    query: Dict[str, Any] = {}
    if customer_id:
        query["customer_id"] = customer_id
    if q:
        query["$or"] = [
            {"plate": {"$regex": q, "$options": "i"}},
            {"vin": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
            {"model": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.motorcycles.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for d in docs:
        c = await db.customers.find_one({"id": d["customer_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "phone": 1})
        d["customer"] = c
        d.update(await motorcycle_stats(d["id"]))
    return docs

@api.post("/motorcycles")
async def create_motorcycle(inp: MotorcycleIn, user=Depends(get_current_user)):
    doc = inp.model_dump()
    doc["id"] = uid()
    doc["plate"] = doc["plate"].upper().replace(" ", "")
    doc["created_at"] = now_iso()
    await db.motorcycles.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/motorcycles/{mid}")
async def get_motorcycle(mid: str, user=Depends(get_current_user)):
    d = await db.motorcycles.find_one({"id": mid}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Motosiklet bulunamadı")
    d.update(await motorcycle_stats(mid))
    d["customer"] = await db.customers.find_one({"id": d["customer_id"]}, {"_id": 0})
    d["service_orders"] = await db.service_orders.find({"motorcycle_id": mid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return d

@api.put("/motorcycles/{mid}")
async def update_motorcycle(mid: str, inp: MotorcycleIn, user=Depends(get_current_user)):
    d = inp.model_dump()
    d["plate"] = d["plate"].upper().replace(" ", "")
    r = await db.motorcycles.update_one({"id": mid}, {"$set": d})
    if r.matched_count == 0:
        raise HTTPException(404, "Motosiklet bulunamadı")
    return await get_motorcycle(mid, user)

@api.delete("/motorcycles/{mid}")
async def delete_motorcycle(mid: str, user=Depends(require_role("admin"))):
    await db.motorcycles.delete_one({"id": mid})
    return {"ok": True}

# ---------- Products (Parts) ----------
@api.get("/products")
async def list_products(q: str = "", user=Depends(get_current_user)):
    query: Dict[str, Any] = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"code": {"$regex": q, "$options": "i"}},
            {"category": {"$regex": q, "$options": "i"}},
        ]
    return await db.products.find(query, {"_id": 0}).to_list(2000)

@api.post("/products")
async def create_product(inp: ProductIn, user=Depends(get_current_user)):
    doc = inp.model_dump()
    doc["id"] = uid()
    doc["created_at"] = now_iso()
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/products/{pid}")
async def update_product(pid: str, inp: ProductIn, user=Depends(get_current_user)):
    r = await db.products.update_one({"id": pid}, {"$set": inp.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Parça bulunamadı")
    return await db.products.find_one({"id": pid}, {"_id": 0})

@api.delete("/products/{pid}")
async def delete_product(pid: str, user=Depends(require_role("admin"))):
    await db.products.delete_one({"id": pid})
    return {"ok": True}

# ---------- Services Catalog ----------
@api.get("/service-catalog")
async def list_services(q: str = "", user=Depends(get_current_user)):
    query: Dict[str, Any] = {}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    return await db.service_catalog.find(query, {"_id": 0}).to_list(1000)

@api.post("/service-catalog")
async def create_service(inp: ServiceCatalogIn, user=Depends(get_current_user)):
    doc = inp.model_dump()
    doc["id"] = uid()
    doc["created_at"] = now_iso()
    await db.service_catalog.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/service-catalog/{sid}")
async def update_service(sid: str, inp: ServiceCatalogIn, user=Depends(get_current_user)):
    r = await db.service_catalog.update_one({"id": sid}, {"$set": inp.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Hizmet bulunamadı")
    return await db.service_catalog.find_one({"id": sid}, {"_id": 0})

@api.delete("/service-catalog/{sid}")
async def delete_service(sid: str, user=Depends(require_role("admin"))):
    await db.service_catalog.delete_one({"id": sid})
    return {"ok": True}

# ---------- Service Orders ----------
def compute_totals(payload: Dict[str, Any]) -> Dict[str, Any]:
    items = payload.get("items", [])
    parts_total = sum(i["qty"] * i["unit_price"] for i in items if i.get("kind") == "part")
    services_total = sum(i["qty"] * i["unit_price"] for i in items if i.get("kind") == "service")
    labor = float(payload.get("labor_total", 0) or 0)
    discount = float(payload.get("discount", 0) or 0)
    grand = parts_total + services_total + labor - discount
    return {
        "parts_total": round(parts_total, 2),
        "services_total": round(services_total, 2),
        "labor_total": round(labor, 2),
        "discount": round(discount, 2),
        "grand_total": round(grand, 2),
    }

async def next_service_no() -> str:
    year = datetime.now(timezone.utc).year
    counter = await db.counters.find_one_and_update(
        {"_id": f"service_order_{year}"},
        {"$inc": {"seq": 1}},
        upsert=True, return_document=True
    )
    seq = counter["seq"] if counter else 1
    return f"SRV-{year}-{seq:05d}"

@api.get("/service-orders")
async def list_service_orders(
    q: str = "", status: str = "", customer_id: str = "",
    payment_status: str = "", user=Depends(get_current_user)
):
    query: Dict[str, Any] = {}
    if customer_id:
        query["customer_id"] = customer_id
    if status:
        query["status"] = status
    if q:
        query["$or"] = [
            {"service_no": {"$regex": q, "$options": "i"}},
            {"plate": {"$regex": q, "$options": "i"}},
            {"customer_name": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.service_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    if payment_status == "unpaid":
        docs = [d for d in docs if (d.get("grand_total", 0) - d.get("paid_total", 0)) > 0.01]
    elif payment_status == "paid":
        docs = [d for d in docs if (d.get("grand_total", 0) - d.get("paid_total", 0)) <= 0.01]
    return docs

@api.post("/service-orders")
async def create_service_order(inp: ServiceOrderIn, user=Depends(get_current_user)):
    cust = await db.customers.find_one({"id": inp.customer_id}, {"_id": 0})
    moto = await db.motorcycles.find_one({"id": inp.motorcycle_id}, {"_id": 0})
    if not cust or not moto:
        raise HTTPException(400, "Müşteri veya motosiklet bulunamadı")
    payload = inp.model_dump()
    totals = compute_totals(payload)
    doc = {
        **payload,
        **totals,
        "id": uid(),
        "service_no": await next_service_no(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "customer_name": f"{cust['first_name']} {cust['last_name']}",
        "customer_phone": cust.get("phone"),
        "plate": moto.get("plate"),
        "brand": moto.get("brand"),
        "model": moto.get("model"),
        "moto_type": moto.get("type"),
        "paid_total": 0,
        "status_history": [{"status": inp.status, "at": now_iso(), "by": user["email"]}],
    }
    # decrement stock
    for it in payload.get("items", []):
        if it.get("kind") == "part" and it.get("ref_id"):
            await db.products.update_one({"id": it["ref_id"]}, {"$inc": {"stock": -float(it["qty"])}})
    # update moto km
    if inp.km:
        await db.motorcycles.update_one({"id": inp.motorcycle_id}, {"$set": {"km": inp.km}})
    await db.service_orders.insert_one(doc)
    # ledger: create receivable
    if doc["grand_total"] > 0:
        await db.transactions.insert_one({
            "id": uid(), "customer_id": inp.customer_id, "type": "charge",
            "amount": doc["grand_total"], "service_order_id": doc["id"],
            "service_no": doc["service_no"],
            "description": f"Servis: {doc['service_no']}",
            "created_at": now_iso(),
        })
    await db.audit_logs.insert_one({
        "id": uid(), "user": user["email"], "action": "service_order.create",
        "entity_id": doc["id"], "at": now_iso(),
    })
    doc.pop("_id", None)
    return doc

@api.get("/service-orders/{sid}")
async def get_service_order(sid: str, user=Depends(get_current_user)):
    d = await db.service_orders.find_one({"id": sid}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Servis kaydı bulunamadı")
    d["customer"] = await db.customers.find_one({"id": d["customer_id"]}, {"_id": 0})
    d["motorcycle"] = await db.motorcycles.find_one({"id": d["motorcycle_id"]}, {"_id": 0})
    d["payments"] = await db.payments.find({"service_order_id": sid}, {"_id": 0}).to_list(500)
    return d

@api.put("/service-orders/{sid}")
async def update_service_order(sid: str, inp: ServiceOrderIn, user=Depends(get_current_user)):
    existing = await db.service_orders.find_one({"id": sid})
    if not existing:
        raise HTTPException(404, "Servis kaydı bulunamadı")
    payload = inp.model_dump()
    totals = compute_totals(payload)
    upd = {**payload, **totals, "updated_at": now_iso()}
    await db.service_orders.update_one({"id": sid}, {"$set": upd})
    # adjust ledger charge amount if changed
    diff = totals["grand_total"] - existing.get("grand_total", 0)
    if abs(diff) > 0.01:
        await db.transactions.insert_one({
            "id": uid(), "customer_id": existing["customer_id"], "type": "adjust",
            "amount": diff, "service_order_id": sid, "service_no": existing["service_no"],
            "description": f"Servis tutarı güncellendi: {existing['service_no']}",
            "created_at": now_iso(),
        })
    return await get_service_order(sid, user)

@api.post("/service-orders/{sid}/status")
async def change_status(sid: str, inp: StatusUpdate, user=Depends(get_current_user)):
    d = await db.service_orders.find_one({"id": sid})
    if not d:
        raise HTTPException(404, "Servis kaydı bulunamadı")
    history = d.get("status_history", [])
    history.append({"status": inp.status, "at": now_iso(), "by": user["email"], "note": inp.note})
    await db.service_orders.update_one({"id": sid},
        {"$set": {"status": inp.status, "status_history": history, "updated_at": now_iso()}})
    await db.audit_logs.insert_one({
        "id": uid(), "user": user["email"], "action": "service_order.status_change",
        "entity_id": sid, "old_value": d.get("status"), "new_value": inp.status, "at": now_iso(),
    })
    return await get_service_order(sid, user)

@api.delete("/service-orders/{sid}")
async def delete_service_order(sid: str, user=Depends(require_role("admin"))):
    await db.service_orders.update_one({"id": sid}, {"$set": {"status": "cancelled", "updated_at": now_iso()}})
    return {"ok": True}

# ---------- Payments ----------
@api.get("/payments")
async def list_payments(customer_id: str = "", user=Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if customer_id:
        q["customer_id"] = customer_id
    return await db.payments.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)

@api.post("/payments")
async def create_payment(inp: PaymentIn, user=Depends(get_current_user)):
    if inp.amount <= 0:
        raise HTTPException(400, "Tahsilat tutarı pozitif olmalıdır")
    payment_no = f"THL-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    doc = {
        **inp.model_dump(),
        "id": uid(),
        "payment_no": payment_no,
        "created_at": now_iso(),
        "created_by": user["email"],
    }
    await db.payments.insert_one(doc)
    if inp.service_order_id:
        so = await db.service_orders.find_one({"id": inp.service_order_id})
        if so:
            new_paid = so.get("paid_total", 0) + inp.amount
            await db.service_orders.update_one({"id": inp.service_order_id},
                {"$set": {"paid_total": new_paid, "updated_at": now_iso()}})
    await db.transactions.insert_one({
        "id": uid(), "customer_id": inp.customer_id, "type": "payment",
        "amount": -inp.amount, "service_order_id": inp.service_order_id,
        "payment_id": doc["id"], "payment_no": payment_no,
        "description": f"Tahsilat ({inp.method})",
        "created_at": now_iso(),
    })
    doc.pop("_id", None)
    return doc

# ---------- Current Accounts ----------
@api.get("/current-accounts")
async def current_accounts(user=Depends(get_current_user)):
    customers = await db.customers.find({}, {"_id": 0}).to_list(5000)
    rows = []
    for c in customers:
        stats = await customer_stats(c["id"])
        if stats["balance"] > 0.01 or stats["total_services"] > 0:
            rows.append({**c, **stats})
    rows.sort(key=lambda x: -x["balance"])
    return rows

@api.get("/current-accounts/{cid}/transactions")
async def get_transactions(cid: str, user=Depends(get_current_user)):
    txs = await db.transactions.find({"customer_id": cid}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    bal = 0
    for t in txs:
        bal += t["amount"]
        t["running_balance"] = round(bal, 2)
    return txs

# ---------- Dashboard ----------
@api.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    orders = await db.service_orders.find({}, {"_id": 0}).to_list(20000)
    payments = await db.payments.find({}, {"_id": 0}).to_list(20000)
    today = datetime.now(timezone.utc).date().isoformat()
    month_prefix = datetime.now(timezone.utc).strftime("%Y-%m")

    def is_today(o):
        return (o.get("created_at") or "")[:10] == today

    open_statuses = {"new", "diagnosed", "pricing", "awaiting_approval", "approved", "in_repair", "parts_waiting"}
    delivery_statuses = {"completed", "awaiting_delivery"}

    kpi = {
        "today_services": sum(1 for o in orders if is_today(o)),
        "open_services": sum(1 for o in orders if o.get("status") in open_statuses),
        "completed_services": sum(1 for o in orders if o.get("status") == "delivered"),
        "awaiting_delivery": sum(1 for o in orders if o.get("status") in delivery_statuses),
        "today_collection": sum(p["amount"] for p in payments if (p.get("created_at") or "")[:10] == today),
        "month_revenue": sum(o.get("grand_total", 0) for o in orders if (o.get("created_at") or "").startswith(month_prefix)),
        "total_receivables": sum(max(0, o.get("grand_total", 0) - o.get("paid_total", 0)) for o in orders),
        "unpaid_count": sum(1 for o in orders if (o.get("grand_total", 0) - o.get("paid_total", 0)) > 0.01),
    }

    # Monthly revenue last 12 months
    monthly = {}
    now = datetime.now(timezone.utc)
    for i in range(11, -1, -1):
        y = now.year
        m = now.month - i
        while m <= 0:
            m += 12
            y -= 1
        key = f"{y:04d}-{m:02d}"
        monthly[key] = 0
    for o in orders:
        k = (o.get("created_at") or "")[:7]
        if k in monthly:
            monthly[k] += o.get("grand_total", 0)
    monthly_series = [{"month": k, "revenue": round(v, 2)} for k, v in monthly.items()]

    status_counts: Dict[str, int] = {}
    for o in orders:
        status_counts[o.get("status", "new")] = status_counts.get(o.get("status", "new"), 0) + 1
    status_series = [{"status": k, "count": v} for k, v in status_counts.items()]

    # Top operations
    op_counts: Dict[str, int] = {}
    for o in orders:
        for it in o.get("items", []):
            if it.get("kind") == "service":
                op_counts[it["name"]] = op_counts.get(it["name"], 0) + int(it.get("qty", 1))
    top_ops = sorted(op_counts.items(), key=lambda x: -x[1])[:6]
    top_operations = [{"name": n, "count": c} for n, c in top_ops]

    recent = sorted(orders, key=lambda o: o.get("created_at") or "", reverse=True)[:10]

    return {
        "kpi": kpi,
        "monthly_revenue": monthly_series,
        "status_distribution": status_series,
        "top_operations": top_operations,
        "recent_orders": recent,
    }

# ---------- Reports ----------
@api.get("/reports/summary")
async def report_summary(user=Depends(get_current_user)):
    orders = await db.service_orders.find({}, {"_id": 0}).to_list(20000)
    payments = await db.payments.find({}, {"_id": 0}).to_list(20000)
    products = await db.products.find({}, {"_id": 0}).to_list(5000)

    # Top customers by spend
    by_customer: Dict[str, Dict[str, Any]] = {}
    for o in orders:
        k = o.get("customer_id")
        if not k: continue
        row = by_customer.setdefault(k, {"customer_id": k, "customer_name": o.get("customer_name"), "count": 0, "spent": 0})
        row["count"] += 1
        row["spent"] += o.get("grand_total", 0)
    top_customers = sorted(by_customer.values(), key=lambda x: -x["spent"])[:10]

    # Top parts
    part_use: Dict[str, Dict[str, Any]] = {}
    for o in orders:
        for it in o.get("items", []):
            if it.get("kind") == "part":
                row = part_use.setdefault(it["name"], {"name": it["name"], "qty": 0, "revenue": 0})
                row["qty"] += it.get("qty", 0)
                row["revenue"] += it.get("qty", 0) * it.get("unit_price", 0)
    top_parts = sorted(part_use.values(), key=lambda x: -x["qty"])[:10]

    # Critical stock
    critical_stock = [p for p in products if p.get("stock", 0) <= p.get("min_stock", 0)]

    # Top services
    svc_use: Dict[str, Dict[str, Any]] = {}
    for o in orders:
        for it in o.get("items", []):
            if it.get("kind") == "service":
                row = svc_use.setdefault(it["name"], {"name": it["name"], "count": 0, "revenue": 0})
                row["count"] += it.get("qty", 0)
                row["revenue"] += it.get("qty", 0) * it.get("unit_price", 0)
    top_services = sorted(svc_use.values(), key=lambda x: -x["revenue"])[:10]

    total_revenue = sum(o.get("grand_total", 0) for o in orders)
    total_collected = sum(p.get("amount", 0) for p in payments)
    return {
        "totals": {
            "total_revenue": round(total_revenue, 2),
            "total_collected": round(total_collected, 2),
            "receivables": round(total_revenue - total_collected, 2),
            "orders_count": len(orders),
        },
        "top_customers": top_customers,
        "top_parts": top_parts,
        "top_services": top_services,
        "critical_stock": critical_stock,
    }

# ---------- Seeding ----------
async def seed_admin_and_indexes():
    await db.users.create_index("email", unique=True)
    await db.customers.create_index("phone")
    await db.motorcycles.create_index("plate")
    await db.motorcycles.create_index("vin")
    await db.service_orders.create_index("service_no")
    await db.service_orders.create_index("customer_id")
    await db.service_orders.create_index("motorcycle_id")

    email = os.environ.get("ADMIN_EMAIL", "admin@servis.com").lower()
    pwd = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    name = os.environ.get("ADMIN_NAME", "Admin")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "id": uid(), "email": email, "name": name, "role": "admin",
            "password_hash": hash_password(pwd), "created_at": now_iso(),
        })
        logger.info(f"Admin oluşturuldu: {email}")
    elif not verify_password(pwd, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pwd)}})

async def seed_demo_data():
    if await db.customers.count_documents({}) > 0:
        return
    import random
    random.seed(42)

    demo_customers = [
        ("Ahmet", "Yılmaz", "05321112233", "İstanbul", "Kadıköy"),
        ("Mehmet", "Kaya", "05334445566", "İstanbul", "Beşiktaş"),
        ("Ayşe", "Demir", "05427778899", "Ankara", "Çankaya"),
        ("Fatma", "Şahin", "05356667788", "İzmir", "Karşıyaka"),
        ("Mustafa", "Çelik", "05061234567", "Bursa", "Nilüfer"),
        ("Ali", "Doğan", "05439998877", "Antalya", "Muratpaşa"),
        ("Zeynep", "Aydın", "05321119988", "İstanbul", "Şişli"),
        ("Emre", "Kurt", "05559871122", "Kocaeli", "İzmit"),
        ("Selin", "Öztürk", "05467773322", "Ankara", "Keçiören"),
        ("Hakan", "Arslan", "05384451199", "İzmir", "Bornova"),
    ]
    types = ["Scooter", "Naked", "Sport", "Touring", "Adventure", "Enduro", "Cruiser", "Cafe Racer", "Elektrikli"]
    brands = [("Honda", ["PCX 125", "CBR 500R", "CB 650R"]),
              ("Yamaha", ["MT-07", "R25", "NMAX 155"]),
              ("Kawasaki", ["Z900", "Ninja 400"]),
              ("KTM", ["Duke 390", "Adventure 390"]),
              ("BMW", ["G 310 R", "F 750 GS"])]

    cust_ids = []
    for fn, ln, ph, city, dist in demo_customers:
        cid = uid()
        cust_ids.append(cid)
        await db.customers.insert_one({
            "id": cid, "first_name": fn, "last_name": ln, "phone": ph,
            "email": f"{fn.lower()}@example.com", "city": city, "district": dist,
            "address": f"{dist} Mah. {random.randint(1,50)}. Sk. No:{random.randint(1,80)}",
            "created_at": now_iso(),
        })

    moto_ids = []
    for i in range(15):
        cid = random.choice(cust_ids)
        brand, models = random.choice(brands)
        model = random.choice(models)
        mid = uid()
        moto_ids.append((mid, cid, brand, model))
        await db.motorcycles.insert_one({
            "id": mid, "customer_id": cid, "brand": brand, "model": model,
            "year": random.randint(2015, 2025), "type": random.choice(types),
            "engine_cc": random.choice([125, 250, 400, 650, 900]),
            "plate": f"{random.randint(1,81):02d}{random.choice(['ABC','MTR','SPT','MRT'])}{random.randint(100,999)}",
            "vin": f"VIN{random.randint(10**16, 10**17-1)}",
            "km": random.randint(1000, 50000), "color": random.choice(["Siyah","Beyaz","Kırmızı","Mavi"]),
            "fuel_type": "Benzin", "transmission": "Manuel",
            "created_at": now_iso(),
        })

    parts = [
        ("MY-001", "Motor Yağı 10W-40", "Motor Yağı", 350, 550, 45),
        ("MY-002", "Motor Yağı 20W-50", "Motor Yağı", 320, 490, 30),
        ("FL-001", "Yağ Filtresi", "Filtre", 120, 220, 60),
        ("FL-002", "Hava Filtresi", "Filtre", 180, 290, 40),
        ("FR-001", "Ön Fren Balatası", "Fren", 250, 420, 25),
        ("FR-002", "Arka Fren Balatası", "Fren", 220, 380, 25),
        ("BJ-001", "NGK Buji", "Buji", 90, 180, 80),
        ("AK-001", "Yuasa Akü 12V", "Akü", 950, 1450, 12),
        ("ZN-001", "Zincir Seti", "Zincir", 850, 1350, 15),
        ("LS-001", "Ön Lastik 120/70", "Lastik", 1450, 2150, 10),
        ("LS-002", "Arka Lastik 180/55", "Lastik", 1850, 2650, 8),
        ("EL-001", "Regülatör", "Elektrik", 450, 750, 6),
        ("EL-002", "Marş Motoru", "Elektrik", 1450, 2250, 3),
        ("SP-001", "Ön Amortisör Yağı", "Süspansiyon", 180, 320, 20),
        ("DI-001", "Zincir Dişlisi Seti", "Dişli", 480, 780, 15),
        ("BJ-002", "Ateşleme Bobini", "Elektrik", 380, 620, 10),
        ("MT-001", "Motor Contası", "Motor", 250, 420, 8),
        ("EG-001", "Egzoz Contası", "Egzoz", 120, 220, 25),
        ("KP-001", "Ön Panel", "Kaporta", 850, 1350, 5),
        ("KP-002", "Ayna Sağ", "Kaporta", 180, 320, 20),
    ]
    product_ids = []
    for code, name, cat, cost, sale, stock in parts:
        pid = uid()
        product_ids.append((pid, name, sale))
        await db.products.insert_one({
            "id": pid, "code": code, "name": name, "brand": "Genel", "category": cat,
            "cost_price": cost, "sale_price": sale, "stock": stock, "min_stock": 5,
            "unit": "Adet", "vat": 20, "created_at": now_iso(),
        })

    services = [
        ("HZM-001", "Periyodik Bakım", 1500),
        ("HZM-002", "Yağ Değişimi", 350),
        ("HZM-003", "Fren Bakımı", 450),
        ("HZM-004", "Zincir Değişimi", 550),
        ("HZM-005", "Lastik Değişimi", 400),
        ("HZM-006", "Elektrik Arıza Tespiti", 600),
        ("HZM-007", "Motor Revizyonu", 3500),
        ("HZM-008", "Buji Değişimi", 250),
        ("HZM-009", "Akü Değişimi", 200),
        ("HZM-010", "Genel Kontrol", 300),
    ]
    service_ids = []
    for code, name, price in services:
        sid = uid()
        service_ids.append((sid, name, price))
        await db.service_catalog.insert_one({
            "id": sid, "code": code, "name": name, "description": name,
            "price": price, "vat": 20, "created_at": now_iso(),
        })

    statuses = ["new", "diagnosed", "in_repair", "completed", "delivered", "delivered", "delivered", "awaiting_delivery"]
    faults_choices = ["Ön Fren", "Arka Fren", "Motor", "Elektrik", "Akü", "Yakıt Sistemi", "Egzoz"]
    complaints_pool = [
        "Motor çalışırken stop ediyor.",
        "Fren tutmuyor, ses geliyor.",
        "Akü sürekli boşalıyor.",
        "Ateşleme problemi var.",
        "Zincir gevşemiş.",
        "Egzozdan siyah duman çıkıyor.",
        "Sinyaller çalışmıyor.",
        "Marş atmıyor.",
    ]

    for _ in range(30):
        mid, cid, brand, model = random.choice(moto_ids)
        cust = await db.customers.find_one({"id": cid})
        moto = await db.motorcycles.find_one({"id": mid})
        items = []
        for _ in range(random.randint(1, 3)):
            pid, pname, price = random.choice(product_ids)
            items.append({
                "id": uid(), "kind": "part", "ref_id": pid, "name": pname,
                "qty": random.randint(1, 2), "unit_price": price, "vat": 20,
            })
        for _ in range(random.randint(1, 2)):
            svid, sname, sprice = random.choice(service_ids)
            items.append({
                "id": uid(), "kind": "service", "ref_id": svid, "name": sname,
                "qty": 1, "unit_price": sprice, "vat": 20,
            })
        labor = random.choice([0, 250, 500, 750])
        payload = {"items": items, "labor_total": labor, "discount": random.choice([0, 0, 0, 100, 200])}
        totals = compute_totals(payload)
        status = random.choice(statuses)
        created_at = (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 120))).isoformat()
        so_no = await next_service_no()
        so_id = uid()
        grand = totals["grand_total"]
        paid = grand if status == "delivered" and random.random() > 0.3 else (grand * random.choice([0, 0.5, 0.7]) if random.random() > 0.4 else 0)
        so = {
            "id": so_id, "service_no": so_no, "customer_id": cid, "motorcycle_id": mid,
            "customer_name": f"{cust['first_name']} {cust['last_name']}",
            "customer_phone": cust["phone"], "plate": moto["plate"], "brand": moto["brand"],
            "model": moto["model"], "moto_type": moto["type"], "km": moto["km"],
            "fuel_level": random.choice(["1/4", "1/2", "3/4", "Dolu"]),
            "accessories": random.sample(["Kask", "Telefon Tutucu", "Çanta", "Topcase"], k=random.randint(0, 2)),
            "fault_zones": random.sample(faults_choices, k=random.randint(1, 3)),
            "complaint": random.choice(complaints_pool),
            "diagnosis": "Arıza tespiti yapıldı, gerekli parçalar değişecek.",
            "operations": "Bakım ve arızalı parça değişimi.",
            "items": items, **totals, "status": status,
            "paid_total": round(paid, 2), "created_at": created_at, "updated_at": created_at,
            "status_history": [{"status": status, "at": created_at, "by": os.environ.get("ADMIN_EMAIL", "system")}],
        }
        await db.service_orders.insert_one(so)
        await db.transactions.insert_one({
            "id": uid(), "customer_id": cid, "type": "charge",
            "amount": grand, "service_order_id": so_id, "service_no": so_no,
            "description": f"Servis: {so_no}", "created_at": created_at,
        })
        if paid > 0:
            payment_no = f"THL-{random.randint(10**11, 10**12-1)}"
            await db.payments.insert_one({
                "id": uid(), "payment_no": payment_no, "customer_id": cid,
                "service_order_id": so_id, "amount": paid,
                "method": random.choice(["cash", "card", "transfer"]),
                "created_at": created_at, "created_by": os.environ.get("ADMIN_EMAIL", "system"),
            })
            await db.transactions.insert_one({
                "id": uid(), "customer_id": cid, "type": "payment",
                "amount": -paid, "service_order_id": so_id, "service_no": so_no,
                "payment_no": payment_no, "description": "Tahsilat",
                "created_at": created_at,
            })
    logger.info("Demo veri yüklendi.")

@app.on_event("startup")
async def on_startup():
    await seed_admin_and_indexes()
    await seed_demo_data()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Include routes
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)
