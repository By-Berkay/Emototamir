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
from typing import List, Optional, Any, Dict, Union, Literal
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query, UploadFile, File, Form, Header
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
import io
import re
import secrets

from storage_utils import put_object, get_object, init_storage, APP_NAME
from pdf_utils import build_service_pdf, build_inspection_pdf
from default_catalog import DEFAULT_PRODUCTS, DEFAULT_SERVICES
from totals import compute_document_totals, validate_money_fields, DEFAULT_PRICE_MODE, DEFAULT_VAT

# ---------- Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Üretimde API dokümantasyonu kapalıdır (ENABLE_API_DOCS=1 ile açılabilir).
app = FastAPI(title="Motosiklet Servis Yönetim Sistemi",
              docs_url="/api/docs" if os.environ.get("ENABLE_API_DOCS") == "1" else None,
              redoc_url=None,
              openapi_url="/api/openapi.json" if os.environ.get("ENABLE_API_DOCS") == "1" else None)
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

JWT_ALG = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
WEBHOOK_CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET", "")

# ---------- Helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def uid() -> str:
    return str(uuid.uuid4())

def _diff_dicts(old: dict, new: dict, ignore: set = None) -> List[Dict[str, Any]]:
    """Return a list of {field, old, new} for changed fields (shallow)."""
    ignore = ignore or set()
    out = []
    keys = set((old or {}).keys()) | set((new or {}).keys())
    for k in sorted(keys):
        if k in ignore or k.startswith("_"):
            continue
        ov = (old or {}).get(k)
        nv = (new or {}).get(k)
        if ov == nv:
            continue
        if not ov and not nv:
            continue
        def _t(v):
            if isinstance(v, (dict, list)):
                s = str(v); return s[:200] + "…" if len(s) > 200 else s
            s = str(v) if v is not None else ""
            return s[:200] + "…" if len(s) > 200 else s
        out.append({"field": k, "old": _t(ov), "new": _t(nv)})
    return out

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str, tenant_id: Optional[str] = None) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role, "type": "access",
        "tenant_id": tenant_id,
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
    return await _user_from_token(token)

async def get_current_user_flex(request: Request) -> Dict[str, Any]:
    """Token yalnızca Authorization başlığı veya çerezden okunur (URL'de token taşınmaz)."""
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Yetkisiz erişim")
    return await _user_from_token(token)

async def _user_from_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
        # Firma silinmiş ya da pasifleştirilmişse, süresi dolmamış token da geçersiz sayılır
        if user.get("role") != "super_admin" and user.get("tenant_id"):
            tenant = await db.tenants.find_one({"id": user["tenant_id"]}, {"_id": 0, "is_active": 1})
            if not tenant or tenant.get("is_active") is False:
                raise HTTPException(status_code=403, detail="Firma hesabı pasif veya kaldırılmış")
        return clean(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")

def require_role(*roles: str):
    async def dep(user=Depends(get_current_user)):
        r = user.get("role")
        if r not in roles and r != "admin" and r != "super_admin":
            raise HTTPException(status_code=403, detail="Yetkiniz yok")
        return user
    return dep

def require_super_admin(user=Depends(get_current_user)):
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Sadece Süper Admin erişebilir")
    return user

def tf(user, q: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Tenant filter — adds tenant_id to query for scoped access."""
    q = dict(q or {})
    if user.get("role") == "super_admin":
        # super_admin sees only super-admin scoped things (none by default); explicit tenant param handled elsewhere
        raise HTTPException(403, "Süper Admin bu ekrana erişemez. Firma seçin.")
    if not user.get("tenant_id"):
        raise HTTPException(403, "Firma atanmamış kullanıcı")
    q["tenant_id"] = user["tenant_id"]
    return q

def tenant_id_of(user) -> str:
    tid = user.get("tenant_id")
    if not tid:
        raise HTTPException(403, "Firma atanmamış kullanıcı")
    return tid

# ---------- İş kuralları sabitleri ----------
# Türkiye saati (UTC+03). Türkiye 2016'dan beri yaz saati uygulamadığı için sabit ofset yeterli.
TR_TZ = timezone(timedelta(hours=3), name="Europe/Istanbul")
TENANT_ROLES = {"admin", "service_advisor", "technician", "accountant"}
ORDER_STATUSES = {
    "new", "diagnosed", "pricing", "awaiting_approval", "approved", "in_repair",
    "parts_waiting", "completed", "awaiting_delivery", "delivered", "cancelled",
}
PRE_APPROVAL_STATUSES = {"new", "diagnosed", "pricing", "awaiting_approval"}
CLOSED_STATUSES = {"delivered", "cancelled"}
RESTRICTED_TENANT_FIELDS = {"plan", "is_active", "trial_ends_at", "subscription_ends_at", "billing_notes"}
GLOBAL_APPLY_FIELDS = {
    "subtitle", "theme", "primary_color", "secondary_color", "font_family", "custom_labels",
    "pdf_template", "custom_fault_zones", "reminder_km", "reminder_months", "reminder_mode",
}

def local_today() -> str:
    return datetime.now(TR_TZ).date().isoformat()

def local_day_of(iso: Optional[str]) -> str:
    """ISO zaman damgasını Türkiye takvim gününe (YYYY-MM-DD) çevirir."""
    if not iso:
        return ""
    try:
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.astimezone(TR_TZ).date().isoformat()
    except ValueError:
        return iso[:10]

def local_month_now() -> str:
    return local_today()[:7]

# ---------- Models ----------
class LoginInput(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "service_advisor"  # admin, service_advisor, technician, accountant

class TenantIn(BaseModel):
    name: str
    slug: Optional[str] = ""
    subtitle: Optional[str] = "YETKİLİ SERVİS & SHOWROOM"
    address: Optional[str] = ""
    city: Optional[str] = ""
    district: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    tax_no: Optional[str] = ""
    bank_name: Optional[str] = ""
    bank_account_name: Optional[str] = ""
    iban: Optional[str] = ""
    logo_path: Optional[str] = ""
    primary_color: Optional[str] = "#F97316"
    secondary_color: Optional[str] = "#0F172A"
    theme: Optional[str] = "orange"
    font_family: Optional[str] = "IBM Plex Sans"
    custom_fault_zones: List[Dict[str, Any]] = []
    custom_moto_images: Dict[str, str] = {}
    custom_labels: Dict[str, str] = {}  # override any UI label
    pdf_template: Optional[Dict[str, Any]] = {}  # custom pdf template overrides
    # Subscription / plan
    plan: Optional[str] = "trial"  # trial | basic | pro | enterprise
    trial_ends_at: Optional[str] = None  # ISO date
    subscription_ends_at: Optional[str] = None  # ISO date
    is_active: Optional[bool] = True
    billing_notes: Optional[str] = ""
    # Reminder policy
    reminder_km: Optional[int] = 5000
    reminder_months: Optional[int] = 6
    reminder_mode: Optional[str] = "or"  # "or" or "and"

class TenantCloneIn(BaseModel):
    new_name: str
    new_slug: Optional[str] = ""
    admin_email: EmailStr
    admin_password: str
    admin_name: str
    include_products: bool = True
    include_services: bool = True

class TenantCreateWithAdmin(TenantIn):
    admin_email: EmailStr
    admin_password: str
    admin_name: str

MIN_PASSWORD_LEN = 8

class PasswordResetIn(BaseModel):
    new_password: str

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str

class GlobalApplyIn(BaseModel):
    fields: Dict[str, Any]  # subset of tenant fields
    tenant_ids: Optional[List[str]] = None  # None = all

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
    price_mode: str = DEFAULT_PRICE_MODE  # incl (KDV dahil) | excl (KDV hariç)
    vat: float = DEFAULT_VAT

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
    labor_price_mode: str = DEFAULT_PRICE_MODE
    labor_vat: float = DEFAULT_VAT
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

class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    method: Optional[str] = None
    note: Optional[str] = None

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
    vat: float = Field(default=DEFAULT_VAT, ge=0, le=100)
    price_mode: Literal["incl", "excl"] = DEFAULT_PRICE_MODE  # KDV dahil (varsayılan) | KDV hariç
    description: Optional[str] = ""

class ServiceCatalogIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    code: str
    name: str
    description: Optional[str] = ""
    price: float = 0
    vat: float = Field(default=DEFAULT_VAT, ge=0, le=100)
    price_mode: Literal["incl", "excl"] = DEFAULT_PRICE_MODE  # KDV dahil (varsayılan) | KDV hariç

# ---------- Auth Endpoints ----------
@api.post("/auth/login")
async def login(inp: LoginInput, request: Request, response: Response):
    email = inp.email.lower().strip()
    identifier = f"login:{email}"
    now = datetime.now(timezone.utc)
    # Kaba kuvvet koruması: 5 hatalı denemeden sonra 15 dk kilit.
    # Sayaç yalnızca son hatalı denemeden sonra 15 dk içindeyse birikir; aksi halde sıfırlanır.
    attempt = await db.login_attempts.find_one({"identifier": identifier}) or {}
    locked_until = attempt.get("locked_until")
    if locked_until and locked_until > now.isoformat():
        raise HTTPException(status_code=429, detail="Çok fazla hatalı giriş. 15 dk sonra tekrar deneyin.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(inp.password, user["password_hash"]):
        last_failed = attempt.get("last_failed_at")
        window_expired = not last_failed or (now - datetime.fromisoformat(last_failed)) > timedelta(minutes=15)
        count = 1 if window_expired else attempt.get("count", 0) + 1
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$set": {
                "count": count,
                "last_failed_at": now.isoformat(),
                "locked_until": (now + timedelta(minutes=15)).isoformat() if count >= 5 else None,
            }},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
    await db.login_attempts.delete_one({"identifier": identifier})
    # subscription/active check for tenant users (super_admin is exempt)
    if user.get("role") != "super_admin" and user.get("tenant_id"):
        tenant = await db.tenants.find_one({"id": user["tenant_id"]}, {"_id": 0})
        if not tenant:
            raise HTTPException(status_code=403, detail="Firma bulunamadı veya kaldırılmış. Süper Admin ile iletişime geçin.")
        if tenant:
            if tenant.get("is_active") is False:
                raise HTTPException(status_code=403, detail="Firma hesabınız pasif. Süper Admin ile iletişime geçin.")
            ends = tenant.get("subscription_ends_at") or tenant.get("trial_ends_at")
            if ends:
                try:
                    ends_dt = datetime.fromisoformat(ends.replace("Z", "+00:00"))
                    if ends_dt < datetime.now(timezone.utc):
                        # auto-deactivate on expiry
                        await db.tenants.update_one({"id": user["tenant_id"]}, {"$set": {"is_active": False}})
                        raise HTTPException(status_code=403, detail="Firma aboneliği sona erdi. Süper Admin ile iletişime geçin.")
                except HTTPException:
                    raise
                except Exception:
                    pass
    token = create_access_token(user["id"], user["email"], user["role"], user.get("tenant_id"))
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=12*3600, path="/")
    # attach tenant info to response
    tenant = None
    if user.get("tenant_id"):
        tenant = await db.tenants.find_one({"id": user["tenant_id"]}, {"_id": 0})
    return {"token": token, "user": clean(user), "tenant": tenant}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

class PinIn(BaseModel):
    pin: str
    current_pin: Optional[str] = None

def _valid_pin(pin: str) -> bool:
    return bool(re.fullmatch(r"\d{4}", pin or ""))

@api.get("/auth/pin/status")
async def pin_status(user=Depends(get_current_user)):
    doc = await db.users.find_one({"id": user["id"]}, {"_id": 0, "pin_hash": 1})
    return {"has_pin": bool(doc and doc.get("pin_hash"))}

@api.put("/auth/pin")
async def set_pin(inp: PinIn, user=Depends(get_current_user)):
    """4 haneli yönetici PIN'i. PIN zaten varsa mevcut PIN ile değiştirilir."""
    if not _valid_pin(inp.pin):
        raise HTTPException(400, "PIN 4 haneli rakamlardan oluşmalıdır")
    doc = await db.users.find_one({"id": user["id"]}, {"_id": 0, "pin_hash": 1})
    if doc and doc.get("pin_hash"):
        if not inp.current_pin or not verify_password(inp.current_pin, doc["pin_hash"]):
            raise HTTPException(400, "Mevcut PIN hatalı")
    await db.users.update_one({"id": user["id"]}, {"$set": {"pin_hash": hash_password(inp.pin)}})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": user.get("tenant_id"), "user": user["email"],
        "action": "user.pin_set", "entity_id": user["id"], "at": now_iso(),
    })
    return {"ok": True}

@api.post("/auth/pin/verify")
async def verify_pin(inp: PinIn, user=Depends(get_current_user)):
    """Yönetici PIN'ini doğrular. 5 hatalı denemeden sonra 15 dk kilitlenir."""
    key = f"pin:{user['id']}"
    now = datetime.now(timezone.utc)
    attempt = await db.login_attempts.find_one({"identifier": key}) or {}
    if attempt.get("locked_until") and attempt["locked_until"] > now.isoformat():
        raise HTTPException(429, "Çok fazla hatalı PIN. 15 dk sonra tekrar deneyin.")
    doc = await db.users.find_one({"id": user["id"]}, {"_id": 0, "pin_hash": 1})
    if not doc or not doc.get("pin_hash"):
        raise HTTPException(400, "Önce PIN belirleyin")
    if not _valid_pin(inp.pin) or not verify_password(inp.pin, doc["pin_hash"]):
        count = attempt.get("count", 0) + 1
        await db.login_attempts.update_one(
            {"identifier": key},
            {"$set": {"count": count, "locked_until": (now + timedelta(minutes=15)).isoformat() if count >= 5 else None}},
            upsert=True,
        )
        raise HTTPException(403, "PIN hatalı")
    await db.login_attempts.delete_one({"identifier": key})
    exp = datetime.now(timezone.utc) + timedelta(minutes=REVEAL_TTL_MIN)
    reveal = jwt.encode({"sub": user["id"], "scope": "reveal", "exp": exp}, JWT_SECRET, algorithm=JWT_ALG)
    return {"ok": True, "reveal_token": reveal, "expires_in": REVEAL_TTL_MIN * 60}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    tenant = None
    if user.get("tenant_id"):
        tenant = await db.tenants.find_one({"id": user["tenant_id"]}, {"_id": 0})
    return {**user, "tenant": tenant}

@api.post("/auth/change-password")
async def change_password(inp: ChangePasswordIn, user=Depends(get_current_user)):
    """Oturum açmış her kullanıcı (Süper Admin dahil) kendi şifresini değiştirir."""
    if len(inp.new_password) < MIN_PASSWORD_LEN:
        raise HTTPException(400, f"Yeni şifre en az {MIN_PASSWORD_LEN} karakter olmalıdır")
    if inp.new_password == inp.current_password:
        raise HTTPException(400, "Yeni şifre mevcut şifreden farklı olmalıdır")
    doc = await db.users.find_one({"id": user["id"]})
    if not doc or not verify_password(inp.current_password, doc["password_hash"]):
        raise HTTPException(400, "Mevcut şifre hatalı")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(inp.new_password)}})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": user.get("tenant_id"), "user": user["email"],
        "action": "user.password_change", "entity_id": user["id"], "at": now_iso(),
    })
    return {"ok": True}

# ---------- Users (admin) ----------
@api.get("/users")
async def list_users(user=Depends(require_role("admin"))):
    q = {} if user["role"] == "super_admin" else {"tenant_id": user["tenant_id"]}
    docs = await db.users.find(q, {"password_hash": 0, "_id": 0}).to_list(500)
    return docs

@api.post("/users")
async def create_user(inp: UserCreate, user=Depends(require_role("admin"))):
    email = inp.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayıtlı")
    if user.get("role") == "super_admin":
        raise HTTPException(400, "Süper Admin kullanıcı ekleyemez; önce firma seçin")
    # Firma yöneticisi kendi rolünün üstünde (ör. super_admin) bir rol atayamaz
    if inp.role not in TENANT_ROLES:
        raise HTTPException(400, "Geçersiz rol")
    doc = {
        "id": uid(), "email": email, "name": inp.name, "role": inp.role,
        "tenant_id": user["tenant_id"],
        "password_hash": hash_password(inp.password), "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return clean(doc)

# ---------- Tenants (super_admin) ----------
@api.get("/admin/tenants")
async def list_tenants(user=Depends(require_super_admin)):
    docs = await db.tenants.find({}, {"_id": 0}).to_list(500)
    for d in docs:
        d["users_count"] = await db.users.count_documents({"tenant_id": d["id"]})
        d["orders_count"] = await db.service_orders.count_documents({"tenant_id": d["id"]})
    return docs

@api.post("/admin/tenants")
async def create_tenant(inp: TenantCreateWithAdmin, user=Depends(require_super_admin)):
    admin_email = inp.admin_email.lower().strip()
    if await db.users.find_one({"email": admin_email}):
        raise HTTPException(400, "Yönetici e-postası zaten kullanımda")
    tenant_data = inp.model_dump()
    admin_data = {
        "admin_email": tenant_data.pop("admin_email"),
        "admin_password": tenant_data.pop("admin_password"),
        "admin_name": tenant_data.pop("admin_name"),
    }
    tenant_data["id"] = uid()
    tenant_data["created_at"] = now_iso()
    if not tenant_data.get("slug"):
        tenant_data["slug"] = tenant_data["name"].lower().replace(" ", "-")
    await db.tenants.insert_one(tenant_data)
    await seed_default_catalog(tenant_data["id"])
    await db.users.insert_one({
        "id": uid(), "email": admin_email, "name": admin_data["admin_name"],
        "role": "admin", "tenant_id": tenant_data["id"],
        "password_hash": hash_password(admin_data["admin_password"]),
        "created_at": now_iso(),
    })
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tenant_data["id"], "user": user["email"],
        "action": "tenant.create", "entity_id": tenant_data["id"],
        "new_value": tenant_data["name"], "at": now_iso(),
    })
    tenant_data.pop("_id", None)
    return tenant_data

@api.put("/admin/tenants/{tid}")
async def update_tenant_admin(tid: str, inp: TenantIn, user=Depends(require_super_admin)):
    old = await db.tenants.find_one({"id": tid}, {"_id": 0})
    if not old:
        raise HTTPException(404, "Firma bulunamadı")
    # Yalnızca gönderilen alanlar güncellenir; gönderilmeyen logo/etiket/görseller silinmez
    new_data = inp.model_dump(exclude_unset=True)
    r = await db.tenants.update_one({"id": tid}, {"$set": new_data})
    if r.matched_count == 0:
        raise HTTPException(404, "Firma bulunamadı")
    changes = _diff_dicts(old or {}, new_data, ignore={"id", "created_at", "slug"})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": user["email"],
        "action": "tenant.update", "entity_id": tid,
        "new_value": inp.name, "changes": changes, "at": now_iso(),
    })
    return await db.tenants.find_one({"id": tid}, {"_id": 0})

@api.delete("/admin/tenants/{tid}")
async def delete_tenant(tid: str, purge: bool = False, user=Depends(require_super_admin)):
    src = await db.tenants.find_one({"id": tid}, {"_id": 0, "name": 1})
    if purge:
        for col in ["customers","motorcycles","service_orders","payments","transactions","products","service_catalog",
                    "audit_logs","file_refs","users","quotes","reminder_digests","deleted_records"]:
            await db[col].delete_many({"tenant_id": tid})
        # Sayaçlar _id'de tenant kimliğini taşır (ör. service_order_<tid>_<yıl>)
        await db.counters.delete_many({"_id": {"$regex": re.escape(tid)}})
    await db.tenants.delete_one({"id": tid})
    await db.audit_logs.insert_one({
        "id": uid(), "user": user["email"],
        "action": "tenant.delete", "entity_id": tid,
        "old_value": (src or {}).get("name"), "new_value": ("purge" if purge else "soft"),
        "at": now_iso(),
    })
    return {"ok": True}

# ---------- Super Admin: full tenant management ----------
@api.get("/admin/tenants/{tid}")
async def get_tenant_full(tid: str, user=Depends(require_super_admin)):
    t = await db.tenants.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Firma bulunamadı")
    t["users"] = await db.users.find({"tenant_id": tid}, {"_id": 0, "password_hash": 0}).to_list(500)
    t["stats"] = {
        "customers": await db.customers.count_documents({"tenant_id": tid}),
        "motorcycles": await db.motorcycles.count_documents({"tenant_id": tid}),
        "orders": await db.service_orders.count_documents({"tenant_id": tid}),
        "products": await db.products.count_documents({"tenant_id": tid}),
    }
    return t

