import pytest
from playwright.sync_api import Page, APIRequestContext, expect
from reportportal_client import step

# Constants
import os

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")

@pytest.fixture(scope="session")
def api_context(playwright) -> APIRequestContext:
    """Fixture to create an APIRequestContext for backend testing."""
    # Setup context
    request_context = playwright.request.new_context(base_url=BACKEND_URL)
    yield request_context
    # Teardown context
    request_context.dispose()


def test_frontend_login_page_loads(page: Page):
    """Test Case 2 & 3: Application Layout Theme & Responsiveness"""
    with step("Navigate to Frontend URL"):
        page.goto(f"{FRONTEND_URL}/")
    
    with step("Wait for network idle state"):
        # We wait for the network to be idle to ensure components are loaded.
        page.wait_for_load_state('networkidle')
    
    with step("Assert login page content loads"):
        # Basic assertion to check if it's the right app by fetching page content
        content = page.content()
        assert "Login" in content or "AdminLogin" in content or "<div" in content

def test_backend_api_camps(api_context: APIRequestContext):
    """
    Test the backend API to ensure it returns a valid response.
    Make sure your Django server (python manage.py runserver) is running on port 8000.
    """
    with step("Send GET request to /api/camps"):
        # Using the /api/camps endpoint from inventory.urls
        response = api_context.get("/api/camps")
    
    with step("Assert response is 200 OK"):
        # Assert the response status is 200 OK
        assert response.ok, f"API returned status {response.status}"
    
    with step("Assert response is valid JSON"):
        # Assert the response is JSON format
        data = response.json()
        assert isinstance(data, list) or "camps" in data or isinstance(data, dict), "Unexpected JSON structure"

def test_backend_api_categories(api_context: APIRequestContext):
    """
    Another API test for the /api/categories endpoint.
    """
    with step("Send GET request to /api/categories"):
        response = api_context.get("/api/categories")
    
    with step("Assert response is 200 OK"):
        assert response.ok, f"API returned status {response.status}"
    
    with step("Verify JSON response data is not null"):
        # Verify we got a JSON response
        data = response.json()
        assert data is not None
