import json
import sys
from unittest.mock import MagicMock, patch

# Mock the worker module before importing the app to avoid Celery broker connection
sys.modules.setdefault("src.worker", MagicMock())
sys.modules.setdefault("src.worker.task", MagicMock())
sys.modules.setdefault("src.worker.task.tasks", MagicMock())

from fastapi.testclient import TestClient  # noqa: E402

from src.api.app.main import app  # noqa: E402

client = TestClient(app)


# --- GET /myip ---


def test_myip_returns_direct_client_host():
    response = client.get("/myip")
    assert response.status_code == 200
    assert "client_host" in response.json()


def test_myip_uses_x_forwarded_for_header():
    response = client.get("/myip", headers={"x-forwarded-for": "1.2.3.4"})
    assert response.status_code == 200
    assert response.json()["client_host"] == "1.2.3.4"


def test_myip_takes_first_ip_from_x_forwarded_for():
    response = client.get("/myip", headers={"x-forwarded-for": "1.2.3.4, 5.6.7.8"})
    assert response.status_code == 200
    assert response.json()["client_host"] == "1.2.3.4"


def test_myip_uses_x_real_ip_header():
    response = client.get("/myip", headers={"x-real-ip": "9.9.9.9"})
    assert response.status_code == 200
    assert response.json()["client_host"] == "9.9.9.9"


# --- POST /portscan/{host} ---


def test_portscan_queues_task_and_returns_id():
    mock_result = MagicMock()
    mock_result.id = "test-task-id-123"

    with patch("src.api.app.main.portscan") as mock_portscan:
        mock_portscan.delay.return_value = mock_result
        response = client.post("/portscan/localhost?port_start=80&port_end=90")

    assert response.status_code == 200
    assert response.json() == {"message": "ok", "id": "test-task-id-123"}
    mock_portscan.delay.assert_called_once_with("localhost", 80, 90)


# --- GET /port/scanned/{id} ---


def test_get_scanned_returns_empty_list_when_no_results():
    with patch("src.api.app.main.db") as mock_db:
        mock_db.__getitem__.return_value.find.return_value = []
        response = client.get("/port/scanned/1")

    assert response.status_code == 200
    assert response.json() == {"id": 1, "results": []}


def test_get_scanned_returns_parsed_results():
    stored_result = {
        "id": "abc-123",
        "host": "localhost",
        "range": [80, 82],
        "open_ports": [80],
    }
    mock_doc = {"result": json.dumps(stored_result)}

    with patch("src.api.app.main.db") as mock_db:
        mock_db.__getitem__.return_value.find.return_value = [mock_doc]
        response = client.get("/port/scanned/1")

    assert response.status_code == 200
    assert response.json()["results"] == [stored_result]


# --- DELETE /port/scanned/{task_id} ---


def test_delete_scanned_returns_200_when_found():
    mock_delete_result = MagicMock()
    mock_delete_result.deleted_count = 1

    with patch("src.api.app.main.db") as mock_db:
        mock_db.__getitem__.return_value.delete_one.return_value = mock_delete_result
        response = client.delete("/port/scanned/abc-123")

    assert response.status_code == 200
    assert response.json() == {"message": "deleted"}


def test_delete_scanned_returns_404_when_not_found():
    mock_delete_result = MagicMock()
    mock_delete_result.deleted_count = 0

    with patch("src.api.app.main.db") as mock_db:
        mock_db.__getitem__.return_value.delete_one.return_value = mock_delete_result
        response = client.delete("/port/scanned/nonexistent-id")

    assert response.status_code == 404
