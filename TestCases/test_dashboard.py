import pytest
from playwright.sync_api import Page, expect
from reportportal_client import step

def test_dashboard_ui_and_navigation(auth_page: Page, frontend_url: str):
    """Test Case 16: Dashboard"""
    with step("Navigate to Dashboard page"):
        auth_page.goto(f"{frontend_url}/dashboard")
    
    with step("Step 1: Dashboard section Visual"):
        expect(auth_page.locator("h3:has-text('Patient Registrations')")).to_be_visible()
        
        patient_profile_card = auth_page.locator("h4:has-text('Patient Profile')")
        register_patients_card = auth_page.locator("h4:has-text('Register Patients')")
        
        expect(patient_profile_card).to_be_visible()
        expect(register_patients_card).to_be_visible()
        
    with step("Step 2: Register Patients Card redirect"):
        auth_page.locator("button:has-text('Register Patients')").click()
        auth_page.wait_for_url(f"{frontend_url}/register")
        expect(auth_page).to_have_url(f"{frontend_url}/register")
        
    with step("Return to Dashboard"):
        auth_page.goto(f"{frontend_url}/dashboard")
        
    with step("Step 3: Patient Profile Card redirect"):
        auth_page.locator("button:has-text('Patient Profile')").click()
        auth_page.wait_for_url(f"{frontend_url}/patient")
        expect(auth_page).to_have_url(f"{frontend_url}/patient")
