"""
Backend-specific test fixtures.

This module provides fixtures for creating test data and API clients.
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from app.core.database import get_db


@pytest.fixture
def client(override_get_db):
    """
    Create a test client for the FastAPI app.

    The test database is automatically injected via override_get_db.
    """
    from fastapi import FastAPI

    from main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def authenticated_client(client: TestClient, db_session: Session) -> Generator[TestClient, None, None]:
    """
    Create a test client with an authenticated user.

    A test user is automatically created and the client is configured
    with the valid JWT token.
    """
    # Create test user
    user = User(
        username="testuser",
        email="testuser@example.com",
        hashed_password=get_password_hash("testpass123"),
    )
    db_session.add(user)
    db_session.flush()

    # Create token and set authorization header
    token = create_access_token(data={"sub": user.username})
    client.headers.update({"Authorization": f"Bearer {token}"})

    yield client

    # Clear the auth header for subsequent tests
    client.headers.pop("Authorization", None)


@pytest.fixture
def test_password():
    """Default password for test users."""
    return "testpass123"


@pytest.fixture
def create_user(db_session: Session):
    """
    Factory fixture for creating test users.

    Usage:
        user = create_user(username="alice")
        user2 = create_user(username="bob", email="bob@example.com")
    """

    def _create_user(
        username: str | None = None,
        email: str | None = None,
        password: str = "testpass123",
        is_active: bool = True,
    ) -> User:
        if username is None:
            username = f"user_{id(User)}"
        if email is None:
            email = f"{username}@example.com"

        user = User(
            username=username,
            email=email,
            hashed_password=get_password_hash(password),
            is_active=is_active,
        )
        db_session.add(user)
        db_session.flush()
        return user

    return _create_user


@pytest.fixture(autouse=True)
def reset_mock_state(request):
    """
    Automatically reset global mock state before each test.

    This ensures tests are isolated since the workout sessions, foods, meals,
    and other services use global in-memory storage.
    """
    # Only reset if the test module needs API endpoints (skip for pure unit tests)
    module_path = request.module.__name__ if request.module else ""

    if "api" in module_path.lower() or "workout" in module_path.lower() or "food" in module_path.lower():
        try:
            from app.api.v1.workouts import sessions, active_state
            sessions.MOCK_WORKOUTS.clear()
            sessions.WORKOUT_ID_COUNTER = 1
            active_state.MOCK_ACTIVE_WORKOUTS.clear()
        except ImportError:
            pass

        try:
            from app.api.v1.food import foods, meals, meal_templates
            foods.MOCK_FOODS.clear()
            foods.FOOD_ID_COUNTER = 1
            meals.MOCK_MEALS.clear()
            meals.MEAL_ID_COUNTER = 1
            meal_templates.MOCK_TEMPLATES.clear()
            meal_templates.TEMPLATE_ID_COUNTER = 1
        except ImportError:
            pass

    yield


@pytest.fixture
def create_user_with_token(override_get_db):
    """
    Factory fixture that creates a user and returns an authenticated client.

    Usage:
        # Create a new user and get a client authenticated as that user
        client = create_user_with_token(username="alice")
        response = client.get("/api/v1/auth/me")
        assert response.json()["username"] == "alice"
    """
    from main import app

    def _create_user_with_token(
        username: str | None = None,
        email: str | None = None,
        password: str = "testpass123",
    ) -> TestClient:
        if username is None:
            username = f"user_{id(User)}"
        if email is None:
            email = f"{username}@example.com"

        # Get a fresh db session from the dependency
        db_gen = app.dependency_overrides.get(get_db, get_db)()
        db = next(db_gen)

        user = User(
            username=username,
            email=email,
            hashed_password=get_password_hash(password),
        )
        db.add(user)
        db.flush()

        token = create_access_token(data={"sub": user.username})

        # Create a new client with this token
        test_client = TestClient(app)
        test_client.headers.update({"Authorization": f"Bearer {token}"})

        try:
            next(db_gen)
        except StopIteration:
            pass

        return test_client

    return _create_user_with_token
