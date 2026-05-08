from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta, date as date_type
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, Field, EmailStr


# ---------- DB ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ---------- App ----------
app = FastAPI(title="Meridian Hospital API")
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)


# ---------- Utilities ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------- Models ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str


class AuthOut(BaseModel):
    token: str
    user: UserOut


class DoctorOut(BaseModel):
    id: str
    name: str
    specialization: str
    years_experience: int
    bio: str


class BookIn(BaseModel):
    doctor_id: str
    date: str  # YYYY-MM-DD
    time_slot: str  # e.g. "09:00-10:00"


class AppointmentOut(BaseModel):
    id: str
    doctor_id: str
    doctor_name: str
    doctor_specialization: str
    date: str
    time_slot: str
    created_at: str


# ---------- Auth routes ----------
@api_router.post("/auth/register", response_model=AuthOut)
async def register(data: RegisterIn):
    email = data.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "name": data.name.strip(),
        "email": email,
        "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email)
    return AuthOut(token=token, user=UserOut(id=user_id, name=doc["name"], email=email))


@api_router.post("/auth/login", response_model=AuthOut)
async def login(data: LoginIn):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    return AuthOut(token=token, user=UserOut(id=user["id"], name=user["name"], email=email))


@api_router.post("/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    # JWT is stateless; client removes token. Endpoint exists for parity.
    return {"success": True, "message": "Logged out"}


@api_router.get("/auth/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user)):
    return UserOut(id=current_user["id"], name=current_user["name"], email=current_user["email"])


# ---------- Doctors ----------
@api_router.get("/doctors", response_model=List[DoctorOut])
async def get_doctors():
    docs = await db.doctors.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    return [DoctorOut(**d) for d in docs]


# ---------- Appointments ----------
TIME_SLOTS = [
    "09:00-10:00",
    "10:00-11:00",
    "11:00-12:00",
    "12:00-13:00",
    "13:00-14:00",
    "14:00-15:00",
    "15:00-16:00",
    "16:00-17:00",
]


@api_router.get("/time-slots", response_model=List[str])
async def time_slots():
    return TIME_SLOTS


@api_router.post("/appointments", response_model=AppointmentOut)
async def book_appointment(data: BookIn, current_user: dict = Depends(get_current_user)):
    # Validate slot
    if data.time_slot not in TIME_SLOTS:
        raise HTTPException(status_code=400, detail="Invalid time slot")
    # Validate date format + not in the past
    try:
        booking_date = datetime.strptime(data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (YYYY-MM-DD)")
    if booking_date < datetime.now(timezone.utc).date():
        raise HTTPException(status_code=400, detail="Cannot book appointments in the past")

    # Verify doctor exists
    doctor = await db.doctors.find_one({"id": data.doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Double-booking check: same doctor + date + slot
    clash = await db.appointments.find_one({
        "doctor_id": data.doctor_id,
        "date": data.date,
        "time_slot": data.time_slot,
    })
    if clash:
        raise HTTPException(status_code=409, detail="Slot already booked for this doctor")

    appt_id = str(uuid.uuid4())
    doc = {
        "id": appt_id,
        "user_id": current_user["id"],
        "doctor_id": data.doctor_id,
        "doctor_name": doctor["name"],
        "doctor_specialization": doctor["specialization"],
        "date": data.date,
        "time_slot": data.time_slot,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.appointments.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Slot already booked for this doctor")
    return AppointmentOut(
        id=appt_id,
        doctor_id=data.doctor_id,
        doctor_name=doctor["name"],
        doctor_specialization=doctor["specialization"],
        date=data.date,
        time_slot=data.time_slot,
        created_at=doc["created_at"],
    )


@api_router.get("/appointments", response_model=List[AppointmentOut])
async def my_appointments(current_user: dict = Depends(get_current_user)):
    items = await db.appointments.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("date", -1).to_list(500)
    return [AppointmentOut(**i) for i in items]


@api_router.delete("/appointments/{appt_id}")
async def cancel_appointment(appt_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.appointments.delete_one({"id": appt_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"success": True}


@api_router.get("/appointments/booked")
async def booked_slots(doctor_id: str, date: str, current_user: dict = Depends(get_current_user)):
    """Return list of taken time_slot strings for a given doctor+date."""
    items = await db.appointments.find(
        {"doctor_id": doctor_id, "date": date}, {"_id": 0, "time_slot": 1}
    ).to_list(50)
    return {"booked": [i["time_slot"] for i in items]}


# ---------- Seed ----------
SEED_DOCTORS = [
    ("Dr. Amelia Chen", "Cardiologist", 18, "Senior interventional cardiologist focused on non-invasive diagnostics."),
    ("Dr. Rohan Mehta", "Cardiologist", 12, "Specialises in arrhythmia management and pacemaker follow-up."),
    ("Dr. Sofia Ibarra", "Dermatologist", 9, "Medical and procedural dermatology, acne & pigmentation."),
    ("Dr. Ethan Walker", "Dermatologist", 14, "Mohs surgery, skin cancer screening and laser treatments."),
    ("Dr. Priya Iyer", "Neurologist", 16, "Headache disorders, epilepsy and cognitive neurology."),
    ("Dr. Marcus Bauer", "Neurologist", 22, "Movement disorders and neurodegenerative diseases."),
    ("Dr. Helena Voss", "Pediatrician", 11, "General paediatrics, newborn care and growth monitoring."),
    ("Dr. Idris Khan", "Pediatrician", 8, "Paediatric asthma, allergies and developmental screening."),
    ("Dr. Naomi Park", "Orthopedic Surgeon", 20, "Joint replacement and sports orthopedic surgery."),
    ("Dr. Lucas Romano", "Orthopedic Surgeon", 13, "Spine and trauma orthopaedics."),
    ("Dr. Farah Haddad", "Gynecologist", 15, "High-risk pregnancy and minimally invasive gynaecology."),
    ("Dr. Saanvi Rao", "Gynecologist", 10, "Reproductive endocrinology and fertility counselling."),
    ("Dr. Oscar Nilsson", "ENT Specialist", 17, "Rhinology, sinus surgery and voice disorders."),
    ("Dr. Mei Tanaka", "Ophthalmologist", 14, "Cataract and refractive surgery, glaucoma care."),
    ("Dr. Daniel Okafor", "Ophthalmologist", 9, "Retina, vitreous and diabetic eye disease."),
    ("Dr. Clara Dupont", "Psychiatrist", 12, "Mood disorders, anxiety and adult ADHD."),
    ("Dr. Javier Soto", "Psychiatrist", 19, "Addiction medicine and psychopharmacology."),
    ("Dr. Imani Johnson", "Endocrinologist", 13, "Diabetes care, thyroid and metabolic disorders."),
    ("Dr. Theodore Hale", "Pulmonologist", 21, "Interstitial lung disease and critical care."),
    ("Dr. Anya Petrova", "Gastroenterologist", 15, "Advanced endoscopy, IBD and liver disease."),
    ("Dr. Kenji Watanabe", "Urologist", 18, "Urologic oncology and robotic surgery."),
    ("Dr. Leila Boutros", "Rheumatologist", 11, "Autoimmune arthritis and connective tissue diseases."),
    ("Dr. Thomas Reid", "Oncologist", 23, "Medical oncology, breast and thoracic cancers."),
    ("Dr. Yara El-Sayed", "Nephrologist", 14, "Chronic kidney disease, dialysis and transplant care."),
    ("Dr. Benjamin Cohen", "General Physician", 7, "Preventive care and internal medicine."),
    ("Dr. Zara Malik", "Allergist", 9, "Asthma, food allergies and immunotherapy."),
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.doctors.create_index("id", unique=True)
    # Ensure unique compound index for double-booking prevention
    try:
        existing = await db.appointments.index_information()
        idx_name = "doctor_id_1_date_1_time_slot_1"
        if idx_name in existing and not existing[idx_name].get("unique"):
            await db.appointments.drop_index(idx_name)
    except Exception:
        pass
    await db.appointments.create_index(
        [("doctor_id", 1), ("date", 1), ("time_slot", 1)], unique=True
    )
    await db.appointments.create_index("user_id")

    # Seed doctors if empty
    count = await db.doctors.count_documents({})
    if count == 0:
        seeds = []
        for name, spec, yrs, bio in SEED_DOCTORS:
            seeds.append({
                "id": str(uuid.uuid4()),
                "name": name,
                "specialization": spec,
                "years_experience": yrs,
                "bio": bio,
            })
        await db.doctors.insert_many(seeds)
        logging.getLogger(__name__).info(f"Seeded {len(seeds)} doctors")


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---------- Mount router + CORS ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
