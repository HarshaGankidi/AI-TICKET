from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from pathlib import Path

# Get the base directory (where .env is located)
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)

# Simple migration to ensure columns exist
def run_migrations():
    with engine.connect() as conn:
        # Check if is_admin exists in users
        try:
            conn.execute(text("SELECT is_admin FROM users LIMIT 1"))
        except Exception:
            print("Adding is_admin column to users table...")
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0"))
            conn.commit()

        # Check if rating exists in tickets
        try:
            conn.execute(text("SELECT rating FROM tickets LIMIT 1"))
        except Exception:
            print("Adding rating column to tickets table...")
            conn.execute(text("ALTER TABLE tickets ADD COLUMN rating INTEGER"))
            conn.commit()

        # Check if first_response_seconds exists in tickets
        try:
            conn.execute(text("SELECT first_response_seconds FROM tickets LIMIT 1"))
        except Exception:
            print("Adding first_response_seconds column to tickets table...")
            conn.execute(text("ALTER TABLE tickets ADD COLUMN first_response_seconds INTEGER"))
            conn.commit()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
