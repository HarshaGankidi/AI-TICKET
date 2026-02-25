from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any, List
from datetime import datetime
from .database import engine, get_db, Base
from .models import Ticket, User
from .ml.inference import TicketClassifier
from .auth import verify_password, get_password_hash, create_access_token, ALGORITHM, SECRET_KEY
from jose import JWTError, jwt
import uvicorn
import os
from dotenv import load_dotenv
from pathlib import Path

# Get the base directory (where .env is located)
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Customer Support Hub", description="Advanced Support Ticket Management System")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load ML Model
classifier = TicketClassifier()

# Auth Configuration
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Pydantic Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    is_admin: Optional[int] = 0
    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenWithUser(Token):
    user: UserOut

class TicketRequest(BaseModel):
    text: str

class TicketResponse(BaseModel):
    category: str
    priority: str
    extracted_entities: Dict[str, Any]

class TicketCreate(BaseModel):
    title: str
    description: str
    category: str
    priority: str
    extracted_entities: Optional[Dict[str, Any]] = {}
    rating: Optional[int] = None
    first_response_seconds: Optional[int] = None

class TicketOut(TicketCreate):
    id: int
    status: str
    owner_id: int
    
    class Config:
        orm_mode = True


class ReviewIn(BaseModel):
    rating: int

# Helper to get current user
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

@app.get("/")
def read_root():
    return {"status": "online", "message": "Support Hub API is running"}

# Auth Endpoints
@app.post("/register", response_model=UserOut)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    is_admin = 0
    if user.email == "admin@gmail.com":
        is_admin = 1
        
    new_user = User(
        email=user.email,
        hashed_password=get_password_hash(user.password),
        full_name=user.full_name,
        is_admin=is_admin
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token", response_model=TokenWithUser)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@app.get("/users/me", response_model=UserOut)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.post("/predict", response_model=TicketResponse)
def predict_ticket(request: TicketRequest, current_user: User = Depends(get_current_user)):
    category, priority = classifier.predict(request.text)
    if not category:
        raise HTTPException(status_code=500, detail="Model error")
    
    entities = classifier.extract_entities(request.text)
    
    return {
        "category": category,
        "priority": priority,
        "extracted_entities": entities
    }

@app.post("/tickets", response_model=TicketOut)
def create_ticket(ticket: TicketCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_ticket = Ticket(
        title=ticket.title,
        description=ticket.description,
        category=ticket.category,
        priority=ticket.priority,
        extracted_entities=ticket.extracted_entities,
        status="New",
        owner_id=current_user.id
    )
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

@app.get("/tickets", response_model=List[TicketOut])
def get_tickets(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.is_admin:
        tickets = db.query(Ticket).order_by(Ticket.id.desc()).offset(skip).limit(limit).all()
    else:
        tickets = db.query(Ticket).filter(Ticket.owner_id == current_user.id).order_by(Ticket.id.desc()).offset(skip).limit(limit).all()
    return tickets

@app.get("/admin/users", response_model=List[UserOut])
def get_all_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    return db.query(User).all()


@app.post("/tickets/{ticket_id}/review", response_model=TicketOut)
def review_ticket(ticket_id: int, review: ReviewIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if review.rating < 1 or review.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.owner_id == current_user.id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.rating = review.rating
    if ticket.first_response_seconds is None and ticket.created_at is not None:
        # Approximate first response time as time between creation and first rating
        delta = datetime.utcnow() - ticket.created_at.replace(tzinfo=None)
        ticket.first_response_seconds = int(delta.total_seconds())

    db.commit()
    db.refresh(ticket)
    return ticket

if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