@api.post("/admin/tenants/{tid}/logo")
async def admin_upload_logo(tid: str, file: UploadFile = File(...), user=Depends(require_super_admin)):
    ext = ((file.filename or "").rsplit(".", 1)[-1] if "." in (file.filename or "") else "png").lower()
    if ext not in {"png","jpg","jpeg","webp","svg"}:
        raise HTTPException(400, "Sadece görsel dosyası yüklenebilir")
    path = f"{APP_NAME}/tenants/{tid}/logo.{ext}"
    data = await file.read()
    result = await put_object(path, data, file.content_type or "image/png")
    await db.tenants.update_one({"id": tid}, {"$set": {"logo_path": result["path"]}})
    await db.file_refs.insert_one({
        "id": uid(), "path": result["path"], "tenant_id": tid,
        "content_type": file.content_type or "image/png", "size": len(data),
        "uploaded_at": now_iso(), "is_deleted": False, "kind": "tenant_logo",
    })
    return {"logo_path": result["path"]}

@api.post("/admin/tenants/{tid}/moto-image/{type_key}")
async def admin_upload_moto_img(tid: str, type_key: str, file: UploadFile = File(...), user=Depends(require_super_admin)):
    ext = ((file.filename or "").rsplit(".", 1)[-1] if "." in (file.filename or "") else "png").lower()
    if ext not in {"png","jpg","jpeg","webp","svg"}:
        raise HTTPException(400, "Sadece görsel dosyası yüklenebilir")
    safe_key = type_key.replace("/", "_").replace(" ", "_")
    path = f"{APP_NAME}/tenants/{tid}/moto-{safe_key}.{ext}"
    data = await file.read()
    result = await put_object(path, data, file.content_type or "image/png")
    await db.tenants.update_one({"id": tid}, {"$set": {f"custom_moto_images.{type_key}": result["path"]}})
    await db.file_refs.insert_one({
        "id": uid(), "path": result["path"], "tenant_id": tid,
        "content_type": file.content_type or "image/png", "size": len(data),
        "uploaded_at": now_iso(), "is_deleted": False, "kind": "moto_image",
    })
    return {"path": result["path"], "type": type_key}

@api.put("/admin/users/{uid_}/password")
async def reset_user_password(uid_: str, inp: PasswordResetIn, user=Depends(require_super_admin)):
    if len(inp.new_password) < MIN_PASSWORD_LEN:
        raise HTTPException(400, f"Şifre en az {MIN_PASSWORD_LEN} karakter olmalıdır")
    r = await db.users.update_one({"id": uid_}, {"$set": {"password_hash": hash_password(inp.new_password)}})
    if r.matched_count == 0:
        raise HTTPException(404, "Kullanıcı bulunamadı")
    await db.audit_logs.insert_one({
        "id": uid(), "user": user["email"], "action": "user.password_reset",
        "entity_id": uid_, "at": now_iso(),
    })
    return {"ok": True}

@api.put("/admin/users/{uid_}")
async def admin_update_user(uid_: str, patch: Dict[str, Any], user=Depends(require_super_admin)):
    allowed = {k: v for k, v in patch.items() if k in {"name", "email", "role", "tenant_id"}}
    if "email" in allowed:
        allowed["email"] = allowed["email"].lower().strip()
        clash = await db.users.find_one({"email": allowed["email"], "id": {"$ne": uid_}}, {"_id": 0, "id": 1})
        if clash:
            raise HTTPException(400, "Bu e-posta zaten kayıtlı")
    if "role" in allowed:
        if allowed["role"] not in TENANT_ROLES | {"super_admin"}:
            raise HTTPException(400, "Geçersiz rol")
        if allowed["role"] == "super_admin":
            allowed["tenant_id"] = None  # Süper Admin hiçbir firmaya bağlı olamaz
    if not allowed:
        raise HTTPException(400, "Güncellenecek alan yok")
    r = await db.users.update_one({"id": uid_}, {"$set": allowed})
    if r.matched_count == 0:
        raise HTTPException(404, "Kullanıcı bulunamadı")
    return await db.users.find_one({"id": uid_}, {"_id": 0, "password_hash": 0})

@api.delete("/admin/users/{uid_}")
async def admin_delete_user(uid_: str, user=Depends(require_super_admin)):
    if uid_ == user.get("id"):
        raise HTTPException(400, "Kendi hesabınızı silemezsiniz")
    await db.users.delete_one({"id": uid_})
    return {"ok": True}

@api.post("/admin/tenants/{tid}/users")
async def admin_create_user_in_tenant(tid: str, inp: UserCreate, user=Depends(require_super_admin)):
    email = inp.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Bu e-posta zaten kayıtlı")
    if inp.role not in TENANT_ROLES:
        raise HTTPException(400, "Geçersiz rol")
    if not await db.tenants.find_one({"id": tid}, {"_id": 0, "id": 1}):
        raise HTTPException(404, "Firma bulunamadı")
    doc = {
        "id": uid(), "email": email, "name": inp.name, "role": inp.role,
        "tenant_id": tid,
        "password_hash": hash_password(inp.password), "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return clean(doc)

@api.put("/admin/apply-global")
async def apply_global_settings(inp: GlobalApplyIn, user=Depends(require_super_admin)):
    """Apply a set of tenant fields to multiple tenants at once. Fields example:
    { "theme": "blue", "primary_color": "#2563EB", "font_family": "Inter", "custom_labels": {...} }"""
    if not inp.fields:
        raise HTTPException(400, "Uygulanacak alan yok")
    bad = set(inp.fields) - GLOBAL_APPLY_FIELDS
    if bad:
        raise HTTPException(400, f"Toplu uygulanamayan alanlar: {', '.join(sorted(bad))}")
    # tenant_ids None → tüm firmalar; boş liste → hiçbir firma (yanlışlıkla tüm firmaları etkilemesin)
    query = {"id": {"$in": inp.tenant_ids}} if inp.tenant_ids is not None else {}
    r = await db.tenants.update_many(query, {"$set": inp.fields})
    await db.audit_logs.insert_one({
        "id": uid(), "user": user["email"], "action": "tenants.global_apply",
        "old_value": inp.tenant_ids, "new_value": list(inp.fields.keys()), "at": now_iso(),
    })
    return {"modified": r.modified_count}

# ---------- Super Admin: PDF Preview ----------
class PdfPreviewIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    tenant: Dict[str, Any]
    kind: str = "kabul"  # kabul | teslim

@api.post("/admin/pdf-preview")
async def admin_pdf_preview(inp: PdfPreviewIn, user=Depends(require_super_admin)):
    if inp.kind not in {"kabul", "teslim"}:
        raise HTTPException(400, "Geçersiz form türü")
    tenant = inp.tenant or {}
    # Fetch logo bytes if provided
    logo_bytes = None
    logo_path = tenant.get("logo_path")
    if logo_path:
        try:
            logo_bytes, _ = await get_object(logo_path)
        except Exception:
            logo_bytes = None
    # Sample order data for preview
    sample_order = {
        "service_no": "SRV-2026-00042",
        "created_at": now_iso(),
        "customer_name": "Ahmet Yılmaz",
        "customer_phone": "0532 000 00 00",
        "plate": "34 ABC 123",
        "brand": "Yamaha",
        "model": "MT-07",
        "km": 12450,
        "fuel_level": "1/2",
        "diagnosis": "Zincir aşınmış, ön fren balatası bitmiş.",
        "operations": "Zincir seti ve ön fren balatası değişimi. Yağ bakımı.",
        "notes": "Servis kabul formu önizlemesi — örnek veri.",
        "items": [
            {"kind": "part", "name": "Motor Yağı 10W-40 (1L)", "qty": 3, "unit_price": 450, "vat": 20},
            {"kind": "part", "name": "Yağ Filtresi", "qty": 1, "unit_price": 250, "vat": 20},
            {"kind": "part", "name": "Ön Fren Balatası", "qty": 1, "unit_price": 650, "vat": 20},
            {"kind": "service", "name": "Genel Bakım İşçiliği", "qty": 1, "unit_price": 850, "vat": 20},
        ],
        "labor_total": 250,
        "discount": 100,
        "grand_total": 3000,
        "paid_total": 1000,
    }
    pdf_bytes = build_service_pdf(sample_order, kind=inp.kind, tenant=tenant, logo_bytes=logo_bytes)
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf",
                             headers={"Content-Disposition": 'inline; filename="preview.pdf"'})

# ---------- Super Admin: Tenant Clone ----------
@api.post("/admin/tenants/{tid}/clone")
async def clone_tenant(tid: str, inp: TenantCloneIn, user=Depends(require_super_admin)):
    src = await db.tenants.find_one({"id": tid}, {"_id": 0})
    if not src:
        raise HTTPException(404, "Kaynak firma bulunamadı")
    admin_email = inp.admin_email.lower().strip()
    if await db.users.find_one({"email": admin_email}):
        raise HTTPException(400, "Yönetici e-postası zaten kullanımda")
    new_tid = uid()
    clone = {k: v for k, v in src.items() if k not in {"id", "created_at", "slug"}}
    clone.update({
        "id": new_tid,
        "name": inp.new_name,
        "slug": (inp.new_slug or inp.new_name.lower().replace(" ", "-")),
        "created_at": now_iso(),
        # reset subscription/active for cloned — fresh 30-day trial
        "is_active": True,
        "plan": "trial",
        "trial_ends_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "subscription_ends_at": None,
        "billing_notes": "",
        # Firmaya özgü kimlik ve banka bilgileri kopyalanmaz; yeni firma kendi bilgilerini girer
        "address": "", "city": "", "district": "", "phone": "", "email": "", "tax_no": "",
        "bank_name": "", "bank_account_name": "", "iban": "",
    })
    # Do NOT carry customer/business data — only theme/pdf/labels are cloned via base copy
    await db.tenants.insert_one(clone)
    # Copy parts catalog
    parts_copied = 0
    if inp.include_products:
        parts = await db.products.find({"tenant_id": tid}, {"_id": 0}).to_list(5000)
        for p in parts:
            p["id"] = uid(); p["tenant_id"] = new_tid; p["created_at"] = now_iso()
            p.pop("stock", None); p["stock"] = 0
            await db.products.insert_one(p)
            parts_copied += 1
    services_copied = 0
    if inp.include_services:
        services = await db.service_catalog.find({"tenant_id": tid}, {"_id": 0}).to_list(5000)
        for s in services:
            s["id"] = uid(); s["tenant_id"] = new_tid; s["created_at"] = now_iso()
            await db.service_catalog.insert_one(s)
            services_copied += 1
    # Admin user
    await db.users.insert_one({
        "id": uid(), "email": admin_email, "name": inp.admin_name, "role": "admin",
        "tenant_id": new_tid,
        "password_hash": hash_password(inp.admin_password),
        "created_at": now_iso(),
    })
    await db.audit_logs.insert_one({
        "id": uid(), "user": user["email"], "action": "tenant.clone",
        "entity_id": new_tid, "old_value": tid, "new_value": inp.new_name, "at": now_iso(),
    })
    clone.pop("_id", None)
    return {"tenant": clone, "parts_copied": parts_copied, "services_copied": services_copied}

# ---------- Super Admin: Audit Logs ----------
@api.get("/admin/audit-logs")
async def list_audit_logs(
    tenant_id: str = "",
    user_email: str = "",
    action: str = "",
    since: str = "",
    limit: int = 200,
    current_user=Depends(require_super_admin),
):
    q: Dict[str, Any] = {}
    if tenant_id:
        q["tenant_id"] = tenant_id
    if user_email:
        q["user"] = {"$regex": re.escape(user_email), "$options": "i"}
    if action:
        q["action"] = {"$regex": re.escape(action), "$options": "i"}
    if since:
        try:
            s = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(400, "Geçersiz tarih")
        if s.tzinfo is None:
            s = s.replace(tzinfo=TR_TZ)  # saat dilimi yoksa Türkiye saati varsayılır
        # Kayıtlar UTC ISO metni olarak tutulduğu için karşılaştırma da aynı biçimde yapılır
        q["at"] = {"$gte": s.astimezone(timezone.utc).isoformat()}
    limit = max(1, min(int(limit or 200), 1000))
    docs = await db.audit_logs.find(q, {"_id": 0}).sort("at", -1).to_list(limit)
    # Enrich with tenant name
    tids = list({d.get("tenant_id") for d in docs if d.get("tenant_id")})
    tenants_map = {}
    if tids:
        for t in await db.tenants.find({"id": {"$in": tids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500):
            tenants_map[t["id"]] = t.get("name")
    for d in docs:
        d["tenant_name"] = tenants_map.get(d.get("tenant_id"))
    return docs


# ---------- Tenant Profile (self) ----------
@api.get("/tenant/me")
async def tenant_me(user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    t = await db.tenants.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Firma bulunamadı")
    return t

@api.put("/tenant/me")
async def update_tenant_me(inp: TenantIn, user=Depends(require_role("admin"))):
    tid = tenant_id_of(user)
    data = inp.model_dump(exclude_unset=True)
    # Plan/abonelik/aktiflik alanları yalnızca Süper Admin tarafından değiştirilebilir
    for k in RESTRICTED_TENANT_FIELDS:
        data.pop(k, None)
    if not data:
        return await db.tenants.find_one({"id": tid}, {"_id": 0})
    r = await db.tenants.update_one({"id": tid}, {"$set": data})
    if r.matched_count == 0:
        raise HTTPException(404, "Firma bulunamadı")
    return await db.tenants.find_one({"id": tid}, {"_id": 0})

@api.post("/tenant/me/logo")
async def upload_tenant_logo(file: UploadFile = File(...), user=Depends(require_role("admin"))):
    tid = tenant_id_of(user)
    ext = ((file.filename or "").rsplit(".", 1)[-1] if "." in (file.filename or "") else "png").lower()
    if ext not in {"png","jpg","jpeg","webp","svg"}:
        raise HTTPException(400, "Sadece görsel dosyası yüklenebilir")
    path = f"{APP_NAME}/tenants/{tid}/logo.{ext}"
    data = await file.read()
    result = await put_object(path, data, file.content_type or "image/png")
    await db.tenants.update_one({"id": tid}, {"$set": {"logo_path": result["path"]}})
    await db.file_refs.insert_one({
        "id": uid(), "path": result["path"], "tenant_id": tid,
        "content_type": file.content_type or "image/png",
        "size": len(data), "uploaded_at": now_iso(), "is_deleted": False,
        "kind": "tenant_logo",
    })
    return {"logo_path": result["path"]}

@api.post("/tenant/me/moto-image/{type_key}")
async def upload_moto_image(type_key: str, file: UploadFile = File(...), user=Depends(require_role("admin"))):
    tid = tenant_id_of(user)
    ext = ((file.filename or "").rsplit(".", 1)[-1] if "." in (file.filename or "") else "png").lower()
    if ext not in {"png","jpg","jpeg","webp","svg"}:
        raise HTTPException(400, "Sadece görsel dosyası yüklenebilir")
    safe_key = type_key.replace("/", "_").replace(" ", "_")
    path = f"{APP_NAME}/tenants/{tid}/moto-{safe_key}.{ext}"
    data = await file.read()
    result = await put_object(path, data, file.content_type or "image/png")
    await db.tenants.update_one({"id": tid}, {"$set": {f"custom_moto_images.{type_key}": result["path"]}})
    await db.file_refs.insert_one({
        "id": uid(), "path": result["path"], "tenant_id": tid,
        "content_type": file.content_type or "image/png",
        "size": len(data), "uploaded_at": now_iso(), "is_deleted": False,
        "kind": "moto_image",
    })
    return {"path": result["path"], "type": type_key}

# ---------- Customers ----------
async def customer_ledger(tenant_id: str, customer_id: Optional[str] = None) -> Dict[str, Dict[str, float]]:
    """Cari hesap (tek kaynak: transactions). spent = borç kayıtları (charge/adjust/cancel),
    paid = tahsilatlar (payment kayıtları negatif tutulur), balance = spent - paid."""
    match: Dict[str, Any] = {"tenant_id": tenant_id}
    if customer_id:
        match["customer_id"] = customer_id
    pipe = [
        {"$match": match},
        {"$group": {
            "_id": "$customer_id",
            "spent": {"$sum": {"$cond": [{"$eq": ["$type", "payment"]}, 0, "$amount"]}},
            "paid": {"$sum": {"$cond": [{"$eq": ["$type", "payment"]}, {"$multiply": ["$amount", -1]}, 0]}},
        }},
    ]
    out: Dict[str, Dict[str, float]] = {}
    for row in await db.transactions.aggregate(pipe).to_list(10000):
        spent = round(row.get("spent", 0) or 0, 2)
        paid = round(row.get("paid", 0) or 0, 2)
        out[row["_id"]] = {"total_spent": spent, "total_paid": paid, "balance": round(spent - paid, 2)}
    return out

async def active_order_counts(tenant_id: str) -> Dict[str, int]:
    pipe = [
        {"$match": {"tenant_id": tenant_id, "status": {"$ne": "cancelled"}}},
        {"$group": {"_id": "$customer_id", "n": {"$sum": 1}}},
    ]
    return {row["_id"]: row["n"] for row in await db.service_orders.aggregate(pipe).to_list(10000)}

async def customer_stats(customer_id: str, tenant_id: str) -> Dict[str, Any]:
    ledger = (await customer_ledger(tenant_id, customer_id)).get(customer_id, {})
    total_services = await db.service_orders.count_documents(
        {"customer_id": customer_id, "tenant_id": tenant_id, "status": {"$ne": "cancelled"}})
    return {
        "total_services": total_services,
        "total_spent": ledger.get("total_spent", 0),
        "total_paid": ledger.get("total_paid", 0),
        "balance": ledger.get("balance", 0),
    }

@api.get("/customers")
async def list_customers(q: str = "", user=Depends(get_current_user)):
    query: Dict[str, Any] = tf(user)
    if q:
        query["$or"] = [
            {"first_name": {"$regex": q, "$options": "i"}},
            {"last_name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for d in docs:
        d.update(await customer_stats(d["id"], user["tenant_id"]))
        # compute top_tag from most-recent tagged note
        notes = d.get("note_entries") or []
        top = ""
        for n in sorted(notes, key=lambda x: x.get("at") or "", reverse=True):
            if n.get("tag"):
                top = n["tag"]; break
        d["top_tag"] = top
    return docs

@api.post("/customers")
async def create_customer(inp: CustomerIn, user=Depends(get_current_user)):
    doc = inp.model_dump()
    doc["id"] = uid()
    doc["tenant_id"] = tenant_id_of(user)
    doc["created_at"] = now_iso()
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/customers/{cid}")
async def get_customer(cid: str, user=Depends(get_current_user)):
    d = await db.customers.find_one(tf(user, {"id": cid}), {"_id": 0})
    if not d:
        raise HTTPException(404, "Müşteri bulunamadı")
    d.update(await customer_stats(cid, user["tenant_id"]))
    motos = await db.motorcycles.find(tf(user, {"customer_id": cid}), {"_id": 0}).to_list(500)
    orders = await db.service_orders.find(tf(user, {"customer_id": cid}), {"_id": 0}).sort("created_at", -1).to_list(500)
    txs = await db.transactions.find(tf(user, {"customer_id": cid}), {"_id": 0}).sort("created_at", -1).to_list(500)
    return {**d, "motorcycles": motos, "service_orders": orders, "transactions": txs}

@api.put("/customers/{cid}")
async def update_customer(cid: str, inp: CustomerIn, user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    data = inp.model_dump()
    r = await db.customers.update_one(tf(user, {"id": cid}), {"$set": data})
    if r.matched_count == 0:
        raise HTTPException(404, "Müşteri bulunamadı")
    # Servis kayıtlarındaki denormalize müşteri bilgilerini güncel tut
    await db.service_orders.update_many({"tenant_id": tid, "customer_id": cid}, {"$set": {
        "customer_name": f"{data['first_name']} {data['last_name']}",
        "customer_phone": data["phone"],
    }})
    return await get_customer(cid, user)

class DeleteIn(BaseModel):
    reason: str
    force: bool = False

async def _archive_customer(tid: str, cid: str, reason: str, user_email: str) -> Dict[str, Any]:
    """Hard delete customer + all cascaded data, snapshotting them to `deleted_records` for restore."""
    cust = await db.customers.find_one({"tenant_id": tid, "id": cid}, {"_id": 0})
    if not cust: raise HTTPException(404, "Müşteri bulunamadı")
    motorcycles = await db.motorcycles.find({"tenant_id": tid, "customer_id": cid}, {"_id":0}).to_list(5000)
    service_orders = await db.service_orders.find({"tenant_id": tid, "customer_id": cid}, {"_id":0}).to_list(5000)
    payments = await db.payments.find({"tenant_id": tid, "customer_id": cid}, {"_id":0}).to_list(5000)
    transactions = await db.transactions.find({"tenant_id": tid, "customer_id": cid}, {"_id":0}).to_list(5000)
    quotes = await db.quotes.find({"tenant_id": tid, "customer_id": cid}, {"_id":0}).to_list(5000)
    snapshot = {
        "id": uid(), "type": "customer", "tenant_id": tid,
        "entity_id": cid,
        "label": f"{cust.get('first_name','')} {cust.get('last_name','')}".strip(),
        "reason": reason, "deleted_by": user_email, "deleted_at": now_iso(),
        "purge_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "payload": {
            "customer": cust, "motorcycles": motorcycles, "service_orders": service_orders,
            "payments": payments, "transactions": transactions, "quotes": quotes,
        },
        "counts": {
            "motorcycles": len(motorcycles), "service_orders": len(service_orders),
            "payments": len(payments), "transactions": len(transactions), "quotes": len(quotes),
        },
    }
    await db.deleted_records.insert_one(snapshot)
    # Silinen aktif servislerin parçaları stoka geri döner (geri yüklemede tekrar düşülür)
    for o in service_orders:
        if o.get("status") != "cancelled":
            await _move_part_stock(tid, o.get("items", []), +1)
    # Hard delete source records
    await db.motorcycles.delete_many({"tenant_id": tid, "customer_id": cid})
    await db.service_orders.delete_many({"tenant_id": tid, "customer_id": cid})
    await db.payments.delete_many({"tenant_id": tid, "customer_id": cid})
    await db.transactions.delete_many({"tenant_id": tid, "customer_id": cid})
    await db.quotes.delete_many({"tenant_id": tid, "customer_id": cid})
    await db.customers.delete_one({"tenant_id": tid, "id": cid})
    snapshot.pop("_id", None); snapshot["payload"] = None  # slim
    return snapshot

async def _archive_motorcycle(tid: str, mid: str, reason: str, user_email: str) -> Dict[str, Any]:
    moto = await db.motorcycles.find_one({"tenant_id": tid, "id": mid}, {"_id": 0})
    if not moto: raise HTTPException(404, "Motosiklet bulunamadı")
    service_orders = await db.service_orders.find({"tenant_id": tid, "motorcycle_id": mid}, {"_id":0}).to_list(5000)
    quotes = await db.quotes.find({"tenant_id": tid, "motorcycle_id": mid}, {"_id":0}).to_list(5000)
    order_ids = [o["id"] for o in service_orders]
    # Servislere bağlı tahsilat ve cari kayıtları da birlikte arşivlenir; yoksa cari hesap tutarsız kalır
    payments = await db.payments.find({"tenant_id": tid, "service_order_id": {"$in": order_ids}}, {"_id":0}).to_list(5000) if order_ids else []
    transactions = await db.transactions.find({"tenant_id": tid, "service_order_id": {"$in": order_ids}}, {"_id":0}).to_list(5000) if order_ids else []
    snapshot = {
        "id": uid(), "type": "motorcycle", "tenant_id": tid,
        "entity_id": mid,
        "label": f"{moto.get('brand','')} {moto.get('model','')} · {moto.get('plate','')}".strip(),
        "reason": reason, "deleted_by": user_email, "deleted_at": now_iso(),
        "purge_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "payload": {"motorcycle": moto, "service_orders": service_orders, "quotes": quotes,
                    "payments": payments, "transactions": transactions},
        "counts": {"service_orders": len(service_orders), "quotes": len(quotes),
                   "payments": len(payments), "transactions": len(transactions)},
    }
    await db.deleted_records.insert_one(snapshot)
    for o in service_orders:
        if o.get("status") != "cancelled":
            await _move_part_stock(tid, o.get("items", []), +1)
    if order_ids:
        await db.payments.delete_many({"tenant_id": tid, "service_order_id": {"$in": order_ids}})
        await db.transactions.delete_many({"tenant_id": tid, "service_order_id": {"$in": order_ids}})
    await db.service_orders.delete_many({"tenant_id": tid, "motorcycle_id": mid})
    await db.quotes.delete_many({"tenant_id": tid, "motorcycle_id": mid})
    await db.motorcycles.delete_one({"tenant_id": tid, "id": mid})
    snapshot.pop("_id", None); snapshot["payload"] = None
    return snapshot

@api.delete("/customers/{cid}")
async def delete_customer(cid: str, inp: DeleteIn, user=Depends(require_role("admin"))):
    if not (inp.reason or "").strip():
        raise HTTPException(400, "Silme sebebi zorunludur")
    tid = user["tenant_id"]
    open_orders = await db.service_orders.count_documents({"tenant_id": tid, "customer_id": cid, "status": {"$nin": ["delivered", "cancelled"]}})
    if open_orders > 0 and not inp.force:
        raise HTTPException(400, f"Bu müşterinin {open_orders} açık servis kaydı var. Önce kapatın veya 'force=true' parametresiyle silin.")
    snap = await _archive_customer(tid, cid, inp.reason.strip(), user["email"])
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": user["email"],
        "action": "customer.delete", "entity_id": cid,
        "old_value": snap["label"], "new_value": inp.reason.strip(),
        "changes": [{"field": "reason", "old": "", "new": inp.reason.strip()}],
        "at": now_iso(),
    })
    return {"ok": True, "trash_id": snap["id"], "counts": snap["counts"], "purge_at": snap["purge_at"]}

class BulkDeleteIn(BaseModel):
    ids: List[str]
    reason: str
    force: bool = False

@api.post("/customers/bulk-delete")
async def bulk_delete_customers(inp: BulkDeleteIn, user=Depends(require_role("admin"))):
    if not (inp.reason or "").strip():
        raise HTTPException(400, "Silme sebebi zorunludur")
    if not inp.ids:
        raise HTTPException(400, "En az bir müşteri seçin")
    tid = user["tenant_id"]
    results = []
    for cid in inp.ids:
        try:
            open_orders = await db.service_orders.count_documents({"tenant_id": tid, "customer_id": cid, "status": {"$nin": ["delivered", "cancelled"]}})
            if open_orders > 0 and not inp.force:
                results.append({"id": cid, "ok": False, "error": f"{open_orders} açık servis"})
                continue
            snap = await _archive_customer(tid, cid, inp.reason.strip(), user["email"])
            await db.audit_logs.insert_one({
                "id": uid(), "tenant_id": tid, "user": user["email"],
                "action": "customer.delete", "entity_id": cid,
                "old_value": snap["label"], "new_value": inp.reason.strip(),
                "changes": [{"field": "reason", "old": "", "new": inp.reason.strip()}, {"field": "batch", "old": "", "new": "bulk"}],
                "at": now_iso(),
            })
            results.append({"id": cid, "ok": True, "trash_id": snap["id"], "counts": snap["counts"]})
        except HTTPException as e:
            results.append({"id": cid, "ok": False, "error": e.detail})
    return {"total": len(inp.ids), "deleted": sum(1 for r in results if r["ok"]), "results": results}

@api.get("/customers/duplicates/search")
async def search_dup_customers(phone: str = "", tc_no: str = "", user=Depends(get_current_user)):
    q: Dict[str, Any] = tf(user)
    ors = []
    if phone: ors.append({"phone": phone})
    if tc_no: ors.append({"tc_no": tc_no})
    if not ors: return []
    q["$or"] = ors
    return await db.customers.find(q, {"_id": 0}).to_list(20)

# ---------- Customer Notes ----------
class CustomerNoteIn(BaseModel):
    text: str
    tag: Optional[str] = ""  # "", "vip", "borclu", "sorunlu"

_VALID_TAGS = {"", "vip", "borclu", "sorunlu"}

@api.post("/customers/{cid}/notes")
async def add_customer_note(cid: str, inp: CustomerNoteIn, user=Depends(get_current_user)):
    if not inp.text.strip():
        raise HTTPException(400, "Not boş olamaz")
    cust = await db.customers.find_one(tf(user, {"id": cid}), {"_id": 0, "id": 1})
    if not cust:
        raise HTTPException(404, "Müşteri bulunamadı")
    note = {
        "id": uid(), "text": inp.text.strip(),
        "tag": inp.tag if inp.tag in _VALID_TAGS else "",
        "author": user["email"], "author_name": user.get("name") or user["email"],
        "at": now_iso(), "updated_at": None,
    }
    await db.customers.update_one({"id": cid, "tenant_id": user["tenant_id"]},
                                  {"$push": {"note_entries": note}})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": user["tenant_id"], "user": user["email"],
        "action": "customer_note.create", "entity_id": cid,
        "new_value": inp.text[:80], "at": now_iso(),
    })
    return note

