"""
Pytest configuration with database transaction rollback.

This setup ensures that each test runs in isolation:
1. A new transaction is started before each test
2. Tests can prepare state (create users, workouts, etc.)
3. Tests perform actions (make API calls)
4. Tests assert the expected state
5. The transaction is rolled back after each test

This is similar to Django's TestCase.transactionrollback behavior.
"""

from collections.abc import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.database import Base, get_db
from app.models.user import User


# Use a separate in-memory database for tests
# This ensures tests never affect the development database
# Using cache=shared so multiple connections share the same in-memory database
TEST_DATABASE_URL = "sqlite:///:memory:?cache=shared"

test_engine = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """
    Create a new database session for a test.

    The session wraps all operations in a transaction that is rolled
    back after the test, ensuring test isolation.

    Usage in tests:
        def test_something(db_session: Session):
            # Prepare state
            user = User(username="test", email="test@example.com", hashed_password="...")
            db_session.add(user)
            db_session.flush()  # Flush to get the ID, but don't commit

            # Make actions (e.g., API calls using the db_session)
            # ...

            # Assert
            assert db_session.query(User).count() == 1
    """
    # Create all tables if not already created
    Base.metadata.create_all(bind=test_engine)

    # Connect and begin a transaction for this test
    connection = test_engine.connect()
    transaction = connection.begin()

    # Create a session bound to this connection/transaction
    session = Session(bind=connection)

    yield session

    # Rollback all changes made during the test
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def db(db_session: Session) -> Generator[Session, None, None]:
    """
    Fixture that overrides the get_db dependency.

    Use this when testing FastAPI endpoints to inject the test session.
    """
    from fastapi import FastAPI

    # This will be used by the override_dependency fixture
    yield db_session


@pytest.fixture
def override_get_db(db_session: Session):
    """
    Override the get_db dependency for testing FastAPI endpoints.

    Usage in tests:
        def test_api_endpoint(override_get_db, client):
            # client now uses the test database session
            response = client.post("/api/v1/auth/register", ...)
    """
    from main import app

    def _get_test_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.clear()
