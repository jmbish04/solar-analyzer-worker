import os
import requests
import sys
import json
from datetime import date, timedelta

# Replace with your worker's URL. You can set this as an environment variable.
# It's recommended to use a secret for the admin password.
WORKER_URL = os.environ.get("WORKER_URL", "https://solar-analyzer-worker.hacolby.workers.dev")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "6502241638") # Replace with a real password or load from a secret manager.

HEADERS = {
    "Content-Type": "application/json",
    "X-Admin-Password": ADMIN_PASSWORD
}

def test_admin_login():
    """Tests if the admin password is required and working."""
    print("Testing admin login...")
    # Test without password
    response = requests.post(f"{WORKER_URL}/config", json={})
    assert response.status_code == 401, f"Expected 401 without password, got {response.status_code}"
    print("✅ Admin login required as expected.")

    # Test with password
    response = requests.get(f"{WORKER_URL}/config", headers=HEADERS)
    # This will fail if the config is not set, but 200 or 404 is ok for login test
    assert response.status_code in [200, 404], f"Expected 200 or 404 with password, got {response.status_code}"
    print("✅ Admin login successful.")


def test_config_endpoints():
    """Tests the GET and POST /config endpoints."""
    print("\nTesting /config endpoints...")
    
    # Define a sample config
    sample_config = {
        "panelCount": 20,
        "panelOutputWatts": 400,
        "systemCapacityKw": 8.0,
        "panelTilt": 20,
        "panelAzimuth": 180,
        "latitude": 37.7749,
        "longitude": -122.4194
    }
    
    # Post new config to ensure one exists
    response = requests.post(f"{WORKER_URL}/config", json=sample_config, headers=HEADERS)
    assert response.status_code == 200, f"POST /config failed: {response.text}"
    print("✅ POST /config successful.")
    
    # Get current config
    response = requests.get(f"{WORKER_URL}/config", headers=HEADERS)
    assert response.status_code == 200, f"GET /config after update failed: {response.text}"
    retrieved_config = response.json()
    assert retrieved_config['panelCount'] == sample_config['panelCount'], "Config data does not match."
    print("✅ GET /config verified.")


def test_data_status_endpoint():
    """Tests the /data-status/{dataType} endpoint."""
    print("\nTesting /data-status endpoints...")
    for data_type in ["sunrise-sunset", "pvwatts"]:
        response = requests.get(f"{WORKER_URL}/data-status/{data_type}", headers=HEADERS)
        assert response.status_code == 200, f"GET /data-status/{data_type} failed: {response.text}"
        print(f"✅ GET /data-status/{data_type} successful: {response.json()}")


def test_backfill_endpoints():
    """Tests the backfill endpoints."""
    print("\nTesting backfill endpoints...")
    end_date = date.today()
    start_date = end_date - timedelta(days=5)

    # Get the config to use lat/lon
    config_response = requests.get(f"{WORKER_URL}/config", headers=HEADERS)
    assert config_response.status_code == 200, "Failed to get config for backfill test"
    config = config_response.json()
    lat = config['latitude']
    lon = config['longitude']

    # Test PVWatts backfill
    pvwatts_url = f"{WORKER_URL}/backfill/pvwatts?startDate={start_date}&endDate={end_date}"
    response = requests.post(pvwatts_url, headers=HEADERS)
    assert response.status_code == 200, f"POST /backfill/pvwatts failed: {response.text}"
    print(f"✅ POST /backfill/pvwatts successful: {response.json()}")

    # Test sunrise/sunset backfill
    sunrise_url = f"{WORKER_URL}/backfill/sunrise_sunset?startDate={start_date}&endDate={end_date}&lat={lat}&lon={lon}"
    response = requests.post(sunrise_url, headers=HEADERS)
    assert response.status_code == 200, f"POST /backfill/sunrise_sunset failed: {response.text}"
    print(f"✅ POST /backfill/sunrise_sunset successful: {response.json()}")




def test_refresh_other_data():
    """Tests the placeholder /refresh/other-data endpoint."""
    print("\nTesting /refresh/other-data...")
    response = requests.post(f"{WORKER_URL}/refresh/other-data", headers=HEADERS)
    assert response.status_code == 501, f"Expected 501 for not implemented, got {response.status_code}"
    print("✅ GET /refresh/other-data returned 501 as expected.")


if __name__ == "__main__":
    # Run tests in a logical order
    test_admin_login()
    test_config_endpoints()
    test_data_status_endpoint()
    test_backfill_endpoints()
    test_refresh_other_data()
    print("\n🎉 All new endpoint tests passed successfully!")