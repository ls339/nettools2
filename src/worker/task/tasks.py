import datetime
import os
from urllib.parse import quote_plus

from .portscanner import portscanner
from celery import Celery

_mongo_user = quote_plus(os.environ["MONGO_ROOT_USERNAME"])
_mongo_password = quote_plus(os.environ["MONGO_ROOT_PASSWORD"])
_rabbit_user = quote_plus(os.getenv("RABBITMQ_USER", "guest"))
_rabbit_password = quote_plus(os.getenv("RABBITMQ_PASSWORD", "guest"))
result_backend = f"mongodb://{_mongo_user}:{_mongo_password}@mongodb:27017/?authSource=admin"
app = Celery("tasks", backend=result_backend, broker=f"pyamqp://{_rabbit_user}:{_rabbit_password}@broker//")


@app.task(bind=True)
def portscan(self, host, port_start, port_end):
    results = portscanner(host, port_start, port_end)
    data = {
        "id": self.request.id,
        "time_stamp": datetime.datetime.now().timestamp(),
        **results,
    }
    return data