@api.put("/customers/{cid}/notes/{nid}")
async def update_customer_note(cid: str, nid: str, inp: CustomerNoteIn, user=Depends(get_current_user)):
    if not inp.text.strip():
        raise HTTPException(400, "Not boş olamaz")
    cust = await db.customers.find_one(tf(user, {"id": cid}), {"_id": 0})
    if not cust:
        raise HTTPException(404, "Müşteri bulunamadı")
    notes = cust.get("note_entries") or []
    target = next((n for n in notes if n.get("id") == nid), None)
    if not target:
        raise HTTPException(404, "Not bulunamadı")
    # Author OR admin/super_admin can edit
    if user["role"] not in ("admin", "super_admin") and target.get("author") != user["email"]:
        raise HTTPException(403, "Bu notu düzenleme yetkiniz yok")
    old_text = target.get("text")
    # Tek bir notu konumsal güncelleme ile değiştir: eşzamanlı eklenen notlar ezilmez
    upd = {
        "text": inp.text.strip(),
        "tag": inp.tag if inp.tag in _VALID_TAGS else "",
        "updated_at": now_iso(),
        "updated_by": user["email"],
    }
    await db.customers.update_one(
        {"id": cid, "tenant_id": user["tenant_id"], "note_entries.id": nid},
        {"$set": {f"note_entries.$.{k}": v for k, v in upd.items()}})
    target.update(upd)
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": user["tenant_id"], "user": user["email"],
        "action": "customer_note.update", "entity_id": cid,
        "old_value": (old_text or "")[:80], "new_value": inp.text[:80], "at": now_iso(),
    })
    return target

@api.delete("/customers/{cid}/notes/{nid}")
async def delete_customer_note(cid: str, nid: str, user=Depends(get_current_user)):
    cust = await db.customers.find_one(tf(user, {"id": cid}), {"_id": 0})
    if not cust:
        raise HTTPException(404, "Müşteri bulunamadı")
    notes = cust.get("note_entries") or []
    target = next((n for n in notes if n.get("id") == nid), None)
    if not target:
        raise HTTPException(404, "Not bulunamadı")
    if user["role"] not in ("admin", "super_admin") and target.get("author") != user["email"]:
        raise HTTPException(403, "Bu notu silme yetkiniz yok")
    await db.customers.update_one({"id": cid, "tenant_id": user["tenant_id"]},
                                  {"$pull": {"note_entries": {"id": nid}}})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": user["tenant_id"], "user": user["email"],
        "action": "customer_note.delete", "entity_id": cid,
        "old_value": (target.get("text") or "")[:80], "at": now_iso(),
    })
    return {"ok": True}

@api.get("/motorcycles/duplicates/search")
async def search_dup_motos(plate: str = "", vin: str = "", user=Depends(get_current_user)):
    q: Dict[str, Any] = tf(user)
    ors = []
    if plate: ors.append({"plate": plate.upper().replace(" ", "")})
    if vin: ors.append({"vin": vin})
    if not ors: return []
    q["$or"] = ors
    return await db.motorcycles.find(q, {"_id": 0}).to_list(20)

# ---------- Motorcycles ----------
async def motorcycle_stats(mid: str, tenant_id: str):
    orders = await db.service_orders.find(
        {"motorcycle_id": mid, "tenant_id": tenant_id, "status": {"$ne": "cancelled"}},
        {"grand_total": 1, "created_at": 1, "km": 1, "_id": 0}
    ).to_list(500)
    orders.sort(key=lambda o: o.get("created_at") or "")  # son servis = en yeni kayıt
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
    query: Dict[str, Any] = tf(user)
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
        d.update(await motorcycle_stats(d["id"], user["tenant_id"]))
    return docs

@api.post("/motorcycles")
async def create_motorcycle(inp: MotorcycleIn, user=Depends(get_current_user)):
    doc = inp.model_dump()
    doc["id"] = uid()
    doc["tenant_id"] = tenant_id_of(user)
    if not await db.customers.find_one({"id": inp.customer_id, "tenant_id": doc["tenant_id"]}, {"_id": 0, "id": 1}):
        raise HTTPException(400, "Müşteri bulunamadı")
    doc["plate"] = doc["plate"].upper().replace(" ", "")
    doc["created_at"] = now_iso()
    await db.motorcycles.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/motorcycles/{mid}")
async def get_motorcycle(mid: str, user=Depends(get_current_user)):
    d = await db.motorcycles.find_one(tf(user, {"id": mid}), {"_id": 0})
    if not d:
        raise HTTPException(404, "Motosiklet bulunamadı")
    d.update(await motorcycle_stats(mid, user["tenant_id"]))
    d["customer"] = await db.customers.find_one({"id": d["customer_id"]}, {"_id": 0})
    d["service_orders"] = await db.service_orders.find(tf(user, {"motorcycle_id": mid}), {"_id": 0}).sort("created_at", -1).to_list(500)
    return d

@api.put("/motorcycles/{mid}")
async def update_motorcycle(mid: str, inp: MotorcycleIn, user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    d = inp.model_dump()
    d["plate"] = d["plate"].upper().replace(" ", "")
    if not await db.customers.find_one({"id": inp.customer_id, "tenant_id": tid}, {"_id": 0, "id": 1}):
        raise HTTPException(400, "Müşteri bulunamadı")
    r = await db.motorcycles.update_one(tf(user, {"id": mid}), {"$set": d})
    if r.matched_count == 0:
        raise HTTPException(404, "Motosiklet bulunamadı")
    # Servis kayıtlarındaki denormalize araç bilgilerini güncel tut
    await db.service_orders.update_many({"tenant_id": tid, "motorcycle_id": mid}, {"$set": {
        "plate": d["plate"], "brand": d["brand"], "model": d["model"], "moto_type": d["type"],
    }})
    return await get_motorcycle(mid, user)

@api.delete("/motorcycles/{mid}")
async def delete_motorcycle(mid: str, inp: DeleteIn, user=Depends(require_role("admin"))):
    if not (inp.reason or "").strip():
        raise HTTPException(400, "Silme sebebi zorunludur")
    tid = user["tenant_id"]
    open_orders = await db.service_orders.count_documents({"tenant_id": tid, "motorcycle_id": mid, "status": {"$nin": ["delivered", "cancelled"]}})
    if open_orders > 0 and not inp.force:
        raise HTTPException(400, f"Bu motosiklete ait {open_orders} açık servis kaydı var. Önce kapatın veya 'force=true' parametresiyle silin.")
    snap = await _archive_motorcycle(tid, mid, inp.reason.strip(), user["email"])
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": user["email"],
        "action": "motorcycle.delete", "entity_id": mid,
        "old_value": snap["label"], "new_value": inp.reason.strip(),
        "changes": [{"field": "reason", "old": "", "new": inp.reason.strip()}],
        "at": now_iso(),
    })
    return {"ok": True, "trash_id": snap["id"], "counts": snap["counts"], "purge_at": snap["purge_at"]}

# ---------- Trash / Çöp Kutusu ----------
@api.get("/trash")
async def list_trash(type: str = "", user=Depends(require_role("admin"))):
    q: Dict[str, Any] = tf(user)
    if type in ("customer", "motorcycle"):
        q["type"] = type
    docs = await db.deleted_records.find(q, {"_id": 0, "payload": 0}).sort("deleted_at", -1).to_list(500)
    return docs

@api.get("/trash/{tid}")
async def get_trash_item(tid: str, user=Depends(require_role("admin"))):
    doc = await db.deleted_records.find_one(tf(user, {"id": tid}), {"_id": 0})
    if not doc:
        raise HTTPException(404, "Kayıt bulunamadı")
    return doc

@api.post("/trash/{tid}/restore")
async def restore_trash(tid: str, user=Depends(require_role("admin"))):
    doc = await db.deleted_records.find_one(tf(user, {"id": tid}), {"_id": 0})
    if not doc:
        raise HTTPException(404, "Kayıt bulunamadı")
    tenant_id = doc["tenant_id"]
    payload = doc.get("payload") or {}
    counts_restored = {}
    if doc["type"] == "customer":
        c = payload.get("customer")
        if c:
            existing = await db.customers.find_one({"id": c["id"]}, {"_id":0, "id":1})
            if existing:
                raise HTTPException(400, "Müşteri kaydı zaten mevcut — çakışma")
            await db.customers.insert_one(c)
            counts_restored["customer"] = 1
        for col_key, col_name in [("motorcycles","motorcycles"), ("service_orders","service_orders"),
                                   ("payments","payments"), ("transactions","transactions"), ("quotes","quotes")]:
            items = payload.get(col_key) or []
            if items:
                await db[col_name].insert_many(items)
                counts_restored[col_key] = len(items)
        # Geri yüklenen aktif servislerin parçaları yeniden stoktan düşer
        for o in payload.get("service_orders") or []:
            if o.get("status") != "cancelled":
                await _move_part_stock(tenant_id, o.get("items", []), -1)
    elif doc["type"] == "motorcycle":
        m = payload.get("motorcycle")
        if m:
            existing = await db.motorcycles.find_one({"id": m["id"]}, {"_id":0, "id":1})
            if existing:
                raise HTTPException(400, "Motosiklet kaydı zaten mevcut — çakışma")
            # Ensure parent customer still exists
            if not await db.customers.find_one({"id": m.get("customer_id"), "tenant_id": tenant_id}, {"_id":0, "id":1}):
                raise HTTPException(400, "Sahibi müşteri artık mevcut değil. Önce müşteriyi çöp kutusundan geri yükleyin.")
            await db.motorcycles.insert_one(m)
            counts_restored["motorcycle"] = 1
        for col_key, col_name in [("service_orders","service_orders"), ("quotes","quotes"),
                                   ("payments","payments"), ("transactions","transactions")]:
            items = payload.get(col_key) or []
            if items:
                await db[col_name].insert_many(items)
                counts_restored[col_key] = len(items)
        for o in payload.get("service_orders") or []:
            if o.get("status") != "cancelled":
                await _move_part_stock(tenant_id, o.get("items", []), -1)
    # Remove trash entry
    await db.deleted_records.delete_one({"id": tid})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tenant_id, "user": user["email"],
        "action": f"{doc['type']}.restore", "entity_id": doc["entity_id"],
        "old_value": doc.get("label"), "new_value": ", ".join(f"{k}:{v}" for k,v in counts_restored.items()),
        "at": now_iso(),
    })
    return {"ok": True, "restored": counts_restored}

@api.delete("/trash/{tid}")
async def purge_trash(tid: str, user=Depends(require_role("admin"))):
    doc = await db.deleted_records.find_one(tf(user, {"id": tid}), {"_id": 0, "type":1, "entity_id":1, "label":1, "tenant_id":1})
    if not doc:
        raise HTTPException(404, "Kayıt bulunamadı")
    await db.deleted_records.delete_one({"id": tid})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": doc["tenant_id"], "user": user["email"],
        "action": f"{doc['type']}.purge", "entity_id": doc["entity_id"],
        "old_value": doc.get("label"), "at": now_iso(),
    })
    return {"ok": True}

async def _run_trash_purge():
    """Delete deleted_records older than purge_at."""
    now_i = now_iso()
    r = await db.deleted_records.delete_many({"purge_at": {"$lte": now_i}})
    if r.deleted_count:
        await db.audit_logs.insert_one({
            "id": uid(), "user": "cron@system", "action": "cron.trash_purge",
            "new_value": f"{r.deleted_count} kayıt kalıcı silindi", "at": now_i,
        })
        logger.info(f"trash purge: {r.deleted_count} records permanently deleted")
    return r.deleted_count

# ---------- Products (Parts) ----------
@api.get("/products")
async def list_products(q: str = "", user=Depends(get_current_user)):
    query: Dict[str, Any] = tf(user)
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
    doc["tenant_id"] = tenant_id_of(user)
    doc["created_at"] = now_iso()
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/products/{pid}")
async def update_product(pid: str, inp: ProductIn, user=Depends(get_current_user)):
    r = await db.products.update_one(tf(user, {"id": pid}), {"$set": inp.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Parça bulunamadı")
    return await db.products.find_one(tf(user, {"id": pid}), {"_id": 0})

@api.delete("/products/{pid}")
async def delete_product(pid: str, user=Depends(require_role("admin"))):
    await db.products.delete_one(tf(user, {"id": pid}))
    return {"ok": True}

# ---------- Toplu KDV (katalog) ----------
class VatBulkIn(BaseModel):
    scope: Literal["all", "part", "service"] = "all"
    from_vat: Optional[float] = None  # yalnızca bu orana sahip kalemler (boşsa hepsi)
    vat: float = Field(ge=0, le=100)
    price_mode: Optional[Literal["incl", "excl"]] = None  # boşsa fiyat modu değişmez

@api.post("/catalog/vat-bulk")
async def bulk_change_vat(inp: VatBulkIn, user=Depends(require_role("admin"))):
    """Parça ve hizmet kataloğundaki KDV oranını toplu değiştirir (vergi oranı değişirse).
    Mevcut iş emri ve tekliflerdeki kalemler kendi KDV oranını korur; yalnızca bundan sonra
    katalogdan eklenen kalemleri etkiler. Geçmiş belgelerin tutarları değişmez."""
    tid = tenant_id_of(user)
    cond: Dict[str, Any] = {"tenant_id": tid}
    if inp.from_vat is not None:
        cond["vat"] = inp.from_vat
    setter: Dict[str, Any] = {"vat": inp.vat}
    if inp.price_mode:
        setter["price_mode"] = inp.price_mode
    result = {"parts": 0, "services": 0}
    if inp.scope in ("all", "part"):
        r = await db.products.update_many(cond, {"$set": setter})
        result["parts"] = r.modified_count
    if inp.scope in ("all", "service"):
        r = await db.service_catalog.update_many(cond, {"$set": setter})
        result["services"] = r.modified_count
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": user["email"],
        "action": "catalog.vat_bulk", "entity_id": inp.scope,
        "detail": {"vat": inp.vat, "from_vat": inp.from_vat, "price_mode": inp.price_mode, **result},
        "at": now_iso(),
    })
    return {"ok": True, **result}

