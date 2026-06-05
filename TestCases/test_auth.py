import pytest
from playwright.sync_api import Page, expect
from reportportal_client import step

def test_auth_page_loading(page: Page, frontend_url: str):
    """Test Case 1: Authentication Page (URL loading, UI)"""
    with step("Step 1: Web URL Loading"):
        page.goto(frontend_url)
        
        # Check if main container and headers exist
        expect(page.locator("text=SWASTH")).to_be_visible()
        expect(page.locator("text=MEDICAL CAMP MANAGEMENT SYSTEM")).to_be_visible()
    
    with step("Step 2: Authentication Page UI"):
        username_input = page.locator("input[placeholder='Enter username']")
        password_input = page.locator("input[placeholder='••••••••']")
        submit_btn = page.locator("button[type='submit']")
        
        expect(username_input).to_be_visible()
        expect(password_input).to_be_visible()
        expect(submit_btn).to_be_visible()

def test_password_visibility_toggle(page: Page, frontend_url: str):
    """Test Case 1: Authentication Page (Password visibility)"""
    with step("Navigate to Auth page"):
        page.goto(frontend_url)
    
    with step("Step 4: Password Visibility - eye button"):
        password_input = page.locator("input[placeholder='••••••••']")
        # Initial state should be 'password'
        expect(password_input).to_have_attribute("type", "password")
        
        page.fill("input[placeholder='••••••••']", "mysecret")
        
        # Click the eye button (it's the only button with type='button' in the form)
        eye_button = page.locator("button[type='button']").first
        eye_button.click()
        
        # State should change to 'text'
        expect(password_input).to_have_attribute("type", "text")

def test_auth_missing_inputs(page: Page, frontend_url: str):
    """Test Case 1: Authentication Page (Missing Inputs)"""
    with step("Navigate to Auth page"):
        page.goto(frontend_url)
    
    with step("Step 6: Missing Inputs Values in Input Fields"):
        username_input = page.locator("input[placeholder='Enter username']")
        password_input = page.locator("input[placeholder='••••••••']")
        submit_btn = page.locator("button[type='submit']")
        
        # Click submit with empty fields
        submit_btn.click()
        
        # HTML5 validation: check validationMessage on the required inputs
        username_validation = username_input.evaluate("el => el.validationMessage")
        password_validation = password_input.evaluate("el => el.validationMessage")
        
        assert (username_validation != "" or password_validation != ""), "Validation message should appear for empty required fields."
        expect(submit_btn).to_have_text("Authorize & Sign In")

def test_auth_invalid_credentials(page: Page, frontend_url: str):
    """Test Case 1: Authentication Page (Invalid Credentials)"""
    with step("Navigate to Auth page"):
        page.goto(frontend_url)
    
    with step("Step 3: Credentials Authentication (Invalid inputs)"):
        page.fill("input[placeholder='Enter username']", "invalid_user")
        page.fill("input[placeholder='••••••••']", "wrong_password")
    
    with step("Step 7: Sign-In button click"):
        page.click("button[type='submit']")
        
        # Wait for status error indicator
        expect(page.locator("text=❌ Credentials Invalid")).to_be_visible()

def test_auth_success_and_logout(page: Page, frontend_url: str):
    """Test Case 1: Authentication Page (Login)"""
    with step("Navigate to Auth page"):
        page.goto(frontend_url)
    
    with step("Step 3: Credentials Authentication (Valid inputs)"):
        page.fill("input[placeholder='Enter username']", "admin")
        page.fill("input[placeholder='••••••••']", "medcamp2024")
        page.click("button[type='submit']")
        expect(page.locator("text=✅ Redirecting to System...")).to_be_visible()
    
    with step("Step 5 & 8: Success Redirect to dashboard"):
        page.wait_for_url(f"{frontend_url}/dashboard", timeout=5000)
        expect(page).to_have_url(f"{frontend_url}/dashboard")
    
    with step("Test Case 16, Step 1: Clicking on Sign Out button to Logout"):
        sign_out_button = page.locator("button:has-text('Sign Out'), button:has-text('Logout')")
        if sign_out_button.count() > 0:
            sign_out_button.first.click()
            
    with step("Test Case 16, Step 2: Getting back to Authentication Page"):
        if sign_out_button.count() > 0:
            page.wait_for_url(f"{frontend_url}/login", timeout=5000)
            expect(page.locator("text=SWASTH")).to_be_visible()
