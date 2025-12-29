#!/usr/bin/env python3
"""
Seed the database with mock data for development.

Run this script to populate the database with sample exercises,
workouts, and a default user account.

Usage:
    uv run seed_data.py
"""

from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.core.security import get_password_hash
from app.models import User
from app.models.user import Base as UserBase



def create_default_user(db: Session) -> User:
    """Create the default user account."""
    existing = db.query(User).filter(User.username == "demo").first()
    if existing:
        print("  [OK] Demo user already exists")
        return existing

    user = User(
        email="demo@fitness-tracker.com",
        username="demo",
        hashed_password=get_password_hash("demo123"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
        print("  [OK] Created demo user (demo / demo123)")
    return user


def seed_database():
    """Seed the database with mock data."""
    print("Seeding database...")

    # Create all tables
    print("Creating tables...")
    UserBase.metadata.create_all(bind=engine)
    print("  [OK] Tables created")

    db = SessionLocal()

    try:
        # Create default user
        print("\nCreating users:")
        demo_user = create_default_user(db)

        # If backend has workout/exercise models, seed them too
        if has_models:
            print("\nNote: Exercise and workout seeding should be done through the API")
            print("      after starting the server.")

        print("\n[SUCCESS] Database seeded successfully!")
        print("\n" + "="*50)
        print("  LOGIN CREDENTIALS")
        print("="*50)
        print("  Username: demo")
        print("  Password: demo123")
        print("="*50)

    except Exception as e:
        print(f"\n[ERROR] Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