# ---------- Services Catalog ----------
@api.get("/service-catalog")
async def list_services(q: str = "", user=Depends(get_current_user)):
    query: Dict[str, Any] = tf(user)
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    return await db.service_catalog.find(query, {"_id": 0}).to_list(1000)

@api.post("/service-catalog")
async def create_service(inp: ServiceCatalogIn, user=Depends(get_current_user)):
    doc = inp.model_dump()
    doc["id"] = uid()
    doc["tenant_id"] = tenant_id_of(user)
    doc["created_at"] = now_iso()
    await db.service_catalog.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/service-catalog/{sid}")
async def update_service(sid: str, inp: ServiceCatalogIn, user=Depends(get_current_user)):
    r = await db.service_catalog.update_one(tf(user, {"id": sid}), {"$set": inp.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Hizmet bulunamadı")
    return await db.service_catalog.find_one(tf(user, {"id": sid}), {"_id": 0})

@api.delete("/service-catalog/{sid}")
async def delete_service(sid: str, user=Depends(require_role("admin"))):
    await db.service_catalog.delete_one(tf(user, {"id": sid}))
    return {"ok": True}

# ---------- Service Orders ----------
async def _move_part_stock(tid: str, items: List[Dict[str, Any]], direction: int) -> None:
    """direction=-1: parça stoktan düşer (servis aktif). direction=+1: stok iade edilir (iptal/silme)."""
    for it in items or []:
        if it.get("kind") == "part" and it.get("ref_id"):
            qty = float(it.get("qty", 0) or 0)
            if qty:
                await db.products.update_one({"id": it["ref_id"], "tenant_id": tid},
                                             {"$inc": {"stock": direction * qty}})

async def _transition_order_status(so: Dict[str, Any], new_status: str, by: str, note: str = "") -> None:
    """Servis durumunu değiştirir. İptal/geri alma sırasında stok ve cari hesap kayıtlarını tutarlı tutar:
    - İptal: parçalar stoğa döner, servis tutarı kadar 'cancel' (ters kayıt) cari hesaba yazılır.
    - İptalden geri alma: parçalar yeniden düşer, tutar kadar 'charge' kaydı yazılır."""
    tid = so["tenant_id"]
    old = so.get("status")
    now = now_iso()
    grand = float(so.get("grand_total") or 0)
    if new_status == "cancelled" and old != "cancelled":
        if float(so.get("paid_total") or 0) > 0.005:
            raise HTTPException(400, "Tahsilat yapılmış servis iptal edilemez. Önce tahsilatları silin.")
        await _move_part_stock(tid, so.get("items", []), +1)
        if abs(grand) > 0.005:
            await db.transactions.insert_one({
                "id": uid(), "tenant_id": tid, "customer_id": so["customer_id"], "type": "cancel",
                "amount": -grand, "service_order_id": so["id"], "service_no": so.get("service_no"),
                "description": f"İptal: {so.get('service_no')}", "created_at": now,
            })
    elif old == "cancelled" and new_status != "cancelled":
        await _move_part_stock(tid, so.get("items", []), -1)
        if abs(grand) > 0.005:
            await db.transactions.insert_one({
                "id": uid(), "tenant_id": tid, "customer_id": so["customer_id"], "type": "charge",
                "amount": grand, "service_order_id": so["id"], "service_no": so.get("service_no"),
                "description": f"Yeniden aktifleştirildi: {so.get('service_no')}", "created_at": now,
            })
    await db.service_orders.update_one({"id": so["id"], "tenant_id": tid}, {
        "$set": {"status": new_status, "updated_at": now},
        "$push": {"status_history": {"status": new_status, "at": now, "by": by, "note": note}},
    })

def compute_totals(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Servis emri toplamı; kalem bazlı KDV dahil/hariç kuralı totals.py içinde (pricing.js ile aynı)."""
    return compute_document_totals(
        payload.get("items", []),
        labor_total=payload.get("labor_total", 0),
        labor_price_mode=payload.get("labor_price_mode", DEFAULT_PRICE_MODE),
        labor_vat=payload.get("labor_vat", DEFAULT_VAT),
        discount=payload.get("discount", 0),
    )

def check_document_money(payload: Dict[str, Any], min_qty_positive: bool = False) -> None:
    """Servis emri / teklif kalemlerindeki tutar alanlarını doğrular (400 döner)."""
    items = payload.get("items", [])
    if min_qty_positive:
        for it in items:
            if float(it.get("qty") or 0) <= 0:
                raise HTTPException(400, "Adet 0'dan büyük olmalı")
    err = validate_money_fields(
        items,
        labor_total=payload.get("labor_total", 0),
        labor_price_mode=payload.get("labor_price_mode", DEFAULT_PRICE_MODE),
        labor_vat=payload.get("labor_vat", DEFAULT_VAT),
        discount=payload.get("discount", 0),
    )
    if err:
        raise HTTPException(400, err)

async def next_service_no(tenant_id: str) -> str:
    year = datetime.now(timezone.utc).year
    counter = await db.counters.find_one_and_update(
        {"_id": f"service_order_{tenant_id}_{year}"},
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
    query: Dict[str, Any] = tf(user)
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
    tid = tenant_id_of(user)
    cust = await db.customers.find_one({"id": inp.customer_id, "tenant_id": tid}, {"_id": 0})
    moto = await db.motorcycles.find_one({"id": inp.motorcycle_id, "tenant_id": tid}, {"_id": 0})
    if not cust or not moto or moto.get("customer_id") != inp.customer_id:
        raise HTTPException(400, "Müşteri veya motosiklet bulunamadı")
    if inp.status not in ORDER_STATUSES or inp.status == "cancelled":
        raise HTTPException(400, "Yeni servis için geçersiz durum")
    payload = inp.model_dump()
    check_document_money(payload)
    totals = compute_totals(payload)
    doc = {
        **payload,
        **totals,
        "id": uid(),
        "tenant_id": tid,
        "service_no": await next_service_no(tid),
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
    for it in payload.get("items", []):
        if it.get("kind") == "part" and it.get("ref_id"):
            await db.products.update_one({"id": it["ref_id"], "tenant_id": tid}, {"$inc": {"stock": -float(it["qty"])}})
    if inp.km:
        # Kilometre yalnızca artabilir; daha düşük bir değer girilmişse mevcut değer korunur
        await db.motorcycles.update_one({"id": inp.motorcycle_id, "tenant_id": tid}, {"$max": {"km": inp.km}})
    await db.service_orders.insert_one(doc)
    if doc["grand_total"] > 0:
        await db.transactions.insert_one({
            "id": uid(), "tenant_id": tid, "customer_id": inp.customer_id, "type": "charge",
            "amount": doc["grand_total"], "service_order_id": doc["id"],
            "service_no": doc["service_no"],
            "description": f"Servis: {doc['service_no']}",
            "created_at": now_iso(),
        })
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": user["email"], "action": "service_order.create",
        "entity_id": doc["id"], "at": now_iso(),
    })
    doc.pop("_id", None)
    return doc

@api.get("/service-orders/{sid}")
async def get_service_order(sid: str, user=Depends(get_current_user)):
    d = await db.service_orders.find_one(tf(user, {"id": sid}), {"_id": 0})
    if not d:
        raise HTTPException(404, "Servis kaydı bulunamadı")
    d["customer"] = await db.customers.find_one({"id": d["customer_id"]}, {"_id": 0})
    d["motorcycle"] = await db.motorcycles.find_one({"id": d["motorcycle_id"]}, {"_id": 0})
    d["payments"] = await db.payments.find({"service_order_id": sid, "tenant_id": user["tenant_id"]}, {"_id": 0}).to_list(500)
    return d

@api.put("/service-orders/{sid}")
async def update_service_order(sid: str, inp: ServiceOrderIn, user=Depends(require_role("admin"))):
    tid = tenant_id_of(user)
    existing = await db.service_orders.find_one({"id": sid, "tenant_id": tid})
    if not existing:
        raise HTTPException(404, "Servis kaydı bulunamadı")
    if existing.get("status") == "cancelled":
        raise HTTPException(400, "İptal edilmiş servis düzenlenemez")
    cust = await db.customers.find_one({"id": inp.customer_id, "tenant_id": tid}, {"_id": 0})
    moto = await db.motorcycles.find_one({"id": inp.motorcycle_id, "tenant_id": tid}, {"_id": 0})
    if not cust or not moto or moto.get("customer_id") != inp.customer_id:
        raise HTTPException(400, "Müşteri veya motosiklet bulunamadı")
    payload = inp.model_dump()
    payload.pop("status", None)  # durum yalnızca /status uç noktasıyla değişir (geçmiş kaydı için)
    check_document_money(payload)
    totals = compute_totals(payload)
    upd = {
        **payload, **totals, "updated_at": now_iso(),
        "customer_name": f"{cust['first_name']} {cust['last_name']}",
        "customer_phone": cust.get("phone"),
        "plate": moto.get("plate"), "brand": moto.get("brand"),
        "model": moto.get("model"), "moto_type": moto.get("type"),
    }
    # stock reconciliation
    old_items = {it.get("ref_id"): float(it.get("qty", 0)) for it in existing.get("items", []) if it.get("kind") == "part" and it.get("ref_id")}
    new_items = {it.get("ref_id"): float(it.get("qty", 0)) for it in payload.get("items", []) if it.get("kind") == "part" and it.get("ref_id")}
    all_refs = set(old_items) | set(new_items)
    for rid in all_refs:
        delta = new_items.get(rid, 0) - old_items.get(rid, 0)
        if abs(delta) > 0.0001:
            await db.products.update_one({"id": rid, "tenant_id": tid}, {"$inc": {"stock": -delta}})
    await db.service_orders.update_one({"id": sid, "tenant_id": tid}, {"$set": upd})
    diff = totals["grand_total"] - existing.get("grand_total", 0)
    if abs(diff) > 0.01:
        await db.transactions.insert_one({
            "id": uid(), "tenant_id": tid, "customer_id": existing["customer_id"], "type": "adjust",
            "amount": diff, "service_order_id": sid, "service_no": existing["service_no"],
            "description": f"Servis tutarı güncellendi: {existing['service_no']}",
            "created_at": now_iso(),
        })
    return await get_service_order(sid, user)

@api.post("/service-orders/{sid}/status")
async def change_status(sid: str, inp: StatusUpdate, user=Depends(get_current_user)):
    if inp.status not in ORDER_STATUSES:
        raise HTTPException(400, "Geçersiz servis durumu")
    d = await db.service_orders.find_one(tf(user, {"id": sid}))
    if not d:
        raise HTTPException(404, "Servis kaydı bulunamadı")
    await _transition_order_status(d, inp.status, user["email"], inp.note or "")
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": user["tenant_id"], "user": user["email"], "action": "service_order.status_change",
        "entity_id": sid, "old_value": d.get("status"), "new_value": inp.status, "at": now_iso(),
    })
    return await get_service_order(sid, user)

@api.delete("/service-orders/{sid}")
async def delete_service_order(sid: str, hard: bool = False, user=Depends(require_role("admin"))):
    tid = tenant_id_of(user)
    so = await db.service_orders.find_one({"id": sid, "tenant_id": tid})
    if not so:
        raise HTTPException(404, "Servis kaydı bulunamadı")
    if hard:
        if so.get("status") != "cancelled":
            await _move_part_stock(tid, so.get("items", []), +1)  # aktif servis siliniyorsa stok iade edilir
        await db.transactions.delete_many({"service_order_id": sid, "tenant_id": tid})
        await db.payments.delete_many({"service_order_id": sid, "tenant_id": tid})
        await db.service_orders.delete_one({"id": sid, "tenant_id": tid})
        await db.file_refs.update_many({"service_order_id": sid, "tenant_id": tid}, {"$set": {"is_deleted": True}})
        await db.audit_logs.insert_one({
            "id": uid(), "tenant_id": tid, "user": user["email"], "action": "service_order.hard_delete",
            "entity_id": sid, "at": now_iso(),
        })
    else:
        await _transition_order_status(so, "cancelled", user["email"], "Servis silindi (iptal)")
    return {"ok": True}

# ---------- Payments ----------
@api.get("/payments")
async def list_payments(customer_id: str = "", user=Depends(get_current_user)):
    q: Dict[str, Any] = tf(user)
    if customer_id:
        q["customer_id"] = customer_id
    return await db.payments.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)

@api.post("/payments")
async def create_payment(inp: PaymentIn, user=Depends(get_current_user)):
    if inp.amount <= 0:
        raise HTTPException(400, "Tahsilat tutarı pozitif olmalıdır")
    tid = tenant_id_of(user)
    cust = await db.customers.find_one({"id": inp.customer_id, "tenant_id": tid})
    if not cust:
        raise HTTPException(400, "Müşteri bulunamadı")
    if inp.service_order_id:
        so = await db.service_orders.find_one({"id": inp.service_order_id, "tenant_id": tid})
        if not so or so.get("customer_id") != inp.customer_id:
            raise HTTPException(400, "Servis kaydı bu müşteriye ait değil veya bulunamadı")
        if so.get("status") == "cancelled":
            raise HTTPException(400, "İptal edilmiş servise tahsilat kaydedilemez")
    payment_no = f"THL-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(2).upper()}"
    doc = {
        **inp.model_dump(),
        "id": uid(),
        "tenant_id": tid,
        "payment_no": payment_no,
        "created_at": now_iso(),
        "created_by": user["email"],
    }
    await db.payments.insert_one(doc)
    if inp.service_order_id:
        # $inc: eşzamanlı tahsilatlar birbirini ezmez
        await db.service_orders.update_one({"id": inp.service_order_id, "tenant_id": tid},
            {"$inc": {"paid_total": inp.amount}, "$set": {"updated_at": now_iso()}})
    await db.transactions.insert_one({
        "id": uid(), "tenant_id": tid, "customer_id": inp.customer_id, "type": "payment",
        "amount": -inp.amount, "service_order_id": inp.service_order_id,
        "payment_id": doc["id"], "payment_no": payment_no,
        "description": inp.note or ("Tahsilat" if inp.service_order_id else "Harici Tahsilat"),
        "created_at": now_iso(),
    })
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": user["email"], "action": "payment.create",
        "entity_id": doc["id"], "at": now_iso(),
    })
    doc.pop("_id", None)
    return doc

@api.put("/payments/{pid}")
async def update_payment(pid: str, inp: PaymentUpdate, user=Depends(require_role("admin"))):
    tid = tenant_id_of(user)
    p = await db.payments.find_one({"id": pid, "tenant_id": tid})
    if not p:
        raise HTTPException(404, "Tahsilat bulunamadı")
    if inp.amount is not None and inp.amount <= 0:
        raise HTTPException(400, "Tahsilat tutarı pozitif olmalıdır")
    old_amount = p.get("amount", 0)
    updates = {k: v for k, v in inp.model_dump().items() if v is not None}
    if not updates:
        return {"ok": True}
    await db.payments.update_one({"id": pid, "tenant_id": tid}, {"$set": updates})
    new_amount = updates.get("amount", old_amount)
    diff = new_amount - old_amount
    if abs(diff) > 0.001:
        if p.get("service_order_id"):
            await db.service_orders.update_one({"id": p["service_order_id"], "tenant_id": tid},
                {"$inc": {"paid_total": diff}, "$set": {"updated_at": now_iso()}})
        await db.transactions.update_one({"payment_id": pid}, {"$set": {"amount": -new_amount}})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": user["email"], "action": "payment.update",
        "entity_id": pid, "old_value": old_amount, "new_value": new_amount, "at": now_iso(),
    })
    return await db.payments.find_one({"id": pid, "tenant_id": tid}, {"_id": 0})

@api.delete("/payments/{pid}")
async def delete_payment(pid: str, user=Depends(require_role("admin"))):
    tid = tenant_id_of(user)
    p = await db.payments.find_one({"id": pid, "tenant_id": tid})
    if not p:
        raise HTTPException(404, "Tahsilat bulunamadı")
    if p.get("service_order_id"):
        await db.service_orders.update_one({"id": p["service_order_id"], "tenant_id": tid},
            {"$inc": {"paid_total": -p["amount"]}, "$set": {"updated_at": now_iso()}})
    await db.transactions.delete_many({"payment_id": pid})
    await db.payments.delete_one({"id": pid, "tenant_id": tid})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": user["email"], "action": "payment.delete",
        "entity_id": pid, "old_value": p.get("amount"), "at": now_iso(),
    })
    return {"ok": True}

# ---------- Current Accounts ----------
@api.get("/current-accounts")
async def current_accounts(user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    ledger = await customer_ledger(tid)  # bakiye tek kaynaktan (transactions) hesaplanır
    counts = await active_order_counts(tid)
    customers = await db.customers.find(tf(user), {"_id": 0}).to_list(2000)
    rows = []
    for c in customers:
        s = ledger.get(c["id"], {"total_spent": 0, "total_paid": 0, "balance": 0})
        n = counts.get(c["id"], 0)
        if s["balance"] > 0.01 or n > 0:
            rows.append({**c, "total_spent": s["total_spent"], "total_paid": s["total_paid"],
                         "total_services": n, "balance": s["balance"]})
    rows.sort(key=lambda x: -x["balance"])
    return rows

@api.get("/current-accounts/{cid}/transactions")
async def get_transactions(cid: str, user=Depends(get_current_user)):
    txs = await db.transactions.find(tf(user, {"customer_id": cid}), {"_id": 0}).sort("created_at", 1).to_list(5000)
    bal = 0
    for t in txs:
        bal += t["amount"]
        t["running_balance"] = round(bal, 2)
    return txs

# ---------- Dashboard ----------

# ---------- Yönetici görünümü (PIN ile açılan para alanları) ----------
REVEAL_TTL_MIN = 15
REVEAL_KEYS = {
    "today_collection", "month_revenue", "total_receivables", "revenue", "grand_total", "paid_total",
    "spent", "amount", "balance", "debt", "total", "labor_total", "discount", "unit_price", "line_total",
    "cost_price", "sale_price", "price", "net_total", "vat_total", "collected", "receivable",
}

async def _is_revealed(request: Request, user: Dict[str, Any]) -> bool:
    tok = request.headers.get("X-Reveal-Token")
    if not tok:
        return False
    try:
        payload = jwt.decode(tok, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.InvalidTokenError:
        return False
    return payload.get("scope") == "reveal" and payload.get("sub") == user["id"]

def _mask_money(obj: Any) -> Any:
    """Para alanlarını (sayı) null yapar; istemci bunları *** olarak gösterir."""
    if isinstance(obj, dict):
        return {k: (None if k in REVEAL_KEYS and isinstance(v, (int, float)) else _mask_money(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_mask_money(x) for x in obj]
    return obj


def _debtors(orders: List[Dict[str, Any]], limit: int = 50) -> List[Dict[str, Any]]:
    """Müşteri bazlı açık bakiye (borç) listesi; bakiye pozitif olanlar, en yüksekten."""
    by: Dict[str, Dict[str, Any]] = {}
    for o in orders:
        cid = o.get("customer_id")
        bal = float(o.get("grand_total", 0) or 0) - float(o.get("paid_total", 0) or 0)
        if not cid or bal <= 0.01:
            continue
        row = by.setdefault(cid, {"customer_id": cid, "customer_name": o.get("customer_name") or "-", "balance": 0.0, "orders": 0})
        row["balance"] += bal
        row["orders"] += 1
    rows = sorted(by.values(), key=lambda r: -r["balance"])[:limit]
    for r in rows:
        r["balance"] = round(r["balance"], 2)
    return rows

@api.get("/dashboard")
async def dashboard(request: Request, user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    all_orders = await db.service_orders.find({"tenant_id": tid}, {"grand_total": 1, "paid_total": 1, "status": 1, "created_at": 1, "customer_id": 1, "customer_name": 1, "plate": 1, "service_no": 1, "items": 1, "_id": 0}).sort("created_at", -1).to_list(2000)
    # İptal edilen servisler ciro, alacak ve sayılarda dikkate alınmaz (yalnızca durum dağılımında görünür)
    orders = [o for o in all_orders if o.get("status") != "cancelled"]
    payments = await db.payments.find({"tenant_id": tid}, {"amount": 1, "created_at": 1, "_id": 0}).to_list(2000)
    today = local_today()  # gün sınırları Türkiye saatine göre
    month = local_month_now()

    def is_today(o):
        return local_day_of(o.get("created_at")) == today

    open_statuses = {"new", "diagnosed", "pricing", "awaiting_approval", "approved", "in_repair", "parts_waiting"}
    delivery_statuses = {"completed", "awaiting_delivery"}

    kpi = {
        "today_services": sum(1 for o in orders if is_today(o)),
        "open_services": sum(1 for o in orders if o.get("status") in open_statuses),
        "completed_services": sum(1 for o in orders if o.get("status") == "delivered"),
        "awaiting_delivery": sum(1 for o in orders if o.get("status") in delivery_statuses),
        "today_collection": sum(p["amount"] for p in payments if local_day_of(p.get("created_at")) == today),
        "month_revenue": sum(o.get("grand_total", 0) for o in orders if local_day_of(o.get("created_at"))[:7] == month),
        "total_receivables": sum(max(0, o.get("grand_total", 0) - o.get("paid_total", 0)) for o in orders),
        "unpaid_count": sum(1 for o in orders if (o.get("grand_total", 0) - o.get("paid_total", 0)) > 0.01),
    }

    # Monthly revenue last 12 months
    monthly = {}
    now = datetime.now(TR_TZ)
    for i in range(11, -1, -1):
        y = now.year
        m = now.month - i
        while m <= 0:
            m += 12
            y -= 1
        key = f"{y:04d}-{m:02d}"
        monthly[key] = 0
    for o in orders:
        k = local_day_of(o.get("created_at"))[:7]
        if k in monthly:
            monthly[k] += o.get("grand_total", 0)
    monthly_series = [{"month": k, "revenue": round(v, 2)} for k, v in monthly.items()]

    status_counts: Dict[str, int] = {}
    for o in all_orders:
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

    recent = sorted(all_orders, key=lambda o: o.get("created_at") or "", reverse=True)[:10]

    result = {
        "kpi": kpi,
        "monthly_revenue": monthly_series,
        "status_distribution": status_series,
        "top_operations": top_operations,
        "recent_orders": recent,
        "debtors": _debtors(orders, limit=10),
    }
    if await _is_revealed(request, user):
        return {**result, "masked": False}
    return {**_mask_money(result), "masked": True}

# ---------- Reports ----------
@api.get("/reports/summary")
async def report_summary(request: Request, user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    # İptal edilen servisler raporlarda gelir/alacak olarak sayılmaz
    orders = await db.service_orders.find({"tenant_id": tid, "status": {"$ne": "cancelled"}}, {"grand_total": 1, "paid_total": 1, "customer_id": 1, "customer_name": 1, "items": 1, "labor_total": 1, "discount": 1, "_id": 0}).to_list(2000)
    payments = await db.payments.find({"tenant_id": tid}, {"amount": 1, "_id": 0}).to_list(2000)
    products = await db.products.find({"tenant_id": tid}, {"id": 1, "code": 1, "name": 1, "stock": 1, "min_stock": 1, "cost_price": 1, "sale_price": 1, "_id": 0}).to_list(2000)

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
    # Minimum stok tanımlanmamış (0) ürünler kritik stok listesine alınmaz
    critical_stock = [p for p in products if p.get("min_stock", 0) > 0 and p.get("stock", 0) <= p.get("min_stock", 0)]

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
    # Alacak: servis bazında kalan borç (fazla tahsilat alacağı eksiltir, negatif alacak yazılmaz)
    total_receivables = sum(max(0, o.get("grand_total", 0) - o.get("paid_total", 0)) for o in orders)
    # Profit-loss: parts revenue - cost + services + labor
    parts_revenue = 0.0
    parts_cost = 0.0
    services_revenue = 0.0
    labor_revenue = 0.0
    product_cost_map = {p["id"]: p.get("cost_price", 0) for p in products}
    for o in orders:
        for it in o.get("items", []):
            qty = float(it.get("qty", 0)); price = float(it.get("unit_price", 0))
            if it.get("kind") == "part":
                parts_revenue += qty * price
                cost = product_cost_map.get(it.get("ref_id"), 0)
                parts_cost += qty * cost
            elif it.get("kind") == "service":
                services_revenue += qty * price
        labor_revenue += float(o.get("labor_total", 0))
    gross_profit = (parts_revenue - parts_cost) + services_revenue + labor_revenue - sum(o.get("discount",0) for o in orders)
    report = {
        "totals": {
            "total_revenue": round(total_revenue, 2),
            "total_collected": round(total_collected, 2),
            "receivables": round(total_receivables, 2),
            "orders_count": len(orders),
        },
        "profit_loss": {
            "parts_revenue": round(parts_revenue, 2),
            "parts_cost": round(parts_cost, 2),
            "parts_margin": round(parts_revenue - parts_cost, 2),
            "services_revenue": round(services_revenue, 2),
            "labor_revenue": round(labor_revenue, 2),
            "gross_profit": round(gross_profit, 2),
        },
        "top_customers": top_customers,
        "top_parts": top_parts,
        "top_services": top_services,
        "critical_stock": critical_stock,
        "debtors": _debtors(orders),
    }
    if await _is_revealed(request, user):
        return {**report, "masked": False}
    return {**_mask_money(report), "masked": True}

# ---------- Photos ----------
@api.post("/service-orders/{sid}/photos")
async def upload_photo(sid: str, file: UploadFile = File(...), caption: str = Form(""), user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    so = await db.service_orders.find_one({"id": sid, "tenant_id": tid})
    if not so:
        raise HTTPException(404, "Servis kaydı bulunamadı")
    ext = ((file.filename or "").rsplit(".", 1)[-1] if "." in (file.filename or "") else "bin").lower()
    if ext not in {"jpg","jpeg","png","webp","gif"}:
        raise HTTPException(400, "Sadece görsel dosyaları yüklenebilir")
    photo_id = uid()
    path = f"{APP_NAME}/tenants/{tid}/service-orders/{sid}/{photo_id}.{ext}"
    data = await file.read()
    result = await put_object(path, data, file.content_type or "image/jpeg")
    photo = {
        "id": photo_id, "path": result["path"], "caption": caption or "",
        "size": result.get("size", len(data)), "content_type": file.content_type or "image/jpeg",
        "uploaded_by": user["email"], "uploaded_at": now_iso(),
    }
    await db.service_orders.update_one({"id": sid, "tenant_id": tid}, {"$push": {"photos": photo}})
    await db.file_refs.insert_one({**photo, "service_order_id": sid, "tenant_id": tid, "is_deleted": False})
    return photo

@api.delete("/service-orders/{sid}/photos/{pid}")
async def delete_photo(sid: str, pid: str, user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    await db.service_orders.update_one({"id": sid, "tenant_id": tid}, {"$pull": {"photos": {"id": pid}}})
    await db.file_refs.update_one({"id": pid}, {"$set": {"is_deleted": True}})
    return {"ok": True}

@api.get("/files/{path:path}")
async def download_file(path: str, request: Request):
    token = None
    h = request.headers.get("Authorization", "")
    if h.startswith("Bearer "):
        token = h[7:]
    token = token or request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Yetkisiz")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Geçersiz token")
    ref = await db.file_refs.find_one({"path": path, "is_deleted": False})
    if not ref:
        raise HTTPException(404, "Dosya bulunamadı")
    # Tenant scoping: user can access files of own tenant OR public tenant assets (tenant_logo/moto_image if they belong to their tenant)
    user_tid = payload.get("tenant_id")
    if ref.get("tenant_id") and ref["tenant_id"] != user_tid and payload.get("role") != "super_admin":
        raise HTTPException(403, "Erişim engellendi")
    data, ct = await get_object(path)
    return Response(content=data, media_type=ref.get("content_type", ct))

# ---------- Signature ----------
class SignatureIn(BaseModel):
    signature: str  # base64 data URL

@api.post("/service-orders/{sid}/signature")
async def save_signature(sid: str, inp: SignatureIn, user=Depends(get_current_user)):
    if inp.signature:
        change = {"$set": {"customer_signature": inp.signature, "signed_at": now_iso(), "updated_at": now_iso()}}
    else:
        # Boş imza = imzanın temizlenmesi; imza tarihi de kaldırılmalı
        change = {"$unset": {"customer_signature": "", "signed_at": ""}, "$set": {"updated_at": now_iso()}}
    r = await db.service_orders.update_one(tf(user, {"id": sid}), change)
    if r.matched_count == 0:
        raise HTTPException(404, "Servis kaydı bulunamadı")
    return {"ok": True}

# ---------- PDF ----------
@api.get("/service-orders/{sid}/pdf/{kind}")
async def service_pdf(sid: str, kind: str, request: Request):
    # Token yalnızca başlık (Bearer) veya çerez ile kabul edilir; URL parametresi güvenlik açığıdır (loglarda sızar).
    if kind not in {"kabul", "teslim"}:
        raise HTTPException(400, "Geçersiz form türü")
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(401, "Yetkisiz")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Geçersiz token")
    tid = payload.get("tenant_id")
    order = await db.service_orders.find_one({"id": sid, "tenant_id": tid}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Servis kaydı bulunamadı")
    order["customer"] = await db.customers.find_one({"id": order["customer_id"]}, {"_id": 0})
    order["motorcycle"] = await db.motorcycles.find_one({"id": order["motorcycle_id"]}, {"_id": 0})
    tenant = await db.tenants.find_one({"id": tid}, {"_id": 0}) or {}
    # Load logo bytes if any
    logo_bytes = None
    if tenant.get("logo_path"):
        try:
            logo_bytes, _ = await get_object(tenant["logo_path"])
        except Exception:
            logo_bytes = None
    pdf_bytes = build_service_pdf(order, kind=kind, tenant=tenant, logo_bytes=logo_bytes)
    filename = f"{order['service_no']}-{kind}.pdf"
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="{filename}"'})

# ---------- WhatsApp Approval ----------
class ApprovalDecision(BaseModel):
    approve: bool
    note: str = ""

@api.post("/service-orders/{sid}/approval-link")
async def create_approval_link(sid: str, user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    so = await db.service_orders.find_one({"id": sid, "tenant_id": tid})
    if not so:
        raise HTTPException(404, "Servis kaydı bulunamadı")
    if so.get("status") in CLOSED_STATUSES:
        raise HTTPException(400, "Kapatılmış servis için onay bağlantısı oluşturulamaz")
    # Önceki karar varsa yeni bir onay turu başlar: yeni token (eski bağlantı geçersiz olur), durum "pending"
    decided = so.get("approval_status") in {"approved", "rejected"}
    token = secrets.token_urlsafe(24) if (decided or not so.get("approval_token")) else so["approval_token"]
    approval_status = "pending" if decided else so.get("approval_status", "pending")
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    await db.service_orders.update_one({"id": sid, "tenant_id": tid}, {"$set": {
        "approval_token": token, "approval_status": approval_status,
        "approval_expires_at": expires_at,
        "updated_at": now_iso(),
    }})
    frontend = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    approval_url = f"{frontend}/onay/{token}"
    phone = "".join(ch for ch in (so.get("customer_phone") or "") if ch.isdigit())
    if phone.startswith("0"):
        phone = "90" + phone[1:]
    elif not phone.startswith("90"):
        phone = "90" + phone
    grand = so.get("grand_total", 0)
    msg = (
        f"Merhaba {so.get('customer_name','')}, \n\n"
        f"Servis No: {so.get('service_no')}\n"
        f"Motosiklet: {so.get('brand','')} {so.get('model','')} ({so.get('plate','')})\n"
        f"Tahmini Tutar: {grand:,.2f} TL\n\n"
        f"Onaylamak/reddetmek için: {approval_url}\n"
        f"(Bağlantı 7 gün geçerlidir)"
    )
    from urllib.parse import quote
    wa_url = f"https://wa.me/{phone}?text={quote(msg)}"
    return {"token": token, "approval_url": approval_url, "whatsapp_url": wa_url, "message": msg, "expires_at": expires_at}

@api.get("/public/approval/{token}")
async def public_get_approval(token: str):
    so = await db.service_orders.find_one({"approval_token": token}, {"_id": 0})
    if not so:
        raise HTTPException(404, "Bağlantı geçersiz")
    exp = so.get("approval_expires_at")
    if exp and exp < datetime.now(timezone.utc).isoformat():
        raise HTTPException(410, "Bağlantının süresi doldu")
    tenant = await db.tenants.find_one({"id": so.get("tenant_id")}, {"_id": 0, "name": 1, "phone": 1, "logo_path": 1, "primary_color": 1}) or {}
    return {
        "service_no": so.get("service_no"),
        "customer_name": so.get("customer_name"),
        "brand": so.get("brand"), "model": so.get("model"), "plate": so.get("plate"),
        "complaint": so.get("complaint"), "diagnosis": so.get("diagnosis"),
        "items": so.get("items", []), "labor_total": so.get("labor_total", 0),
        "labor_price_mode": so.get("labor_price_mode", DEFAULT_PRICE_MODE), "labor_vat": so.get("labor_vat", DEFAULT_VAT),
        "labor_gross": so.get("labor_gross", 0), "parts_total": so.get("parts_total", 0),
        "services_total": so.get("services_total", 0), "subtotal": so.get("subtotal", 0),
        "vat_total": so.get("vat_total", 0), "net_total": so.get("net_total", 0),
        "discount": so.get("discount", 0), "grand_total": so.get("grand_total", 0),
        "approval_status": so.get("approval_status", "pending"),
        "approval_at": so.get("approval_at"),
        "tenant": tenant,
    }

@api.post("/public/approval/{token}")
async def public_decide_approval(token: str, inp: ApprovalDecision):
    so = await db.service_orders.find_one({"approval_token": token})
    if not so:
        raise HTTPException(404, "Bağlantı geçersiz")
    if so.get("approval_status") in {"approved", "rejected"}:
        return {"ok": True, "already": True, "approval_status": so["approval_status"]}
    exp = so.get("approval_expires_at")
    if exp and exp < datetime.now(timezone.utc).isoformat():
        raise HTTPException(410, "Bağlantının süresi doldu")
    if so.get("status") in CLOSED_STATUSES:
        raise HTTPException(400, "Bu servis kapatılmış; onay verilemez")
    decision = "approved" if inp.approve else "rejected"
    await db.service_orders.update_one({"id": so["id"]}, {"$set": {
        "approval_status": decision, "approval_at": now_iso(),
        "approval_note": inp.note, "updated_at": now_iso(),
    }})
    # Müşteri onayı yalnızca onay öncesi aşamada durumu değiştirir; işlerin ortasında (tamirde vb.) geriye çekilmez
    if so.get("status") in PRE_APPROVAL_STATUSES:
        if inp.approve:
            await _transition_order_status(so, "approved", "customer_approval", inp.note)
        elif float(so.get("paid_total") or 0) <= 0.005:
            await _transition_order_status(so, "cancelled", "customer_approval", inp.note)
    return {"ok": True, "approval_status": decision}

# ---------- Reminders (In-app) ----------
async def _compute_reminders(user, only_due: bool = False):
    from datetime import timedelta as _td
    tid = user["tenant_id"]
    tenant = await db.tenants.find_one({"id": tid}, {"_id": 0, "reminder_km":1, "reminder_months":1, "reminder_mode":1})
    r_km = int((tenant or {}).get("reminder_km") or 5000)
    r_months = int((tenant or {}).get("reminder_months") or 6)
    r_mode = ((tenant or {}).get("reminder_mode") or "or").lower()
    motos = await db.motorcycles.find({"tenant_id": tid}, {"_id": 0}).to_list(5000)
    # İptal edilmiş servis, "son bakım" sayılmaz
    orders = await db.service_orders.find({"tenant_id": tid, "status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(20000)
    latest_by_moto = {}
    for o in sorted(orders, key=lambda x: x.get("created_at") or ""):
        latest_by_moto[o["motorcycle_id"]] = o
    now = datetime.now(TR_TZ)  # gün farkı Türkiye takvimine göre hesaplanır
    overdue, upcoming, due = [], [], []
    for m in motos:
        last = latest_by_moto.get(m["id"])
        last_km = last.get("km", m.get("km", 0)) if last else m.get("km", 0)
        last_date = last.get("created_at") if last else m.get("created_at")
        next_km = (last_km or 0) + r_km
        current_km = m.get("km", 0) or last_km or 0
        km_over = current_km >= next_km  # customer already crossed threshold
        km_left = next_km - current_km  # informational
        next_date_iso = None; days_left = None; date_over = False
        if last_date:
            try:
                lastd = datetime.fromisoformat(last_date.replace("Z","+00:00"))
                nextd = lastd + _td(days=int(r_months * 30.4375))
                next_date_iso = nextd.isoformat()
                days_left = (nextd.astimezone(TR_TZ).date() - now.date()).days
                date_over = days_left <= 0
            except Exception:
                pass
        # Kural: r_mode = "or" → iki eşikten biri yeterli; "and" → ikisi birden gerekir
        if r_mode == "and":
            is_due = km_over and date_over
        else:
            is_due = km_over or date_over
        cust = await db.customers.find_one({"id": m["customer_id"]}, {"_id": 0, "first_name":1, "last_name":1, "phone":1})
        row = {
            "motorcycle_id": m["id"], "customer_id": m["customer_id"],
            "customer": cust, "brand": m.get("brand"), "model": m.get("model"), "plate": m.get("plate"),
            "last_km": last_km, "current_km": current_km, "next_km": next_km, "km_left": km_left,
            "last_service_date": last_date, "next_date": next_date_iso, "days_left": days_left,
            "km_over": km_over, "date_over": date_over, "is_due": is_due,
        }
        # Sınıflandırma politikayla tutarlıdır:
        #  due      → bakım zamanı geldi (AND/OR kuralına göre)
        #  overdue  → bakım zamanı geldi VE tarih eşiği geçmiş
        #  upcoming → henüz zamanı gelmedi ama tarih eşiğine 30 günden az kaldı
        if is_due:
            due.append(row)
            if days_left is not None and days_left < 0:
                overdue.append(row)
        elif days_left is not None and 0 <= days_left <= 30:
            upcoming.append(row)
    overdue.sort(key=lambda r: r.get("days_left") or 0)
    upcoming.sort(key=lambda r: r.get("days_left") or 0)
    due.sort(key=lambda r: (r.get("days_left") or 0, -(r.get("km_left") or 0)))
    return {"overdue": overdue, "upcoming": upcoming, "due": due,
            "policy": {"reminder_km": r_km, "reminder_months": r_months, "reminder_mode": r_mode}}

@api.get("/reminders")
async def reminders(user=Depends(get_current_user)):
    return await _compute_reminders(user)

@api.get("/reminders/export.csv")
async def reminders_csv(scope: str = "due", user=Depends(get_current_user)):
    data = await _compute_reminders(user)
    rows_map = {"due": data["due"], "overdue": data["overdue"], "upcoming": data["upcoming"]}
    rows = rows_map.get(scope, data["due"])
    lines = ["Motosiklet,Plaka,Müşteri,Telefon,Son KM,Şu Anki KM,Sonraki KM,Son Servis,Sonraki Bakım,Gün"]
    def esc(v): return f'"{str(v or "").replace(chr(34), chr(34)*2)}"'
    for r in rows:
        c = r.get("customer") or {}
        lines.append(",".join([
            esc(f"{r.get('brand','')} {r.get('model','')}"), esc(r.get("plate")),
            esc(f"{c.get('first_name','')} {c.get('last_name','')}"),
            esc(c.get("phone")), esc(r.get("last_km")), esc(r.get("current_km")),
            esc(r.get("next_km")), esc((r.get("last_service_date") or "")[:10]),
            esc((r.get("next_date") or "")[:10]), esc(r.get("days_left")),
        ]))
    csv_body = "\ufeff" + "\n".join(lines)
    return Response(content=csv_body, media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="hatirlatmalar_{scope}.csv"'})

class WhatsappBatchIn(BaseModel):
    motorcycle_ids: List[str] = []
    template: Optional[str] = ""  # supports {{name}}, {{plate}}, {{brand_model}}, {{km}}

@api.post("/reminders/whatsapp-batch")
async def reminders_whatsapp_batch(inp: WhatsappBatchIn, user=Depends(get_current_user)):
    tid = user["tenant_id"]
    tenant = await db.tenants.find_one({"id": tid}, {"_id": 0, "name": 1}) or {}
    default_tmpl = (
        f"Merhaba {{{{name}}}}, {tenant.get('name') or 'servisimiz'} — "
        "{{brand_model}} ({{plate}}) motosikletiniz için bakım zamanı gelmiş görünüyor. "
        "Randevu için bize ulaşabilir misiniz?"
    )
    tmpl = (inp.template or default_tmpl).strip()
    if not inp.motorcycle_ids:
        raise HTTPException(400, "En az bir motosiklet seçin")
    motos = await db.motorcycles.find({"tenant_id": tid, "id": {"$in": inp.motorcycle_ids}}, {"_id": 0}).to_list(5000)
    cust_ids = list({m["customer_id"] for m in motos})
    custs = {c["id"]: c for c in await db.customers.find({"tenant_id": tid, "id": {"$in": cust_ids}}, {"_id": 0}).to_list(5000)}
    from urllib.parse import quote
    def _clean_phone(p):
        p = "".join(ch for ch in (p or "") if ch.isdigit())
        if p.startswith("0"): p = "90" + p[1:]
        elif not p.startswith("90") and len(p) == 10: p = "90" + p
        return p
    out = []
    skipped = 0
    for m in motos:
        c = custs.get(m["customer_id"]) or {}
        phone = _clean_phone(c.get("phone"))
        if not phone or len(phone) < 11:
            skipped += 1; continue
        name = f"{c.get('first_name','')} {c.get('last_name','')}".strip() or "Sayın Müşterimiz"
        msg = (tmpl.replace("{{name}}", name)
                   .replace("{{plate}}", m.get("plate","") or "")
                   .replace("{{brand_model}}", f"{m.get('brand','')} {m.get('model','')}".strip())
                   .replace("{{km}}", str(m.get("km") or "")))
        out.append({
            "motorcycle_id": m["id"], "customer_id": m["customer_id"],
            "name": name, "phone": phone,
            "url": f"https://wa.me/{phone}?text={quote(msg)}",
            "message": msg,
        })
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": user["email"],
        "action": "reminders.whatsapp_batch", "entity_id": None,
        "new_value": f"{len(out)} link hazırlandı", "at": now_iso(),
    })
    return {"links": out, "skipped_no_phone": skipped}

# ---------- Cron: Daily Reminders Digest ----------
import hmac
from fastapi import BackgroundTasks

async def _build_reminder_links_for_tenant(tenant_id: str) -> Dict[str, Any]:
    """Compute due reminders for a tenant and return ready-to-send WhatsApp links."""
    from urllib.parse import quote
    fake_user = {"tenant_id": tenant_id, "role": "admin", "email": "cron@system"}
    data = await _compute_reminders(fake_user)
    due = data["due"]
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0, "name": 1}) or {}
    tmpl = (
        f"Merhaba {{name}}, {tenant.get('name') or 'servisimiz'} — "
        "{brand_model} ({plate}) motosikletiniz için bakım zamanı gelmiş görünüyor. "
        "Randevu için bize ulaşabilir misiniz?"
    )
    def _clean_phone(p):
        p = "".join(ch for ch in (p or "") if ch.isdigit())
        if p.startswith("0"): p = "90" + p[1:]
        elif not p.startswith("90") and len(p) == 10: p = "90" + p
        return p
    links = []
    skipped = 0
    for r in due:
        c = r.get("customer") or {}
        phone = _clean_phone(c.get("phone"))
        if not phone or len(phone) < 11:
            skipped += 1; continue
        name = f"{c.get('first_name','')} {c.get('last_name','')}".strip() or "Sayın Müşterimiz"
        msg = (tmpl.replace("{name}", name)
                   .replace("{plate}", r.get("plate","") or "")
                   .replace("{brand_model}", f"{r.get('brand','')} {r.get('model','')}".strip()))
        links.append({
            "motorcycle_id": r["motorcycle_id"], "customer_id": r["customer_id"],
            "name": name, "phone": phone,
            "brand_model": f"{r.get('brand','')} {r.get('model','')}".strip(),
            "plate": r.get("plate"), "days_left": r.get("days_left"),
            "km_over": r.get("km_over"), "date_over": r.get("date_over"),
            "url": f"https://wa.me/{phone}?text={quote(msg)}", "message": msg,
        })
    return {"links": links, "skipped_no_phone": skipped, "due_count": len(due)}

async def _run_reminders_digest():
    """Run digest for all active tenants and store one document per tenant per day."""
    today = local_today()
    tenants = await db.tenants.find({"is_active": {"$ne": False}}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
    total_links = 0
    failed = 0
    for t in tenants:
        # Bir firmanın hatası diğer firmaların bildirimlerini engellemez
        try:
            result = await _build_reminder_links_for_tenant(t["id"])
        except Exception as e:
            failed += 1
            logger.exception(f"reminders digest failed for tenant {t['id']}: {e}")
            continue
        doc = {
            "id": uid(), "tenant_id": t["id"], "date": today,
            "links": result["links"], "skipped_no_phone": result["skipped_no_phone"],
            "due_count": result["due_count"], "generated_at": now_iso(),
        }
        # upsert one document per day per tenant
        await db.reminder_digests.update_one(
            {"tenant_id": t["id"], "date": today},
            {"$set": doc}, upsert=True,
        )
        total_links += len(result["links"])
    await db.audit_logs.insert_one({
        "id": uid(), "user": "cron@system", "action": "cron.reminders_digest",
        "new_value": f"{len(tenants)} firma, {total_links} link, {failed} hata", "at": now_iso(),
    })
    logger.info(f"reminders digest: {len(tenants)} tenants, {total_links} links")
    # Also purge expired trash on the same daily run
    try:
        await _run_trash_purge()
    except Exception as e:
        logger.warning(f"trash purge failed: {e}")

@api.post("/cron/reminders-digest")
async def cron_reminders_digest(background: BackgroundTasks, authorization: str = Header(default="")):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    if not WEBHOOK_CRON_SECRET:
        raise HTTPException(status_code=500, detail="WEBHOOK_CRON_SECRET yapılandırılmamış")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")
    if not hmac.compare_digest(authorization.split(" ", 1)[1], WEBHOOK_CRON_SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")
    background.add_task(_run_reminders_digest)
    return {"accepted": True}

@api.get("/dashboard/reminders-today")
async def dashboard_reminders_today(user=Depends(get_current_user)):
    today = local_today()
    doc = await db.reminder_digests.find_one(
        {"tenant_id": user["tenant_id"], "date": today}, {"_id": 0}
    )
    if not doc:
        return {"date": today, "links": [], "due_count": 0, "skipped_no_phone": 0, "generated_at": None}
    return doc

@api.post("/dashboard/reminders-today/regenerate")
async def regenerate_today_digest(user=Depends(get_current_user)):
    """Allow tenant admin to manually rebuild today's digest without waiting for cron."""
    tid = tenant_id_of(user)  # Süper Admin'in firma bağlamı yoktur
    if user["role"] != "admin":
        raise HTTPException(403, "Yetkiniz yok")
    result = await _build_reminder_links_for_tenant(tid)
    today = local_today()
    doc = {
        "id": uid(), "tenant_id": user["tenant_id"], "date": today,
        "links": result["links"], "skipped_no_phone": result["skipped_no_phone"],
        "due_count": result["due_count"], "generated_at": now_iso(),
    }
    await db.reminder_digests.update_one(
        {"tenant_id": user["tenant_id"], "date": today},
        {"$set": doc}, upsert=True,
    )
    return doc

# ---------- Quotes (Price Quote / Fiyat Teklifi) ----------
class QuoteItemIn(BaseModel):
    kind: str  # part | service
    ref_id: Optional[str] = None
    name: str
    qty: float = 1  # kesirli adet (ör. yağ 0.5 L) desteklenir
    unit_price: float = 0
    price_mode: str = DEFAULT_PRICE_MODE  # incl (KDV dahil) | excl (KDV hariç)
    vat: float = DEFAULT_VAT

class QuoteIn(BaseModel):
    customer_id: str
    motorcycle_id: str
    items: List[QuoteItemIn] = []
    labor_total: float = 0
    labor_price_mode: str = DEFAULT_PRICE_MODE
    labor_vat: float = DEFAULT_VAT
    discount: float = 0
    notes: Optional[str] = ""
    valid_until: Optional[str] = None  # ISO date

def _quote_totals(payload):
    """Teklif toplamları servis emriyle aynı kuraldan hesaplanır (totals.py). Onaylanan teklif tutarı, iş emrine
    dönüştürüldüğünde değişmez. subtotal işçilik dahil, iskonto öncesi tutardır."""
    t = compute_document_totals(
        payload.get("items", []),
        labor_total=payload.get("labor_total", 0),
        labor_price_mode=payload.get("labor_price_mode", DEFAULT_PRICE_MODE),
        labor_vat=payload.get("labor_vat", DEFAULT_VAT),
        discount=payload.get("discount", 0),
    )
    return {k: t[k] for k in ("subtotal", "vat_total", "labor_total", "labor_gross", "discount",
                              "grand_total", "parts_total", "services_total", "net_total")}

@api.get("/quotes")
async def list_quotes(status: str = "", user=Depends(get_current_user)):
    q = tf(user)
    if status: q["status"] = status
    docs = await db.quotes.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    # enrich
    cust_ids = list({d["customer_id"] for d in docs})
    moto_ids = list({d["motorcycle_id"] for d in docs})
    custs = {c["id"]: c for c in await db.customers.find({"id": {"$in": cust_ids}}, {"_id":0}).to_list(2000)}
    motos = {m["id"]: m for m in await db.motorcycles.find({"id": {"$in": moto_ids}}, {"_id":0}).to_list(2000)}
    for d in docs:
        c = custs.get(d["customer_id"]) or {}
        m = motos.get(d["motorcycle_id"]) or {}
        d["customer_name"] = f"{c.get('first_name','')} {c.get('last_name','')}".strip()
        d["motorcycle_label"] = f"{m.get('brand','')} {m.get('model','')} · {m.get('plate','')}"
    return docs

@api.post("/quotes")
async def create_quote(inp: QuoteIn, user=Depends(get_current_user)):
    # Validate references belong to tenant
    if not await db.customers.find_one(tf(user, {"id": inp.customer_id}), {"_id":0, "id":1}):
        raise HTTPException(400, "Müşteri bulunamadı")
    if not await db.motorcycles.find_one(tf(user, {"id": inp.motorcycle_id}), {"_id":0, "id":1}):
        raise HTTPException(400, "Motosiklet bulunamadı")
    if not inp.items:
        raise HTTPException(400, "En az bir kalem gerekli")
    payload = inp.model_dump()
    check_document_money(payload, min_qty_positive=True)
    totals = _quote_totals(payload)
    quote_no = f"TKF-{datetime.now(timezone.utc).year}-{uid()[:6].upper()}"
    doc = {
        **payload, **totals,
        "id": uid(), "tenant_id": user["tenant_id"], "quote_no": quote_no,
        "status": "draft",  # draft | sent | approved | rejected | expired | converted
        "share_token": uid().replace("-", ""),
        "created_at": now_iso(), "created_by": user["email"],
        "approval": None,  # {name, action, at}
        "converted_service_order_id": None,
    }
    for it in doc["items"]:
        it["id"] = uid()
    await db.quotes.insert_one(doc)
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": user["tenant_id"], "user": user["email"],
        "action": "quote.create", "entity_id": doc["id"],
        "new_value": quote_no, "at": now_iso(),
    })
    doc.pop("_id", None)
    return doc

@api.get("/quotes/{qid}")
async def get_quote(qid: str, user=Depends(get_current_user)):
    d = await db.quotes.find_one(tf(user, {"id": qid}), {"_id": 0})
    if not d: raise HTTPException(404, "Teklif bulunamadı")
    return d

@api.put("/quotes/{qid}")
async def update_quote(qid: str, inp: QuoteIn, user=Depends(get_current_user)):
    existing = await db.quotes.find_one(tf(user, {"id": qid}), {"_id":0})
    if not existing: raise HTTPException(404, "Teklif bulunamadı")
    if existing.get("status") in ("approved", "converted"):
        raise HTTPException(400, "Onaylanmış/dönüştürülmüş teklif düzenlenemez")
    if not await db.customers.find_one(tf(user, {"id": inp.customer_id}), {"_id": 0, "id": 1}):
        raise HTTPException(400, "Müşteri bulunamadı")
    if not await db.motorcycles.find_one(tf(user, {"id": inp.motorcycle_id}), {"_id": 0, "id": 1}):
        raise HTTPException(400, "Motosiklet bulunamadı")
    payload = inp.model_dump()
    if not payload.get("items"):
        raise HTTPException(400, "En az bir kalem gerekli")
    check_document_money(payload, min_qty_positive=True)
    totals = _quote_totals(payload)
    for it in payload["items"]:
        it["id"] = it.get("id") or uid()
    new_data = {**payload, **totals}
    # Müşterinin gördüğü (gönderilmiş / reddedilmiş / süresi dolmuş) teklif değiştirilirse
    # yeni fiyatla yeniden gönderilmesi gerekir: durum taslağa döner ve eski onay temizlenir.
    if existing.get("status") in ("sent", "rejected", "expired"):
        new_data["status"] = "draft"
        new_data["approval"] = None
    await db.quotes.update_one(tf(user, {"id": qid}), {"$set": new_data})
    changes = _diff_dicts(existing, new_data, ignore={"id", "tenant_id", "share_token", "created_at", "created_by", "quote_no", "status", "items"})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": user["tenant_id"], "user": user["email"],
        "action": "quote.update", "entity_id": qid, "changes": changes, "at": now_iso(),
    })
    return await db.quotes.find_one({"id": qid}, {"_id": 0})

