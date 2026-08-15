"""Remove only TEST_-prefixed QA data created by backend and UI regression runs."""
from dotenv import dotenv_values
from pymongo import MongoClient

env = dotenv_values("/app/backend/.env")
client = MongoClient(env["MONGO_URL"])
db = client[env["DB_NAME"]]

customer_ids = [doc["id"] for doc in db.customers.find({"first_name": {"$regex": "^TEST"}}, {"id": 1})]
motorcycle_ids = [doc["id"] for doc in db.motorcycles.find({"$or": [{"customer_id": {"$in": customer_ids}}, {"brand": {"$regex": "^TEST"}}]}, {"id": 1})]
order_ids = [doc["id"] for doc in db.service_orders.find({"$or": [{"customer_id": {"$in": customer_ids}}, {"motorcycle_id": {"$in": motorcycle_ids}}, {"complaint": {"$regex": "^TEST"}}]}, {"id": 1})]

results = {
    "audit_logs": db.audit_logs.delete_many({"entity_id": {"$in": order_ids}}).deleted_count,
    "transactions": db.transactions.delete_many({"$or": [{"customer_id": {"$in": customer_ids}}, {"service_order_id": {"$in": order_ids}}]}).deleted_count,
    "payments": db.payments.delete_many({"$or": [{"customer_id": {"$in": customer_ids}}, {"service_order_id": {"$in": order_ids}}, {"note": {"$regex": "^TEST"}}]}).deleted_count,
    "service_orders": db.service_orders.delete_many({"id": {"$in": order_ids}}).deleted_count,
    "motorcycles": db.motorcycles.delete_many({"id": {"$in": motorcycle_ids}}).deleted_count,
    "customers": db.customers.delete_many({"id": {"$in": customer_ids}}).deleted_count,
    "products": db.products.delete_many({"code": {"$regex": "^TEST"}}).deleted_count,
    "service_catalog": db.service_catalog.delete_many({"code": {"$regex": "^TEST"}}).deleted_count,
    "users": db.users.delete_many({"email": {"$regex": "^test\\."}}).deleted_count,
}
client.close()
print(results)
