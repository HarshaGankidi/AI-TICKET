from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from .database import Base

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    category = Column(String, index=True)
    priority = Column(String, index=True)
    extracted_entities = Column(JSON, nullable=True)
    status = Column(String, default="New")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