@api.delete("/quotes/{qid}")
async def delete_quote(qid: str, user=Depends(get_current_user)):
    q = await db.quotes.find_one(tf(user, {"id": qid}), {"_id": 0, "status": 1})
    if not q:
        raise HTTPException(404, "Teklif bulunamadı")
    if q.get("status") == "converted":
        raise HTTPException(400, "İş emrine dönüştürülmüş teklif silinemez")
    await db.quotes.delete_one(tf(user, {"id": qid}))
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": user["tenant_id"], "user": user["email"],
        "action": "quote.delete", "entity_id": qid, "at": now_iso(),
    })
    return {"ok": True}

@api.post("/quotes/{qid}/send")
async def mark_quote_sent(qid: str, user=Depends(get_current_user)):
    r = await db.quotes.update_one(tf(user, {"id": qid, "status": {"$in":["draft","sent","rejected"]}}),
                                    {"$set": {"status":"sent", "sent_at": now_iso()}})
    if r.matched_count == 0: raise HTTPException(400, "Teklif gönderilebilir durumda değil")
    return await db.quotes.find_one({"id": qid}, {"_id": 0})

@api.post("/quotes/{qid}/convert")
async def convert_quote_to_order(qid: str, user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    q = await db.quotes.find_one(tf(user, {"id": qid}), {"_id": 0})
    if not q: raise HTTPException(404, "Teklif bulunamadı")
    if q.get("status") not in ("approved", "sent", "draft"):
        raise HTTPException(400, "Teklif dönüştürülebilir durumda değil")
    if q.get("converted_service_order_id"):
        raise HTTPException(400, "Bu teklif zaten iş emrine dönüştürüldü")
    cust = await db.customers.find_one({"id": q["customer_id"], "tenant_id": tid}, {"_id": 0})
    moto = await db.motorcycles.find_one({"id": q["motorcycle_id"], "tenant_id": tid}, {"_id": 0})
    if not cust or not moto:
        raise HTTPException(400, "Teklifteki müşteri veya motosiklet artık mevcut değil")
    # Aynı teklifin iki kez dönüştürülmesini engelle: durum koşullu olarak "converted" yapılır
    claim = await db.quotes.update_one(
        {"id": qid, "tenant_id": tid, "converted_service_order_id": None,
         "status": {"$in": ["approved", "sent", "draft"]}},
        {"$set": {"status": "converted", "converted_at": now_iso()}},
    )
    if claim.modified_count == 0:
        raise HTTPException(400, "Bu teklif zaten iş emrine dönüştürüldü")
    try:
        items = [dict(it, id=uid()) for it in q.get("items", [])]
        labor_fields = {
            "labor_total": q.get("labor_total", 0),
            "labor_price_mode": q.get("labor_price_mode", DEFAULT_PRICE_MODE),
            "labor_vat": q.get("labor_vat", DEFAULT_VAT),
            "discount": q.get("discount", 0),
        }
        totals = compute_totals({"items": items, **labor_fields})
        service_no = await next_service_no(tid)  # servis numarası tek sayaçtan üretilir (çakışma olmaz)
        now = now_iso()
        so = {
            "id": uid(), "tenant_id": tid, "service_no": service_no,
            "customer_id": q["customer_id"], "motorcycle_id": q["motorcycle_id"],
            "customer_name": f"{cust['first_name']} {cust['last_name']}",
            "customer_phone": cust.get("phone"),
            "plate": moto.get("plate"), "brand": moto.get("brand"), "model": moto.get("model"),
            "moto_type": moto.get("type"),
            "km": moto.get("km") or 0, "fuel_level": "1/2", "accessories": [], "fault_zones": [],
            "complaint": "", "diagnosis": q.get("notes") or "", "operations": "",
            "notes": f"Teklif {q.get('quote_no')} üzerinden oluşturuldu.",
            "items": items, **labor_fields, **totals,
            "status": "new", "paid_total": 0,
            "created_at": now, "updated_at": now, "created_by": user["email"],
            "status_history": [{"status": "new", "at": now, "by": user["email"], "note": "Tekliften oluşturuldu"}],
            "source_quote_id": qid,
        }
        await db.service_orders.insert_one(so)
        # Parçalar stoktan düşer ve tutar cari hesaba borç olarak yazılır (normal servis oluşturmayla aynı)
        await _move_part_stock(tid, items, -1)
        if so["grand_total"] > 0:
            await db.transactions.insert_one({
                "id": uid(), "tenant_id": tid, "customer_id": q["customer_id"], "type": "charge",
                "amount": so["grand_total"], "service_order_id": so["id"], "service_no": service_no,
                "description": f"Servis: {service_no}", "created_at": now,
            })
    except Exception:
        # Oluşturma başarısızsa teklif yeniden dönüştürülebilir hale getirilir
        await db.quotes.update_one({"id": qid, "tenant_id": tid},
                                   {"$set": {"status": q.get("status")}, "$unset": {"converted_at": ""}})
        raise
    await db.quotes.update_one({"id": qid, "tenant_id": tid}, {"$set": {"converted_service_order_id": so["id"]}})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": user["email"],
        "action": "quote.convert", "entity_id": qid,
        "new_value": service_no, "at": now_iso(),
    })
    return {"service_order_id": so["id"], "service_no": service_no}

