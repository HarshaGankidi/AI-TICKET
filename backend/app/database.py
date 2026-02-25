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
    # Check if is_admin exists in users
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT is_admin FROM users LIMIT 1"))
        except Exception:
            conn.rollback() # Rollback the failed SELECT transaction
            print("Adding is_admin column to users table...")
            with engine.begin() as migration_conn: # Use a new transaction
                migration_conn.execute(text("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0"))

    # Check if rating exists in tickets
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT rating FROM tickets LIMIT 1"))
        except Exception:
            conn.rollback()
            print("Adding rating column to tickets table...")
            with engine.begin() as migration_conn:
                migration_conn.execute(text("ALTER TABLE tickets ADD COLUMN rating INTEGER"))

    # Check if first_response_seconds exists in tickets
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT first_response_seconds FROM tickets LIMIT 1"))
        except Exception:
            conn.rollback()
            print("Adding first_response_seconds column to tickets table...")
            with engine.begin() as migration_conn:
                migration_conn.execute(text("ALTER TABLE tickets ADD COLUMN first_response_seconds INTEGER"))

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
