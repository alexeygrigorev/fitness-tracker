"""
Tests for authentication endpoints.

These tests follow the Django-style pattern:
1. Prepare state (create users, set up data)
2. Make actions (API calls)
3. Assert the results
4. Transactions are automatically rolled back
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


class TestUserRegistration:
    """Tests for user registration endpoint."""

    def test_register_new_user(self, client: TestClient, db_session: Session):
        """
        Test registering a new user.

        Pattern:
        1. No setup needed (testing creation)
        2. Call POST /api/v1/auth/register
        3. Assert user is created and returned
        """
        # Action
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "password123",
            },
        )

        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "newuser@example.com"
        assert "id" in data
        assert data["is_active"] is True

        # Verify in database
        from app.models.user import User

        user = db_session.query(User).filter(User.username == "newuser").first()
        assert user is not None
        assert user.email == "newuser@example.com"

    def test_register_duplicate_username(self, client: TestClient, create_user):
        """
        Test registering with a duplicate username.

        Pattern:
        1. Prepare state: Create existing user
        2. Action: Try to register with same username
        3. Assert: Returns 400 error
        """
        # Prepare state
        create_user(username="existing", email="existing@example.com")

        # Action
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "existing",  # Duplicate username
                "email": "different@example.com",
                "password": "password123",
            },
        )

        # Assert
        assert response.status_code == 400
        assert "Username already registered" in response.json()["detail"]

    def test_register_duplicate_email(self, client: TestClient, create_user):
        """
        Test registering with a duplicate email.

        Pattern:
        1. Prepare state: Create existing user
        2. Action: Try to register with same email
        3. Assert: Returns 400 error
        """
        # Prepare state
        create_user(username="user1", email="shared@example.com")

        # Action
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "user2",
                "email": "shared@example.com",  # Duplicate email
                "password": "password123",
            },
        )

        # Assert
        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]


class TestUserLogin:
    """Tests for user login endpoint."""

    def test_login_success(self, client: TestClient, create_user, test_password: str):
        """
        Test successful login.

        Pattern:
        1. Prepare state: Create a user
        2. Action: Login with correct credentials
        3. Assert: Get access token
        """
        # Prepare state
        create_user(username="testuser", email="test@example.com", password=test_password)

        # Action
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "testuser",
                "password": test_password,
            },
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client: TestClient, create_user):
        """
        Test login with wrong password.

        Pattern:
        1. Prepare state: Create a user
        2. Action: Try to login with wrong password
        3. Assert: Returns 401 error
        """
        # Prepare state
        create_user(username="testuser", password="correctpass")

        # Action
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "testuser",
                "password": "wrongpass",
            },
        )

        # Assert
        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]

    def test_login_nonexistent_user(self, client: TestClient):
        """
        Test login with non-existent user.

        Pattern:
        1. No setup
        2. Action: Try to login with unknown user
        3. Assert: Returns 401 error
        """
        # Action
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "nonexistent",
                "password": "password",
            },
        )

        # Assert
        assert response.status_code == 401


class TestGetCurrentUser:
    """Tests for getting current user endpoint."""

    def test_get_current_user_unauthorized(self, client: TestClient):
        """
        Test getting current user without authentication.

        Pattern:
        1. No authentication
        2. Action: Call GET /api/v1/auth/me
        3. Assert: Returns 401 error
        """
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

    def test_get_current_user_success(self, authenticated_client: TestClient):
        """
        Test getting current user with valid authentication.

        Pattern:
        1. Prepare state: Use authenticated_client fixture (creates user + token)
        2. Action: Call GET /api/v1/auth/me
        3. Assert: Returns user data
        """
        # Action
        response = authenticated_client.get("/api/v1/auth/me")

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert data["email"] == "testuser@example.com"