# ---------- Public quote endpoints (share link) ----------
@api.get("/public/quotes/{token}")
async def public_get_quote(token: str):
    q = await db.quotes.find_one({"share_token": token}, {"_id": 0, "created_by": 0})
    if not q: raise HTTPException(404, "Teklif bulunamadı")
    tenant_id = q.pop("tenant_id", None)  # iç alan, müşteriye gösterilmez
    # Enrich
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0, "name":1, "phone":1, "address":1, "primary_color":1, "logo_path":1})
    cust = await db.customers.find_one({"id": q["customer_id"]}, {"_id":0, "first_name":1, "last_name":1})
    moto = await db.motorcycles.find_one({"id": q["motorcycle_id"]}, {"_id":0, "brand":1, "model":1, "plate":1, "year":1})
    q["tenant"] = tenant or {}
    q["customer"] = cust or {}
    q["motorcycle"] = moto or {}
    return q

class PublicQuoteApproveIn(BaseModel):
    action: str  # approve | reject
    customer_name: str
    note: Optional[str] = ""

@api.post("/public/quotes/{token}/approve")
async def public_quote_approve(token: str, inp: PublicQuoteApproveIn):
    if inp.action not in ("approve", "reject"):
        raise HTTPException(400, "Geçersiz işlem")
    if not inp.customer_name.strip():
        raise HTTPException(400, "Ad Soyad zorunlu")
    q = await db.quotes.find_one({"share_token": token}, {"_id": 0})
    if not q: raise HTTPException(404, "Teklif bulunamadı")
    if q.get("status") in ("approved", "rejected", "converted", "expired"):
        raise HTTPException(400, f"Bu teklif zaten {q['status']} durumda")
    # Expiry check
    vu = q.get("valid_until")
    if vu:
        try:
            if datetime.fromisoformat(vu.replace("Z","+00:00")) < datetime.now(timezone.utc):
                await db.quotes.update_one({"id": q["id"]}, {"$set": {"status":"expired"}})
                raise HTTPException(400, "Teklifin geçerlilik süresi dolmuş")
        except HTTPException: raise
        except Exception: pass
    new_status = "approved" if inp.action == "approve" else "rejected"
    approval = {"name": inp.customer_name.strip(), "action": inp.action,
                "note": inp.note, "at": now_iso()}
    await db.quotes.update_one({"id": q["id"]}, {"$set": {"status": new_status, "approval": approval}})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": q["tenant_id"], "user": f"public:{inp.customer_name.strip()}",
        "action": f"quote.{new_status}", "entity_id": q["id"],
        "new_value": inp.customer_name.strip(), "at": now_iso(),
    })
    return {"ok": True, "status": new_status}

