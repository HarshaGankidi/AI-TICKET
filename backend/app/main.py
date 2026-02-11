from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from .database import engine, get_db, Base
from .models import Ticket
from .ml.inference import TicketClassifier
import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Ticket AI API", description="API for AI-Powered Ticket Creation")

# Enable CORS
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5500")
origins = [
    frontend_url,
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "null" # For local file access
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Load ML Model
classifier = TicketClassifier()

# Pydantic Models
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

class TicketOut(TicketCreate):
    id: int
    status: str
    
    class Config:
        orm_mode = True

@app.get("/")
def read_root():
    return {"message": "Ticket AI API is running"}

@app.post("/predict", response_model=TicketResponse)
def predict_ticket(request: TicketRequest):
    category, priority = classifier.predict(request.text)
    if not category:
        raise HTTPException(status_code=500, detail="Model not loaded or prediction failed")
    
    entities = classifier.extract_entities(request.text)
    
    return {
        "category": category,
        "priority": priority,
        "extracted_entities": entities
    }

@app.post("/tickets", response_model=TicketOut)
def create_ticket(ticket: TicketCreate, db: Session = Depends(get_db)):
    db_ticket = Ticket(
        title=ticket.title,
        description=ticket.description,
        category=ticket.category,
        priority=ticket.priority,
        extracted_entities=ticket.extracted_entities,
        status="New"
    )
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

@app.get("/tickets", response_model=List[TicketOut])
def get_tickets(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tickets = db.query(Ticket).order_by(Ticket.id.desc()).offset(skip).limit(limit).all()
    return tickets

if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
