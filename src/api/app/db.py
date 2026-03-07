import os
from urllib.parse import quote_plus
from pymongo import MongoClient

# MongoDB configuration using environment variables
MONGO_USERNAME = os.getenv("MONGO_ROOT_USERNAME", "root")
MONGO_PASSWORD = os.getenv("MONGO_ROOT_PASSWORD", "example")
MONGO_HOST = os.getenv("MONGO_HOST", "mongodb")  # Use docker service name
MONGO_PORT = int(os.getenv("MONGO_PORT", "27017"))
MONGO_DB = "celery"
MONGO_DB_COLLECTION = "celery_taskmeta"

# Create a MongoDB client with authentication
client = MongoClient(
    f"mongodb://{quote_plus(MONGO_USERNAME)}:{quote_plus(MONGO_PASSWORD)}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}?authSource=admin"
)
db = client[MONGO_DB]