# ---------- Ekspertiz (araç muayene raporu) ----------
INSPECTION_CHECKLIST: List[Dict[str, str]] = [
    {"key": "motor_performans", "label": "Motor çalışması ve performans", "group": "Motor & Şanzıman"},
    {"key": "motor_yag", "label": "Yağ seviyesi ve kaçak", "group": "Motor & Şanzıman"},
    {"key": "sogutma", "label": "Soğutma sıvısı ve radyatör", "group": "Motor & Şanzıman"},
    {"key": "transmisyon", "label": "Zincir, kayış veya şanzıman", "group": "Motor & Şanzıman"},
    {"key": "fren_on", "label": "Ön fren", "group": "Fren Sistemi"},
    {"key": "fren_arka", "label": "Arka fren", "group": "Fren Sistemi"},
    {"key": "fren_balata", "label": "Fren balataları ve diskler", "group": "Fren Sistemi"},
    {"key": "fren_hidrolik", "label": "Fren hidroliği ve hortumlar", "group": "Fren Sistemi"},
    {"key": "sus_on", "label": "Ön süspansiyon (çatal)", "group": "Süspansiyon"},
    {"key": "sus_arka", "label": "Arka amortisör", "group": "Süspansiyon"},
    {"key": "direksiyon", "label": "Direksiyon kafası ve rulmanlar", "group": "Süspansiyon"},
    {"key": "aku", "label": "Akü durumu ve şarj", "group": "Elektrik & Aydınlatma"},
    {"key": "far", "label": "Far, stop ve sinyaller", "group": "Elektrik & Aydınlatma"},
    {"key": "gosterge", "label": "Gösterge paneli ve kontroller", "group": "Elektrik & Aydınlatma"},
    {"key": "kablolama", "label": "Kablolama ve sigortalar", "group": "Elektrik & Aydınlatma"},
    {"key": "lastik_on", "label": "Ön lastik (diş derinliği, yaşlanma)", "group": "Lastik & Jant"},
    {"key": "lastik_arka", "label": "Arka lastik (diş derinliği, yaşlanma)", "group": "Lastik & Jant"},
    {"key": "jant", "label": "Jant ve rot balans", "group": "Lastik & Jant"},
    {"key": "govde", "label": "Gövde ve plastik parçalar", "group": "Gövde & Boya"},
    {"key": "boya", "label": "Boya durumu", "group": "Gövde & Boya"},
    {"key": "yakit", "label": "Yakıt sistemi ve sızıntı", "group": "Yakıt & Egzoz"},
    {"key": "egzoz", "label": "Egzoz sistemi ve ses", "group": "Yakıt & Egzoz"},
    {"key": "kilit", "label": "Kilitler ve anahtarlar", "group": "Diğer"},
]
INSPECTION_STATUSES = ("good", "medium", "service")  # İYİ, ORTA, BAKIM
INSPECTION_MAX_ITEMS = 60
INSPECTION_MAX_PHOTOS = 60
INSPECTION_PHOTO_MAX_BYTES = 10 * 1024 * 1024
PHOTO_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

class InspectionItemIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    key: str
    label: Optional[str] = ""
    group: Optional[str] = ""
    status: Optional[str] = None  # good | medium | service | null (işaretlenmedi)
    note: Optional[str] = ""

class InspectionIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    customer_id: Optional[str] = None
    motorcycle_id: Optional[str] = None
    owner_name: Optional[str] = ""
    customer_phone: Optional[str] = ""
    plate: Optional[str] = ""
    make_model: Optional[str] = ""
    year: Union[int, str, None] = ""
    km: Union[int, str, None] = ""
    chassis_no: Optional[str] = ""
    inspection_date: Optional[str] = None  # YYYY-MM-DD; boşsa bugün
    technician_name: Optional[str] = ""
    receiver_name: Optional[str] = ""
    notes: Optional[str] = ""
    items: List[InspectionItemIn] = []

def _text(value: Any, limit: int = 300) -> str:
    return "" if value is None else str(value).strip()[:limit]

def _inspection_items(raw: List[InspectionItemIn]) -> List[Dict[str, Any]]:
    """Gelen kontrol maddelerini doğrular; boş listede şablon kullanılır."""
    template = {x["key"]: x for x in INSPECTION_CHECKLIST}
    source = raw or [InspectionItemIn(**x) for x in INSPECTION_CHECKLIST]
    if len(source) > INSPECTION_MAX_ITEMS:
        raise HTTPException(400, "Kontrol listesi çok uzun")
    out: List[Dict[str, Any]] = []
    seen: set = set()
    for it in source:
        key = _text(it.key, 64)
        if not key:
            raise HTTPException(400, "Kontrol maddesi anahtarı boş olamaz")
        status = it.status or None
        if status and status not in INSPECTION_STATUSES:
            raise HTTPException(400, "Geçersiz kontrol durumu")
        if key in seen:
            continue
        seen.add(key)
        base = template.get(key, {})
        out.append({
            "key": key,
            "label": _text(it.label, 200) or base.get("label", key),
            "group": _text(it.group, 80) or base.get("group", "Diğer"),
            "status": status,
            "note": _text(it.note, 1000),
        })
    return out

async def _inspection_fields(tid: str, inp: InspectionIn) -> Dict[str, Any]:
    """Girdiyi doğrular; müşteri/motosiklet seçiliyse boş alanları kayıttan doldurur."""
    moto = None
    if inp.motorcycle_id:
        moto = await db.motorcycles.find_one({"id": inp.motorcycle_id, "tenant_id": tid}, {"_id": 0})
        if not moto:
            raise HTTPException(400, "Motosiklet bulunamadı")
    customer_id = inp.customer_id or (moto or {}).get("customer_id") or None
    cust = None
    if customer_id:
        cust = await db.customers.find_one({"id": customer_id, "tenant_id": tid}, {"_id": 0})
        if not cust:
            raise HTTPException(400, "Müşteri bulunamadı")
    if moto and cust and moto.get("customer_id") != cust["id"]:
        raise HTTPException(400, "Motosiklet bu müşteriye ait değil")
    inspection_date = _text(inp.inspection_date, 10) or datetime.now(TR_TZ).date().isoformat()
    if not _DATE_RE.match(inspection_date):
        raise HTTPException(400, "Tarih biçimi YYYY-AA-GG olmalı")
    year = inp.year if inp.year not in (None, "") else (moto or {}).get("year")
    km = inp.km if inp.km not in (None, "") else (moto or {}).get("km")
    owner_default = f"{cust.get('first_name', '')} {cust.get('last_name', '')}".strip() if cust else ""
    model_default = f"{moto.get('brand', '')} {moto.get('model', '')}".strip() if moto else ""
    return {
        "customer_id": customer_id,
        "motorcycle_id": inp.motorcycle_id or None,
        "owner_name": _text(inp.owner_name, 120) or owner_default,
        "customer_phone": _text(inp.customer_phone, 30) or (cust or {}).get("phone", ""),
        "plate": _text(inp.plate, 20).upper().replace(" ", "") or (moto or {}).get("plate", ""),
        "make_model": _text(inp.make_model, 120) or model_default,
        "year": _text(year, 10),
        "km": _text(km, 12),
        "chassis_no": _text(inp.chassis_no, 40).upper() or (moto or {}).get("vin", "") or "",
        "inspection_date": inspection_date,
        "technician_name": _text(inp.technician_name, 120),
        "receiver_name": _text(inp.receiver_name, 120),
        "notes": _text(inp.notes, 4000),
        "items": _inspection_items(inp.items),
    }

async def next_inspection_no(tenant_id: str) -> str:
    counter = await db.counters.find_one_and_update(
        {"_id": f"inspection_{tenant_id}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    seq = counter["seq"] if counter else 1
    return f"EKS-{seq:05d}"

def _item_counts(items: List[Dict[str, Any]]) -> Dict[str, int]:
    counts = {"good": 0, "medium": 0, "service": 0, "open": 0}
    for it in items or []:
        counts[it.get("status") if it.get("status") in INSPECTION_STATUSES else "open"] += 1
    return counts

async def _get_inspection(tid: str, iid: str) -> Dict[str, Any]:
    doc = await db.inspections.find_one({"id": iid, "tenant_id": tid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Ekspertiz raporu bulunamadı")
    return doc

@api.get("/inspections/checklist-template")
async def inspection_checklist_template(user=Depends(get_current_user)):
    tenant_id_of(user)
    return [dict(x) for x in INSPECTION_CHECKLIST]

@api.get("/inspections")
async def list_inspections(q: str = "", limit: int = Query(100, ge=1, le=500), user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    query: Dict[str, Any] = {"tenant_id": tid}
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"report_no": rx}, {"owner_name": rx}, {"plate": rx}, {"chassis_no": rx}, {"inspection_date": rx}]
    docs = await db.inspections.find(query, {"_id": 0, "photos": 0, "share_token": 0}).sort("created_at", -1).to_list(limit)
    out = []
    for d in docs:
        items = d.pop("items", [])
        d["item_counts"] = _item_counts(items)
        out.append(d)
    return out

@api.post("/inspections")
async def create_inspection(inp: InspectionIn, user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    fields = await _inspection_fields(tid, inp)
    now = now_iso()
    doc = {
        **fields, "id": uid(), "tenant_id": tid, "report_no": await next_inspection_no(tid),
        "photos": [], "share_token": None,
        "created_at": now, "updated_at": now, "created_by": user["email"],
    }
    await db.inspections.insert_one(doc)
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": user["email"], "action": "inspection.create",
        "entity_id": doc["id"], "new_value": doc["report_no"], "at": now_iso(),
    })
    doc.pop("_id", None)
    return doc

@api.get("/inspections/{iid}")
async def get_inspection(iid: str, user=Depends(get_current_user)):
    return await _get_inspection(tenant_id_of(user), iid)

@api.put("/inspections/{iid}")
async def update_inspection(iid: str, inp: InspectionIn, user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    existing = await _get_inspection(tid, iid)
    fields = await _inspection_fields(tid, inp)
    fields["updated_at"] = now_iso()
    fields["updated_by"] = user["email"]
    changes = _diff_dicts(existing, {**existing, **fields},
                          ignore={"id", "tenant_id", "report_no", "photos", "items", "share_token",
                                  "created_at", "created_by", "updated_at", "updated_by"})
    await db.inspections.update_one({"id": iid, "tenant_id": tid}, {"$set": fields})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": user["email"], "action": "inspection.update",
        "entity_id": iid, "changes": changes, "at": now_iso(),
    })
    return await _get_inspection(tid, iid)

@api.delete("/inspections/{iid}")
async def delete_inspection(iid: str, user=Depends(require_role("admin"))):
    tid = tenant_id_of(user)
    existing = await _get_inspection(tid, iid)
    await db.inspections.delete_one({"id": iid, "tenant_id": tid})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": user["email"], "action": "inspection.delete",
        "entity_id": iid, "old_value": existing.get("report_no"), "at": now_iso(),
    })
    return {"ok": True}

@api.post("/inspections/{iid}/photos")
async def upload_inspection_photo(iid: str, file: UploadFile = File(...), item_key: str = Form(...),
                                  user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    doc = await db.inspections.find_one({"id": iid, "tenant_id": tid}, {"_id": 0, "items": 1, "photos": 1})
    if not doc:
        raise HTTPException(404, "Ekspertiz raporu bulunamadı")
    if item_key not in {it.get("key") for it in doc.get("items", [])}:
        raise HTTPException(400, "Geçersiz kontrol maddesi")
    if len(doc.get("photos", [])) >= INSPECTION_MAX_PHOTOS:
        raise HTTPException(400, f"Bir raporda en fazla {INSPECTION_MAX_PHOTOS} fotoğraf olabilir")
    name = file.filename or ""
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in PHOTO_EXTENSIONS or (file.content_type and not file.content_type.startswith("image/")):
        raise HTTPException(400, "Sadece görsel dosyaları yüklenebilir")
    data = await file.read(INSPECTION_PHOTO_MAX_BYTES + 1)
    if not data:
        raise HTTPException(400, "Dosya boş")
    if len(data) > INSPECTION_PHOTO_MAX_BYTES:
        raise HTTPException(400, "Fotoğraf en fazla 10 MB olabilir")
    photo_id = uid()
    content_type = file.content_type or "image/jpeg"
    path = f"{APP_NAME}/tenants/{tid}/inspections/{iid}/{photo_id}.{ext}"
    result = await put_object(path, data, content_type)
    photo = {
        "id": photo_id, "item_key": item_key, "path": result["path"], "filename": name or f"foto.{ext}",
        "content_type": content_type, "size": result.get("size", len(data)),
        "created_at": now_iso(), "uploaded_by": user["email"],
    }
    await db.inspections.update_one({"id": iid, "tenant_id": tid}, {"$push": {"photos": photo}})
    return {k: v for k, v in photo.items() if k != "path"}

@api.get("/inspections/{iid}/photos/{pid}")
async def get_inspection_photo(iid: str, pid: str, user=Depends(get_current_user_flex)):
    tid = tenant_id_of(user)
    doc = await db.inspections.find_one({"id": iid, "tenant_id": tid}, {"_id": 0, "photos": 1})
    photo = next((p for p in (doc or {}).get("photos", []) if p.get("id") == pid), None)
    if not photo:
        raise HTTPException(404, "Fotoğraf bulunamadı")
    try:
        data, ct = await get_object(photo["path"])
    except FileNotFoundError:
        raise HTTPException(404, "Fotoğraf bulunamadı")
    return Response(content=data, media_type=photo.get("content_type") or ct,
                    headers={"Cache-Control": "private, max-age=300"})

@api.delete("/inspections/{iid}/photos/{pid}")
async def delete_inspection_photo(iid: str, pid: str, user=Depends(get_current_user)):
    tid = tenant_id_of(user)
    res = await db.inspections.update_one({"id": iid, "tenant_id": tid, "photos.id": pid},
                                          {"$pull": {"photos": {"id": pid}}})
    if res.modified_count == 0:
        raise HTTPException(404, "Fotoğraf bulunamadı")
    return {"ok": True}

async def _inspection_pdf_bytes(doc: Dict[str, Any], tenant: Dict[str, Any]) -> bytes:
    photo_bytes: Dict[str, bytes] = {}
    for p in doc.get("photos", []):
        try:
            photo_bytes[p["id"]], _ = await get_object(p["path"])
        except Exception:
            continue
    logo = None
    if tenant.get("logo_path"):
        try:
            logo, _ = await get_object(tenant["logo_path"])
        except Exception:
            logo = None
    return build_inspection_pdf(doc, tenant, photo_bytes, logo_bytes=logo)

@api.get("/inspections/{iid}/pdf")
async def inspection_pdf(iid: str, user=Depends(get_current_user_flex)):
    tid = tenant_id_of(user)
    doc = await _get_inspection(tid, iid)
    tenant = await db.tenants.find_one({"id": tid}, {"_id": 0}) or {}
    pdf = await _inspection_pdf_bytes(doc, tenant)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="{doc["report_no"]}.pdf"'})

@api.post("/inspections/{iid}/share")
async def share_inspection(iid: str, user=Depends(get_current_user)):
    """Her çağrıda yeni token üretilir; eski paylaşım bağlantısı geçersiz olur."""
    tid = tenant_id_of(user)
    token = secrets.token_urlsafe(24)
    res = await db.inspections.update_one({"id": iid, "tenant_id": tid},
                                          {"$set": {"share_token": token, "shared_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Ekspertiz raporu bulunamadı")
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": user["email"], "action": "inspection.share",
        "entity_id": iid, "at": now_iso(),
    })
    return {"share_token": token, "pdf_url": f"/api/public/inspections/{token}/pdf"}

async def _public_inspection(token: str) -> Dict[str, Any]:
    if not token or len(token) < 20:
        raise HTTPException(404, "Bağlantı geçersiz")
    doc = await db.inspections.find_one({"share_token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Bağlantı geçersiz")
    return doc

@api.get("/public/inspections/{token}")
async def public_get_inspection(token: str):
    doc = await _public_inspection(token)
    tenant = await db.tenants.find_one({"id": doc["tenant_id"]},
                                       {"_id": 0, "name": 1, "phone": 1, "primary_color": 1, "secondary_color": 1}) or {}
    return {
        "report_no": doc.get("report_no"), "inspection_date": doc.get("inspection_date"),
        "owner_name": doc.get("owner_name"), "plate": doc.get("plate"), "make_model": doc.get("make_model"),
        "year": doc.get("year"), "km": doc.get("km"), "chassis_no": doc.get("chassis_no"),
        "technician_name": doc.get("technician_name"), "receiver_name": doc.get("receiver_name"),
        "notes": doc.get("notes"),
        "items": [{k: it.get(k) for k in ("key", "label", "group", "status", "note")} for it in doc.get("items", [])],
        "photo_count": len(doc.get("photos", [])),
        "tenant": tenant,
    }

@api.get("/public/inspections/{token}/pdf")
async def public_inspection_pdf(token: str):
    doc = await _public_inspection(token)
    tenant = await db.tenants.find_one({"id": doc["tenant_id"]}, {"_id": 0}) or {}
    pdf = await _inspection_pdf_bytes(doc, tenant)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="{doc["report_no"]}.pdf"'})

# ---------- Seeding ----------
async def seed_admin_and_indexes():
    await db.users.create_index("email", unique=True)
    await db.customers.create_index([("tenant_id", 1), ("phone", 1)])
    await db.motorcycles.create_index([("tenant_id", 1), ("plate", 1)])
    await db.motorcycles.create_index([("tenant_id", 1), ("vin", 1)])
    await db.service_orders.create_index([("tenant_id", 1), ("service_no", 1)])
    await db.service_orders.create_index([("tenant_id", 1), ("customer_id", 1)])
    await db.service_orders.create_index([("tenant_id", 1), ("motorcycle_id", 1)])

    # Süper Admin: yalnızca hesap yoksa oluşturulur. Mevcut hesabın şifresi açılışta ASLA sıfırlanmaz.
    # Şifre ortam değişkeninden alınır; varsayılan/sabit bir şifre kullanılmaz.
    email = os.environ.get("ADMIN_EMAIL", "admin@servis.com").lower()
    name = os.environ.get("ADMIN_NAME", "Admin")
    if await db.users.find_one({"email": email}):
        return
    pwd = os.environ.get("ADMIN_PASSWORD", "")
    if not pwd:
        logger.warning("ADMIN_PASSWORD tanımlı değil; Süper Admin hesabı oluşturulmadı.")
        return
    await db.users.insert_one({
        "id": uid(), "email": email, "name": name, "role": "super_admin",
        "tenant_id": None,
        "password_hash": hash_password(pwd), "created_at": now_iso(),
    })
    logger.info(f"Super Admin oluşturuldu: {email}")

async def seed_demo_data():
    # Ensure demo tenant exists
    demo_tenant = await db.tenants.find_one({"slug": "demo-servis"})
    if not demo_tenant:
        demo_tenant = {
            "id": uid(), "name": "moto CarizmA", "slug": "demo-servis",
            "subtitle": "YETKİLİ SERVİS & SHOWROOM",
            "address": "DENİZ MH 83035 Cadde. NO47/A",
            "city": "GAZİANTEP", "district": "ŞAHİNBEY",
            "phone": "0530 966 6767", "email": "info@motocarizma.com",
            "bank_name": "QNB FİNANSBANK", "bank_account_name": "Kazım ÖZTÜRK",
            "iban": "TR 57 0015 7000 0000 0119 5576 06",
            "primary_color": "#F97316", "secondary_color": "#0F172A",
            "theme": "orange",
            "custom_fault_zones": [], "custom_moto_images": {},
            "created_at": now_iso(),
        }
        await db.tenants.insert_one(demo_tenant)
        logger.info("Demo firma oluşturuldu (moto CarizmA)")
    demo_tid = demo_tenant["id"]

    # Demo firma yöneticisi: şifre ortam değişkeninden alınır; tanımlı değilse oluşturulmaz
    demo_pwd = os.environ.get("DEMO_ADMIN_PASSWORD", "")
    if demo_pwd and not await db.users.find_one({"email": "admin@motocarizma.com"}):
        await db.users.insert_one({
            "id": uid(), "email": "admin@motocarizma.com", "name": "Demo Admin",
            "role": "admin", "tenant_id": demo_tid,
            "password_hash": hash_password(demo_pwd),
            "created_at": now_iso(),
        })
        logger.info("Demo firma admin oluşturuldu: admin@motocarizma.com")

    if await db.customers.count_documents({"tenant_id": demo_tid}) > 0:
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
            "id": cid, "tenant_id": demo_tid, "first_name": fn, "last_name": ln, "phone": ph,
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
            "id": mid, "tenant_id": demo_tid, "customer_id": cid, "brand": brand, "model": model,
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
            "id": pid, "tenant_id": demo_tid, "code": code, "name": name, "brand": "Genel", "category": cat,
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
            "id": sid, "tenant_id": demo_tid, "code": code, "name": name, "description": name,
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
        so_no = f"SRV-{datetime.now(timezone.utc).year}-{(await db.counters.find_one_and_update({'_id': f'service_order_{demo_tid}_{datetime.now(timezone.utc).year}'}, {'$inc': {'seq': 1}}, upsert=True, return_document=True))['seq']:05d}"
        so_id = uid()
        grand = totals["grand_total"]
        paid = grand if status == "delivered" and random.random() > 0.3 else (grand * random.choice([0, 0.5, 0.7]) if random.random() > 0.4 else 0)
        so = {
            "id": so_id, "tenant_id": demo_tid, "service_no": so_no, "customer_id": cid, "motorcycle_id": mid,
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
            "id": uid(), "tenant_id": demo_tid, "customer_id": cid, "type": "charge",
            "amount": grand, "service_order_id": so_id, "service_no": so_no,
            "description": f"Servis: {so_no}", "created_at": created_at,
        })
        if paid > 0:
            payment_no = f"THL-{random.randint(10**11, 10**12-1)}"
            await db.payments.insert_one({
                "id": uid(), "tenant_id": demo_tid, "payment_no": payment_no, "customer_id": cid,
                "service_order_id": so_id, "amount": paid,
                "method": random.choice(["cash", "card", "transfer"]),
                "created_at": created_at, "created_by": os.environ.get("ADMIN_EMAIL", "system"),
            })
            await db.transactions.insert_one({
                "id": uid(), "tenant_id": demo_tid, "customer_id": cid, "type": "payment",
                "amount": -paid, "service_order_id": so_id, "service_no": so_no,
                "payment_no": payment_no, "description": "Tahsilat",
                "created_at": created_at,
            })
    logger.info("Demo veri yüklendi.")

async def backfill_cancel_reversals() -> int:
    """Bu sürümden önce iptal edilmiş servislerin borç kaydına ters (cancel) kaydı ekler.
    Idempotent: zaten ters kaydı olan servislere dokunmaz. Parça stoğu geriye dönük düzeltilmez."""
    cancelled = await db.service_orders.find(
        {"status": "cancelled", "grand_total": {"$gt": 0}},
        {"_id": 0, "id": 1, "tenant_id": 1, "customer_id": 1, "service_no": 1, "grand_total": 1},
    ).to_list(50000)
    added = 0
    for so in cancelled:
        if await db.transactions.find_one({"service_order_id": so["id"], "type": "cancel"}, {"_id": 0, "id": 1}):
            continue
        if not await db.transactions.find_one({"service_order_id": so["id"], "type": "charge"}, {"_id": 0, "id": 1}):
            continue
        await db.transactions.insert_one({
            "id": uid(), "tenant_id": so["tenant_id"], "customer_id": so["customer_id"], "type": "cancel",
            "amount": -float(so["grand_total"]), "service_order_id": so["id"], "service_no": so.get("service_no"),
            "description": f"İptal: {so.get('service_no')} (geriye dönük)", "created_at": now_iso(),
        })
        added += 1
    if added:
        logger.info(f"İptal ters kayıtları eklendi: {added}")
    return added

# ---------- Halka açık fiyat sayfası (Süper Admin yönetir) ----------
DEFAULT_PRICING_PACKAGES = [
    {"id": "pkg-temel", "name": "Temel Bakım", "price": 650, "unit": "başlangıç fiyatı", "highlight": False,
     "features": ["Motor yağı ve yağ filtresi değişimi", "Genel kontrol", "Lastik basınç kontrolü"]},
    {"id": "pkg-standart", "name": "Standart Bakım", "price": 1450, "unit": "başlangıç fiyatı", "highlight": True,
     "features": ["Yağ, hava ve yağ filtreleri", "Buji değişimi", "Zincir ayarı ve yağlama", "Fren kontrolü"]},
    {"id": "pkg-kapsamli", "name": "Kapsamlı Bakım", "price": 2800, "unit": "başlangıç fiyatı", "highlight": False,
     "features": ["Standart bakımın tümü", "Fren balatası ve sıvı kontrolü", "Triger ve soğutma kontrolü", "Bilgisayar arıza taraması"]},
    {"id": "pkg-ariza", "name": "Arıza Tespiti", "price": 250, "unit": "tespit ücreti", "highlight": False,
     "features": ["Diagnostik cihazla arıza okuma", "Elektrik devre kontrolü", "Yazılı arıza raporu"]},
]

class PricingItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=300)
    price: float = Field(ge=0, le=10_000_000)
    unit: str = Field(default="TL", max_length=30)

