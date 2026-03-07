import datetime
import os
from urllib.parse import quote_plus

from .portscanner import portscanner
from celery import Celery

_user = quote_plus(os.getenv("MONGO_ROOT_USERNAME", "root"))
_password = quote_plus(os.getenv("MONGO_ROOT_PASSWORD", "example"))
result_backend = f"mongodb://{_user}:{_password}@mongodb:27017/?authSource=admin"
app = Celery("tasks", backend=result_backend, broker="pyamqp://guest:guest@broker//")


@app.task(bind=True)
def portscan(self, host, port_start, port_end):
    results = portscanner(host, port_start, port_end)
    data = {
        "id": self.request.id,
        "time_stamp": datetime.datetime.now().timestamp(),
        **results,
    }
    return data
