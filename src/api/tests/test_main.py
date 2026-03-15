import json
import os
import sys
from unittest.mock import MagicMock, patch

# Provide required env vars before importing the app
os.environ.setdefault("MONGO_ROOT_USERNAME", "root")
os.environ.setdefault("MONGO_ROOT_PASSWORD", "testpassword")

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


def test_portscan_rejects_invalid_port_range():
    response = client.post("/portscan/localhost?port_start=90&port_end=80")
    assert response.status_code == 422

def test_portscan_rejects_out_of_range_ports():
    response = client.post("/portscan/localhost?port_start=0&port_end=100")
    assert response.status_code == 422


# --- GET /port/scanned ---


def test_get_scanned_returns_empty_list_when_no_results():
    with patch("src.api.app.main.db") as mock_db:
        mock_db.__getitem__.return_value.find.return_value = []
        response = client.get("/port/scanned")

    assert response.status_code == 200
    assert response.json() == {"results": []}


def test_get_scanned_returns_parsed_results():
    stored_result = {
        "id": "abc-123",
        "host": "localhost",
        "range": [80, 82],
        "open_ports": [{"port": 80, "service": "HTTP"}],
    }
    mock_doc = {"result": json.dumps(stored_result)}

    with patch("src.api.app.main.db") as mock_db:
        mock_db.__getitem__.return_value.find.return_value = [mock_doc]
        response = client.get("/port/scanned")

    assert response.status_code == 200
    assert response.json()["results"] == [stored_result]


def test_get_scanned_skips_malformed_db_entries():
    mock_doc_bad = {"result": "not valid json {{{}"}
    mock_doc_good = {"result": json.dumps({"id": "ok", "host": "h", "range": [80, 80], "open_ports": []})}

    with patch("src.api.app.main.db") as mock_db:
        mock_db.__getitem__.return_value.find.return_value = [mock_doc_bad, mock_doc_good]
        response = client.get("/port/scanned")

    assert response.status_code == 200
    assert len(response.json()["results"]) == 1


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


# --- GET /dns/{host} ---


def test_dns_lookup_returns_records():
    mock_answer = MagicMock()
    mock_answer.__iter__ = MagicMock(return_value=iter([MagicMock(__str__=lambda self: "1.2.3.4")]))

    with patch("src.api.app.main.dns.resolver.resolve", return_value=mock_answer):
        response = client.get("/dns/example.com?record_type=A")

    assert response.status_code == 200
    data = response.json()
    assert data["host"] == "example.com"
    assert data["record_type"] == "A"
    assert isinstance(data["records"], list)


def test_dns_lookup_returns_404_for_nxdomain():
    import dns.resolver as _dns_resolver
    with patch("src.api.app.main.dns.resolver.resolve", side_effect=_dns_resolver.NXDOMAIN):
        response = client.get("/dns/doesnotexist.invalid?record_type=A")
    assert response.status_code == 404


def test_dns_lookup_returns_empty_for_no_answer():
    import dns.resolver as _dns_resolver
    with patch("src.api.app.main.dns.resolver.resolve", side_effect=_dns_resolver.NoAnswer):
        response = client.get("/dns/example.com?record_type=MX")
    assert response.status_code == 200
    assert response.json()["records"] == []


def test_dns_lookup_rejects_invalid_record_type():
    response = client.get("/dns/example.com?record_type=BOGUS")
    assert response.status_code == 422


# --- GET /ping/{host} ---


def test_ping_returns_stats():
    mock_proc = MagicMock()
    mock_proc.stdout = (
        "PING localhost (127.0.0.1): 56 data bytes\n"
        "4 packets transmitted, 4 packets received, 0.0% packet loss\n"
        "round-trip min/avg/max/stddev = 0.123/0.456/0.789/0.111 ms\n"
    )
    with patch("src.api.app.main.subprocess.run", return_value=mock_proc):
        response = client.get("/ping/localhost")

    assert response.status_code == 200
    data = response.json()
    assert data["packets_sent"] == 4
    assert data["packets_received"] == 4
    assert data["packet_loss_pct"] == 0
    assert data["rtt_avg"] == 0.456


def test_ping_rejects_count_out_of_range():
    response = client.get("/ping/localhost?count=0")
    assert response.status_code == 422
    response = client.get("/ping/localhost?count=11")
    assert response.status_code == 422


def test_ping_returns_408_on_timeout():
    import subprocess
    with patch("src.api.app.main.subprocess.run", side_effect=subprocess.TimeoutExpired("ping", 30)):
        response = client.get("/ping/localhost")
    assert response.status_code == 408


# --- GET /traceroute/{host} ---


def test_traceroute_returns_hops():
    mock_proc = MagicMock()
    mock_proc.stdout = (
        "traceroute to 8.8.8.8 (8.8.8.8), 20 hops max\n"
        " 1  gateway (192.168.1.1)  1.234 ms  1.123 ms  0.987 ms\n"
        " 2  * * *\n"
        " 3  8.8.8.8 (8.8.8.8)  12.345 ms  11.111 ms  10.999 ms\n"
    )
    with patch("src.api.app.main.subprocess.run", return_value=mock_proc):
        response = client.get("/traceroute/8.8.8.8")

    assert response.status_code == 200
    hops = response.json()["hops"]
    assert len(hops) == 3
    assert hops[0]["hop"] == 1
    assert hops[0]["ip"] == "192.168.1.1"
    assert hops[1]["host"] is None  # * hop
    assert hops[2]["hop"] == 3