class PricingPackageIn(BaseModel):
    id: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=80)
    price: float = Field(ge=0, le=10_000_000)
    unit: str = Field(default="başlangıç fiyatı", max_length=40)
    highlight: bool = False
    features: List[str] = Field(default_factory=list, max_length=20)

class PricingIn(BaseModel):
    packages: List[PricingPackageIn] = Field(default_factory=list, max_length=12)
    items: List[PricingItemIn] = Field(default_factory=list, max_length=300)

async def _pricing_doc() -> Dict[str, Any]:
    doc = await db.site_content.find_one({"_id": "pricing"}, {"_id": 0})
    if doc:
        return doc
    return {
        "packages": DEFAULT_PRICING_PACKAGES,
        "items": [{"name": n, "description": d, "price": price, "unit": "TL"} for (_c, n, d, price) in DEFAULT_SERVICES],
        "updated_at": None,
    }


# ---------- Vitrin (ana sayfa) içeriği: süper admin tarafından yönetilir ----------
DEFAULT_LANDING: Dict[str, Any] = {
    "phone": "+44 7378 552959",
    "whatsapp": "447378552959",
    "hero": {
        "badge": "MOTOSİKLET SERVİSLERİ İÇİN",
        "title": "Servisinin dijital akıl defteri.",
        "description": "Müşteri, motosiklet, iş emri, parça, tahsilat, cari hesap ve otomatik hatırlatmalar tek ekranda. Kağıtsız, hızlı, denetlenebilir.",
    },
    "features_heading": {
        "eyebrow": "NELER YAPABİLİRSİNİZ?",
        "title": "Servisin tamamı, tek yerde.",
        "description": "Her modülü gerçek servis ihtiyacına göre — kağıt formlarınızı ve WhatsApp mesajlarınızı akıllı hale getirerek seçebilirsiniz.",
    },
    "features": [
        {"icon": "ClipboardList", "title": "İş Emri ve Kabul Formu", "text": "Kabul-Teslim PDF, imzalı, tek tıklamayla WhatsApp'tan oluşur."},
        {"icon": "Bike", "title": "Mürettebat Kartı", "text": "Marka, model, plaka, KM, arıza haritaları, servis geçmişi hepsi bir arada."},
        {"icon": "Users", "title": "Müşteri Cari", "text": "VIP/Borçlu/Sorunlu etiketleri, notlar, tahsilat ve bakiye takibi."},
        {"icon": "BellRing", "title": "Otomatik Hatırlatma", "text": "Her sabah saat 09:00'da vadesi dolan bakımları WhatsApp bağlantısıyla."},
        {"icon": "FileText", "title": "Fiyat Teklifi", "text": "Müşteri linki onaylansın, teklifler otomatik iş emrine dönüşsün."},
        {"icon": "BarChart3", "title": "Tahsilat ve Rapor", "text": "Ciro, alacak, borçlu servis raporları — anlık kontrol paneli."},
        {"icon": "Building2", "title": "Çok Firmalı SaaS", "text": "Süper Admin panelinden tema, PDF şablonu, içerik yönetimi."},
        {"icon": "ShieldCheck", "title": "Denetim ve Silme", "text": "Kim ne zaman değiştirilmez + 30 gün çöp kutusu geri yükleme."},
    ],
    "pricing_heading": {
        "eyebrow": "FİYATLANDIRMA",
        "title": "Servisiniz için uygun planı seçin.",
        "description": "14 gün ücretsiz deneme, iptal etmeniz kolay — kredi kartı gerektirmez.",
    },
    "plans": [
        {"id": "deneme", "name": "Deneme", "price_text": "Ücretsiz", "period": "14 gün", "highlight": False,
         "features": ["Tüm özellikler", "1 kullanıcı", "50 kayıt"]},
        {"id": "temel", "name": "Temel", "price_text": "₺ 2.499", "period": "/ ay", "highlight": False,
         "features": ["3 kullanıcı", "Sınırsız müşteri/motosiklet", "PDF + WhatsApp", "Kontrol Paneli"]},
        {"id": "profesyonel", "name": "Profesyonel", "price_text": "₺ 3.999", "period": "/ ay", "highlight": True,
         "features": ["10 kullanıcı", "Fiyat Teklifi + Onay bağlantısı", "Cronotou", "Öncelikli destek"]},
        {"id": "kurumsal", "name": "Kurumsal", "price_text": "Teklif", "period": "/ yıllık", "highlight": False,
         "features": ["Sınırsız kullanıcı", "Çoklu firma", "SLA + eğitim", "API'ler"]},
    ],
    "cta": {
        "title": "Servisinizi bugün dijitalleştirin.",
        "text": "14 gün ücretsiz deneme + kurulum ve eğitim sizin için biz yapıyoruz.",
    },
}
LANDING_ICONS = {"ClipboardList", "Bike", "Users", "BellRing", "FileText", "BarChart3", "Building2", "ShieldCheck", "Wrench"}

def _clip(v: Any, n: int = 300) -> str:
    return str(v or "").strip()[:n]

def _clean_landing(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Vitrin içeriğini şemaya göre temizler; bilinmeyen alanlar atılır, uzunluklar sınırlanır."""
    hero = raw.get("hero") or {}
    fh = raw.get("features_heading") or {}
    ph = raw.get("pricing_heading") or {}
    cta = raw.get("cta") or {}
    features = [
        {"icon": f.get("icon") if f.get("icon") in LANDING_ICONS else "Wrench",
         "title": _clip(f.get("title"), 80), "text": _clip(f.get("text"), 200)}
        for f in (raw.get("features") or [])[:12]
    ]
    plans = [
        {"id": _clip(pl.get("id") or uid(), 40), "name": _clip(pl.get("name"), 60),
         "price_text": _clip(pl.get("price_text"), 30), "period": _clip(pl.get("period"), 30),
         "highlight": bool(pl.get("highlight")),
         "features": [_clip(x, 120) for x in (pl.get("features") or [])[:12] if _clip(x)]}
        for pl in (raw.get("plans") or [])[:6]
    ]
    return {
        "phone": _clip(raw.get("phone"), 30),
        "whatsapp": re.sub(r"\D", "", str(raw.get("whatsapp") or ""))[:20],
        "hero": {"badge": _clip(hero.get("badge"), 60), "title": _clip(hero.get("title"), 120), "description": _clip(hero.get("description"), 300)},
        "features_heading": {"eyebrow": _clip(fh.get("eyebrow"), 60), "title": _clip(fh.get("title"), 120), "description": _clip(fh.get("description"), 300)},
        "features": features,
        "pricing_heading": {"eyebrow": _clip(ph.get("eyebrow"), 60), "title": _clip(ph.get("title"), 120), "description": _clip(ph.get("description"), 300)},
        "plans": plans,
        "cta": {"title": _clip(cta.get("title"), 120), "text": _clip(cta.get("text"), 300)},
    }

async def _landing_doc() -> Dict[str, Any]:
    doc = await db.site_content.find_one({"_id": "landing"}, {"_id": 0})
    return doc or {**DEFAULT_LANDING, "updated_at": None}

@api.get("/public/landing")
async def public_landing():
    doc = await _landing_doc()
    return {k: v for k, v in doc.items() if k not in {"updated_by"}}

@api.get("/admin/landing")
async def admin_get_landing(user=Depends(require_super_admin)):
    return await _landing_doc()

@api.put("/admin/landing")
async def admin_put_landing(request: Request, user=Depends(require_super_admin)):
    raw = await request.json()
    if not isinstance(raw, dict):
        raise HTTPException(400, "Geçersiz içerik")
    doc = _clean_landing(raw)
    if not doc["plans"] or not doc["hero"]["title"]:
        raise HTTPException(400, "Başlık ve en az bir plan gerekli")
    doc.update({"updated_at": now_iso(), "updated_by": user["email"]})
    await db.site_content.update_one({"_id": "landing"}, {"$set": doc}, upsert=True)
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": None, "user": user["email"], "action": "landing.update",
        "entity_id": "landing", "at": now_iso(),
    })
    return {"ok": True}

@api.get("/public/pricing")
async def public_pricing():
    doc = await _pricing_doc()
    return {"packages": doc.get("packages", []), "items": doc.get("items", []), "updated_at": doc.get("updated_at")}

@api.get("/admin/pricing")
async def admin_get_pricing(user=Depends(require_super_admin)):
    return await _pricing_doc()

@api.put("/admin/pricing")
async def admin_put_pricing(inp: PricingIn, user=Depends(require_super_admin)):
    ids = [p.id for p in inp.packages]
    if len(set(ids)) != len(ids):
        raise HTTPException(400, "Paket kimlikleri benzersiz olmalıdır")
    doc = {
        "packages": [p.model_dump() for p in inp.packages],
        "items": [i.model_dump() for i in inp.items],
        "updated_at": now_iso(), "updated_by": user["email"],
    }
    await db.site_content.update_one({"_id": "pricing"}, {"$set": doc}, upsert=True)
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": None, "user": user["email"], "action": "pricing.update",
        "entity_id": "pricing", "at": now_iso(),
    })
    return {"ok": True, "updated_at": doc["updated_at"]}

# ---------- Süper Admin genel durum raporu ----------
@api.get("/admin/overview")
async def admin_overview(user=Depends(require_super_admin)):
    tenants = await db.tenants.find({}, {"_id": 0, "id": 1, "name": 1, "is_active": 1, "plan": 1,
                                         "subscription_ends_at": 1, "trial_ends_at": 1}).to_list(1000)
    orders = await db.service_orders.find({"status": {"$ne": "cancelled"}},
                                          {"_id": 0, "tenant_id": 1, "customer_id": 1, "grand_total": 1,
                                           "paid_total": 1, "created_at": 1}).to_list(50000)
    payments = await db.payments.find({}, {"_id": 0, "tenant_id": 1, "amount": 1, "created_at": 1}).to_list(50000)
    customers = await db.customers.find({}, {"_id": 0, "id": 1, "tenant_id": 1, "first_name": 1, "last_name": 1,
                                             "phone": 1, "created_at": 1}).to_list(50000)
    moto_counts: Dict[str, int] = {}
    async for m in db.motorcycles.find({}, {"_id": 0, "tenant_id": 1}):
        moto_counts[m.get("tenant_id")] = moto_counts.get(m.get("tenant_id"), 0) + 1

    def f(v) -> float:
        return float(v or 0)

    by_tenant: Dict[str, Dict[str, float]] = {}
    for o in orders:
        t = by_tenant.setdefault(o.get("tenant_id"), {"revenue": 0.0, "receivables": 0.0, "orders": 0, "collected": 0.0})
        t["revenue"] += f(o.get("grand_total"))
        t["receivables"] += max(0.0, f(o.get("grand_total")) - f(o.get("paid_total")))
        t["orders"] += 1
    for p in payments:
        t = by_tenant.setdefault(p.get("tenant_id"), {"revenue": 0.0, "receivables": 0.0, "orders": 0, "collected": 0.0})
        t["collected"] += f(p.get("amount"))
    cust_count: Dict[str, int] = {}
    for c in customers:
        cust_count[c.get("tenant_id")] = cust_count.get(c.get("tenant_id"), 0) + 1

    tenant_rows = []
    for t in tenants:
        agg = by_tenant.get(t["id"], {"revenue": 0.0, "receivables": 0.0, "orders": 0, "collected": 0.0})
        tenant_rows.append({
            "id": t["id"], "name": t.get("name"), "is_active": t.get("is_active", True), "plan": t.get("plan"),
            "ends_at": t.get("subscription_ends_at") or t.get("trial_ends_at"),
            "customers": cust_count.get(t["id"], 0), "motorcycles": moto_counts.get(t["id"], 0),
            "orders": agg["orders"], "revenue": round(agg["revenue"], 2),
            "collected": round(agg["collected"], 2), "receivables": round(agg["receivables"], 2),
        })
    tenant_rows.sort(key=lambda r: -r["revenue"])

    # Müşteri bazlı açık bakiye (tüm firmalar)
    bal: Dict[str, float] = {}
    for o in orders:
        if o.get("customer_id"):
            bal[o["customer_id"]] = bal.get(o["customer_id"], 0.0) + max(0.0, f(o.get("grand_total")) - f(o.get("paid_total")))
    tenant_name = {t["id"]: t.get("name") for t in tenants}
    customer_rows = sorted(
        [{"id": c["id"], "name": f"{c.get('first_name', '')} {c.get('last_name', '')}".strip(),
          "phone": c.get("phone", ""), "tenant": tenant_name.get(c.get("tenant_id"), "-"),
          "balance": round(bal.get(c["id"], 0.0), 2), "created_at": c.get("created_at")} for c in customers],
        key=lambda r: (-r["balance"], r["name"]))[:300]

    monthly: Dict[str, float] = {}
    for o in orders:
        k = (o.get("created_at") or "")[:7]
        if k:
            monthly[k] = monthly.get(k, 0.0) + f(o.get("grand_total"))
    monthly_series = [{"month": k, "revenue": round(v, 2)} for k, v in sorted(monthly.items())[-12:]]

    totals = {
        "tenants": len(tenants),
        "active_tenants": sum(1 for t in tenants if t.get("is_active", True)),
        "customers": len(customers),
        "motorcycles": sum(moto_counts.values()),
        "orders": len(orders),
        "revenue": round(sum(r["revenue"] for r in tenant_rows), 2),
        "collected": round(sum(r["collected"] for r in tenant_rows), 2),
        "receivables": round(sum(r["receivables"] for r in tenant_rows), 2),
    }
    system = {
        "database": "MongoDB Atlas",
        "db_name": os.environ.get("DB_NAME", ""),
        "server_time": now_iso(),
        "users": await db.users.count_documents({}),
        "files": await db["app_files.files"].count_documents({}),
        "audit_entries": await db.audit_logs.count_documents({}),
    }
    return {"totals": totals, "tenants": tenant_rows, "customers": customer_rows,
            "monthly": monthly_series, "system": system}

async def seed_default_catalog(tid: str) -> None:
    """Firma için varsayılan parça ve işçilik kataloğunu bir kez yükler (katalog boşsa)."""
    tenant = await db.tenants.find_one({"id": tid}, {"_id": 0, "catalog_seeded": 1})
    if tenant is None or tenant.get("catalog_seeded"):
        return
    now = now_iso()
    if await db.products.count_documents({"tenant_id": tid}) == 0:
        docs = [{
            "id": uid(), "tenant_id": tid, "code": c, "name": n, "brand": b, "category": cat,
            "cost_price": cost, "sale_price": sale, "stock": 0, "min_stock": 2, "unit": unit,
            "vat": DEFAULT_VAT, "price_mode": DEFAULT_PRICE_MODE, "created_at": now,
        } for (c, n, b, cat, cost, sale, unit) in DEFAULT_PRODUCTS]
        if docs:
            await db.products.insert_many(docs)
    if await db.service_catalog.count_documents({"tenant_id": tid}) == 0:
        docs = [{
            "id": uid(), "tenant_id": tid, "code": c, "name": n, "description": d,
            "price": price, "vat": DEFAULT_VAT, "price_mode": DEFAULT_PRICE_MODE, "created_at": now,
        } for (c, n, d, price) in DEFAULT_SERVICES]
        if docs:
            await db.service_catalog.insert_many(docs)
    await db.tenants.update_one({"id": tid}, {"$set": {"catalog_seeded": True}})

async def seed_catalogs_for_existing_tenants() -> None:
    async for t in db.tenants.find({"catalog_seeded": {"$ne": True}}, {"_id": 0, "id": 1}):
        await seed_default_catalog(t["id"])

@app.on_event("startup")
async def on_startup():
    await seed_admin_and_indexes()
    await backfill_cancel_reversals()
    await seed_catalogs_for_existing_tenants()
    # Demo verisi (sahte müşteri/servis kayıtları) yalnızca açıkça istenirse yüklenir; üretim veritabanını kirletmez
    if os.environ.get("SEED_DEMO_DATA", "").lower() in {"1", "true", "yes"}:
        await seed_demo_data()
    try:
        init_storage(db)
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning(f"Storage init failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Include routes
app.include_router(api)

# CORS: when credentials are enabled, wildcard origins are unsafe/invalid.
# Use explicit env-provided origins + FRONTEND_URL + Emergent hostname regex.
_cors_origins = os.environ.get("CORS_ORIGINS", "")
_origins_list = [o.strip() for o in _cors_origins.split(",") if o.strip() and o.strip() != "*"]
_frontend_url = os.environ.get("FRONTEND_URL")
if _frontend_url and _frontend_url not in _origins_list:
    _origins_list.append(_frontend_url)
# Always allow localhost dev
for _dev in ("http://localhost:3000", "http://127.0.0.1:3000"):
    if _dev not in _origins_list:
        _origins_list.append(_dev)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_origins_list,
    allow_origin_regex=r"https://.*\.emergent(agent|)\.(com|host)$",
    allow_methods=["*"],
    allow_headers=["*"],
)
