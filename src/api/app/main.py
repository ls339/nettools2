from fastapi import FastAPI, HTTPException, Request


from src.worker.task.tasks import portscan
from .db import db, MONGO_DB_COLLECTION
import json


API_VERSION = "v1"
app = FastAPI(
    title="Purenix Net Tools", description="Various networking tools.", version="0.0.1"
)


@app.get(
    "/myip",
    responses={
        200: {
            "description": "Client host",
            "content": {"application/json": {"example": {"client_host": "127.0.0.1"}}},
        }
    },
)
def get_myip(request: Request):
    # Try multiple headers that proxies use to pass real client IP
    for header in ["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "x-client-ip"]:
        client_host = request.headers.get(header)
        if client_host:
            # X-Forwarded-For can contain multiple IPs, take the first one
            client_host = client_host.split(",")[0].strip()
            return {"client_host": client_host}

    # Fallback to direct client host if no proxy headers found
    return {"client_host": request.client.host}


@app.post(
    "/portscan/{host}",
    responses={202: {"message": "ok", "id": "somestring"}},
)
def portscanner(host: str, port_start: int, port_end: int):
    result = portscan.delay(host, port_start, port_end)
    return {
        "message": "ok",
        "id": result.id,
    }


@app.get(
    "/port/scanned/{id}",
    responses={200: {"id": 123, "open_ports": [1, 2, 3]}},
)
async def portscanned(id: int):
    collection = list(db[MONGO_DB_COLLECTION].find())
    results = []
    for result in collection:
        results.append(json.loads(result["result"]))
    return {"id": id, "results": results}


@app.delete("/port/scanned/{task_id}", responses={200: {"message": "deleted"}})
async def delete_portscanned(task_id: str):
    result = db[MONGO_DB_COLLECTION].delete_one({"_id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scan result not found")
    return {"message": "deleted"}
