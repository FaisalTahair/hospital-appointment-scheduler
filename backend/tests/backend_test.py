"""Backend API tests for Meridian Hospital Booking."""
import os
import time
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://clinic-reserve-30.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TS = int(time.time())
NEW_EMAIL = f"test+{TS}@example.com"
NEW_PASSWORD = "Test@1234"
NEW_NAME = "Test Patient"
EXISTING_EMAIL = "patient@example.com"
EXISTING_PASSWORD = "Patient@123"

state = {}


# ---------- Auth ----------
def test_register_new_user():
    r = requests.post(f"{API}/auth/register", json={"name": NEW_NAME, "email": NEW_EMAIL, "password": NEW_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["email"] == NEW_EMAIL
    assert data["user"]["name"] == NEW_NAME
    assert "id" in data["user"]
    state["token"] = data["token"]
    state["user_id"] = data["user"]["id"]


def test_register_duplicate_email():
    r = requests.post(f"{API}/auth/register", json={"name": NEW_NAME, "email": NEW_EMAIL, "password": NEW_PASSWORD})
    assert r.status_code == 400


def test_login_existing_or_new():
    # Try the seeded patient first; if not exists, register then login
    r = requests.post(f"{API}/auth/login", json={"email": EXISTING_EMAIL, "password": EXISTING_PASSWORD})
    if r.status_code != 200:
        requests.post(f"{API}/auth/register", json={"name": "Test Patient", "email": EXISTING_EMAIL, "password": EXISTING_PASSWORD})
        r = requests.post(f"{API}/auth/login", json={"email": EXISTING_EMAIL, "password": EXISTING_PASSWORD})
    assert r.status_code == 200, r.text
    assert "token" in r.json()


def test_login_wrong_password():
    r = requests.post(f"{API}/auth/login", json={"email": NEW_EMAIL, "password": "wrongpass"})
    assert r.status_code == 401


def test_me_with_valid_token():
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {state['token']}"})
    assert r.status_code == 200
    assert r.json()["email"] == NEW_EMAIL


def test_me_without_token():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_me_invalid_token():
    r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert r.status_code == 401


def test_logout():
    r = requests.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {state['token']}"})
    assert r.status_code == 200
    assert r.json().get("success") is True


# ---------- Doctors / time-slots ----------
def test_get_doctors():
    r = requests.get(f"{API}/doctors")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 26, f"Expected 26 seeded doctors, got {len(data)}"
    d = data[0]
    for k in ("id", "name", "specialization", "years_experience", "bio"):
        assert k in d
    state["doctor_id"] = d["id"]


def test_time_slots():
    r = requests.get(f"{API}/time-slots")
    assert r.status_code == 200
    slots = r.json()
    assert slots == [
        "09:00-10:00", "10:00-11:00", "11:00-12:00", "12:00-13:00",
        "13:00-14:00", "14:00-15:00", "15:00-16:00", "16:00-17:00",
    ]


# ---------- Appointments ----------
def _hdr():
    return {"Authorization": f"Bearer {state['token']}"}


def _future_date(offset=7):
    return (date.today() + timedelta(days=offset)).isoformat()


def test_book_no_token():
    r = requests.post(f"{API}/appointments", json={"doctor_id": state["doctor_id"], "date": _future_date(), "time_slot": "09:00-10:00"})
    assert r.status_code == 401


def test_book_unknown_doctor():
    r = requests.post(f"{API}/appointments", json={"doctor_id": "nonexistent-id", "date": _future_date(), "time_slot": "09:00-10:00"}, headers=_hdr())
    assert r.status_code == 404


def test_book_invalid_slot():
    r = requests.post(f"{API}/appointments", json={"doctor_id": state["doctor_id"], "date": _future_date(), "time_slot": "08:00-09:00"}, headers=_hdr())
    assert r.status_code == 400


def test_book_past_date():
    past = (date.today() - timedelta(days=1)).isoformat()
    r = requests.post(f"{API}/appointments", json={"doctor_id": state["doctor_id"], "date": past, "time_slot": "09:00-10:00"}, headers=_hdr())
    assert r.status_code == 400


def test_book_success():
    # Use a unique slot per test run
    state["appt_date"] = _future_date(offset=14 + (TS % 30))
    state["appt_slot"] = "10:00-11:00"
    r = requests.post(f"{API}/appointments", json={"doctor_id": state["doctor_id"], "date": state["appt_date"], "time_slot": state["appt_slot"]}, headers=_hdr())
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["doctor_id"] == state["doctor_id"]
    assert data["date"] == state["appt_date"]
    assert data["time_slot"] == state["appt_slot"]
    assert "id" in data
    state["appt_id"] = data["id"]


def test_book_double_booking_409():
    r = requests.post(f"{API}/appointments", json={"doctor_id": state["doctor_id"], "date": state["appt_date"], "time_slot": state["appt_slot"]}, headers=_hdr())
    assert r.status_code == 409


def test_get_my_appointments():
    r = requests.get(f"{API}/appointments", headers=_hdr())
    assert r.status_code == 200
    items = r.json()
    assert any(a["id"] == state["appt_id"] for a in items)


def test_booked_slots():
    r = requests.get(f"{API}/appointments/booked", params={"doctor_id": state["doctor_id"], "date": state["appt_date"]}, headers=_hdr())
    assert r.status_code == 200
    assert state["appt_slot"] in r.json()["booked"]


def test_cancel_appointment():
    r = requests.delete(f"{API}/appointments/{state['appt_id']}", headers=_hdr())
    assert r.status_code == 200
    # Verify removal
    r2 = requests.get(f"{API}/appointments", headers=_hdr())
    assert all(a["id"] != state["appt_id"] for a in r2.json())
