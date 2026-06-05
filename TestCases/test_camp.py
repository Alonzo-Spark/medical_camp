import pytest
import time
from playwright.sync_api import Page, expect
from reportportal_client import step

def test_camp_registration_page_load_and_validation(auth_page: Page, frontend_url: str):
    """Test Case 6: Camp Registration (Steps 1 & 2)"""
    with step("Navigate to Camp Registration page"):
        auth_page.goto(f"{frontend_url}/camp-registration")
    
    with step("Step 1: Check header and placeholders"):
        expect(auth_page.locator("h3:has-text('Medical Camp Registration')")).to_be_visible()
        
        venue_input = auth_page.locator("input[placeholder='e.g. Community Center, City Hall']")
        camp_id_input = auth_page.locator("input[placeholder='Enter Camp ID...']")
        date_input = auth_page.locator("input[placeholder='DD/MM/YYYY']")
        
        expect(venue_input).to_be_empty()
        expect(camp_id_input).to_be_empty()
        expect(date_input).to_be_empty()
    
    with step("Step 2: Form validation - Submit empty form"):
        submit_btn = auth_page.locator("button[type='submit']")
        submit_btn.click()
        
        venue_validation = venue_input.evaluate("el => el.validationMessage")
        assert venue_validation != "", "Native browser tooltip should block form submission for empty required fields"

def test_camp_registration_inputs(auth_page: Page, frontend_url: str):
    """Test Case 6: Camp Registration (Steps 3, 4, 5, 6, 7)"""
    with step("Navigate to Camp Registration page"):
        auth_page.goto(f"{frontend_url}/camp-registration")
    
    with step("Step 3: Venue accepts text and numeric values"):
        auth_page.fill("input[placeholder='e.g. Community Center, City Hall']", "Main Venue 123")
    
    with step("Step 4: Camp Number (numeric check)"):
        camp_id_input = auth_page.locator("input[placeholder='Enter Camp ID...']")
        
        dialog_messages = []
        auth_page.on("dialog", lambda dialog: (dialog_messages.append(dialog.message), dialog.accept()))
        
        camp_id_input.fill("CAMP")
        
        if dialog_messages:
            assert "Please enter numbers only" in dialog_messages[0]
            
        expect(camp_id_input).to_have_value("")
            
        unique_camp_id = str(int(time.time()))[-5:]
        camp_id_input.fill(unique_camp_id)
    
    with step("Step 5: Camp Date formatting"):
        date_input = auth_page.locator("input[placeholder='DD/MM/YYYY']")
        date_input.press_sequentially("30052026")
        expect(date_input).to_have_value("30/05/2026")
    
    with step("Step 6 & 7: Register Camp and verify success message"):
        auth_page.click("button[type='submit']")
        expect(auth_page.locator("text=Camp Registered")).to_be_visible(timeout=5000)

def test_camp_report_section(auth_page: Page, frontend_url: str):
    """Test Case 15: Camp Reports"""
    with step("Navigate to Camp Report page"):
        auth_page.goto(f"{frontend_url}/camp-report")
        expect(auth_page.locator("text=Executive Camp Summary")).to_be_visible()
    
    with step("Step 1: Selecting a Camp"):
        dropdown = auth_page.locator("select")
        auth_page.wait_for_timeout(1000)
        
        options = dropdown.locator("option").all_inner_texts()
        if len(options) > 1:
            dropdown.select_option(index=1)
    
    with step("Step 2: Loading summary"):
        expect(auth_page.locator("text=Total Patients")).to_be_visible(timeout=5000)
        expect(auth_page.locator("text=Overall Medicine")).to_be_visible()
        expect(auth_page.locator("text=Doctors On Duty")).to_be_visible()
        expect(auth_page.locator("text='Tests Conducted'").first).to_be_visible()
    
    with step("Step 3: Export CSV"):
        download_btn = auth_page.locator("button:has-text('Download Report')")
        expect(download_btn).not_to_be_disabled()
        
        try:
            with auth_page.expect_download(timeout=5000) as download_info:
                download_btn.click()
            download = download_info.value
            assert download is not None
        except Exception:
            with auth_page.expect_popup() as popup_info:
                download_btn.click()
            popup = popup_info.value
            assert popup is not None