def test_traceroute_returns_408_on_timeout():
    import subprocess
    with patch("src.api.app.main.subprocess.run", side_effect=subprocess.TimeoutExpired("traceroute", 90)):
        response = client.get("/traceroute/8.8.8.8")
    assert response.status_code == 408


# --- GET /ssl/{host} ---


def test_ssl_inspect_returns_cert_info():
    mock_cert = {
        "subject": [[("commonName", "example.com")]],
        "issuer": [[("organizationName", "Let's Encrypt")]],
        "notBefore": "Jan  1 00:00:00 2025 GMT",
        "notAfter": "Apr  1 00:00:00 2025 GMT",
        "subjectAltName": [("DNS", "example.com"), ("DNS", "www.example.com")],
    }
    mock_cipher = ("TLS_AES_256_GCM_SHA384", "TLSv1.3", 256)
    mock_ssock = MagicMock()
    mock_ssock.getpeercert.return_value = mock_cert
    mock_ssock.cipher.return_value = mock_cipher
    mock_ssock.__enter__ = MagicMock(return_value=mock_ssock)
    mock_ssock.__exit__ = MagicMock(return_value=False)

    mock_sock = MagicMock()
    mock_sock.__enter__ = MagicMock(return_value=mock_sock)
    mock_sock.__exit__ = MagicMock(return_value=False)

    mock_ctx = MagicMock()
    mock_ctx.wrap_socket.return_value = mock_ssock

    with patch("src.api.app.main.ssl.create_default_context", return_value=mock_ctx):
        with patch("src.api.app.main.socket.create_connection", return_value=mock_sock):
            response = client.get("/ssl/example.com")

    assert response.status_code == 200
    data = response.json()
    assert data["common_name"] == "example.com"
    assert data["issuer"] == "Let's Encrypt"
    assert "example.com" in data["sans"]
    assert data["protocol"] == "TLSv1.3"
    assert data["verified"] is True


def test_ssl_inspect_returns_cert_for_self_signed():
    mock_cert = {
        "subject": [[("commonName", "self-signed.local")]],
        "issuer": [[("organizationName", "Self")]],
        "notBefore": "Jan  1 00:00:00 2025 GMT",
        "notAfter": "Jan  1 00:00:00 2026 GMT",
        "subjectAltName": [],
    }
    mock_cipher = ("TLS_AES_256_GCM_SHA384", "TLSv1.3", 256)
    mock_ssock = MagicMock()
    mock_ssock.getpeercert.return_value = mock_cert
    mock_ssock.cipher.return_value = mock_cipher
    mock_ssock.__enter__ = MagicMock(return_value=mock_ssock)
    mock_ssock.__exit__ = MagicMock(return_value=False)

    mock_sock = MagicMock()
    mock_sock.__enter__ = MagicMock(return_value=mock_sock)
    mock_sock.__exit__ = MagicMock(return_value=False)

    mock_ctx = MagicMock()
    mock_ctx.wrap_socket.return_value = mock_ssock

    # First call raises verification error, second (unverified) succeeds
    with patch("src.api.app.main.ssl.create_default_context", side_effect=ssl.SSLCertVerificationError):
        with patch("src.api.app.main.ssl.SSLContext", return_value=mock_ctx):
            with patch("src.api.app.main.socket.create_connection", return_value=mock_sock):
                response = client.get("/ssl/self-signed.local")

    assert response.status_code == 200
    data = response.json()
    assert data["common_name"] == "self-signed.local"
    assert data["verified"] is False


def test_ssl_inspect_returns_408_on_timeout():
    with patch("src.api.app.main.socket.create_connection", side_effect=TimeoutError):
        response = client.get("/ssl/example.com")
    assert response.status_code == 408


def test_ssl_inspect_returns_400_on_connection_error():
    with patch("src.api.app.main.socket.create_connection", side_effect=OSError("refused")):
        response = client.get("/ssl/example.com")
    assert response.status_code == 400


# --- Host validation ---


def test_invalid_host_rejected_in_ping():
    response = client.get("/ping/-invalid-flag")
    assert response.status_code == 422


def test_invalid_host_rejected_in_traceroute():
    response = client.get("/traceroute/not_a_valid_host!")
    assert response.status_code == 422


def test_invalid_host_rejected_in_dns():
    response = client.get("/dns/not_valid!")
    assert response.status_code == 422


def test_valid_ip_accepted_in_ping():
    mock_proc = MagicMock()
    mock_proc.stdout = "4 packets transmitted, 4 packets received\nmin/avg/max = 1.0/2.0/3.0 ms\n"
    with patch("src.api.app.main.subprocess.run", return_value=mock_proc):
        response = client.get("/ping/8.8.8.8")
    assert response.status_code == 200


def test_valid_hostname_accepted_in_dns():
    mock_answer = MagicMock()
    mock_answer.__iter__ = MagicMock(return_value=iter([MagicMock(__str__=lambda self: "1.2.3.4")]))
    with patch("src.api.app.main.dns.resolver.resolve", return_value=mock_answer):
        response = client.get("/dns/example.com")
    assert response.status_code == 200


# --- API key auth ---


def test_api_key_not_required_when_env_not_set():
    with patch.dict("src.api.app.main.__dict__", {"_API_KEY": None}):
        response = client.get("/myip")
    assert response.status_code == 200


def test_api_key_enforced_when_env_set():
    with patch("src.api.app.main._API_KEY", "secret-key"):
        response = client.get("/myip")
        assert response.status_code == 403

        response = client.get("/myip", headers={"X-API-Key": "wrong-key"})
        assert response.status_code == 403

        response = client.get("/myip", headers={"X-API-Key": "secret-key"})
        assert response.status_code == 200
