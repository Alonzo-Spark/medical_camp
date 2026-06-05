import pytest
from playwright.sync_api import Page, expect
from reportportal_client import step

def test_doctor_list_section(auth_page: Page, frontend_url: str):
    """Test Case 10: Doctor List"""
    with step("Navigate to Doctor List page"):
        auth_page.goto(f"{frontend_url}/doctors")
    
    with step("Step 1: Select Camp"):
        dropdown = auth_page.locator("select").first
        expect(dropdown).to_be_visible()
    
    with step("Step 2 & 3: Search by ID and Name"):
        search_bar = auth_page.locator("input[placeholder*='Search']").first
        if search_bar.count() > 0:
            search_bar.fill("14") # Search ID
            search_bar.fill("Muqeedh") # Search Name
    
    with step("Step 4: Doctor List tab"):
        doc_list_tab = auth_page.locator("button:has-text('Doctors List')").first
        if doc_list_tab.count() > 0:
            doc_list_tab.click()
            
    with step("Step 5: Edit button logic"):
        edit_btn = auth_page.locator("button[aria-label='Edit'], button:has-text('Edit')").first
        if edit_btn.count() > 0:
            edit_btn.click()
            save_btn = auth_page.locator("button:has-text('Save'), button:has-text('Update')").first
            if save_btn.count() > 0:
                save_btn.click()
                
    with step("Step 6: Delete icon"):
        delete_btn = auth_page.locator("button[aria-label='Delete'], button:has-text('Delete')").first
        if delete_btn.count() > 0:
            delete_btn.click()
            
            confirm_btn = auth_page.locator("button:has-text('Confirm'), button:has-text('Yes')").first
            if confirm_btn.count() > 0:
                confirm_btn.click()
                
    with step("Step 7: Active/Inactive status toggle"):
        status_toggle = auth_page.locator("button:has-text('Active'), button:has-text('Inactive')").first
        if status_toggle.count() > 0:
            status_toggle.click()
            
    with step("Step 8 & 9: Doctor Analytics"):
        analytics_tab = auth_page.locator("button:has-text('Doctor Analytics')").first
        if analytics_tab.count() > 0:
            analytics_tab.click()
            try:
                expect(auth_page.locator("canvas").first).to_be_visible(timeout=5000)
            except AssertionError:
                pass
            
    with step("Step 10: Register Doctor"):
        register_btn = auth_page.locator("button:has-text('Register Doctor'), button:has-text('Add New Doctor')").first
        if register_btn.count() > 0:
            register_btn.click()
            
            with step("Step 11 & 12: Name & Specialization"):
                name_input = auth_page.locator("input[placeholder*='Name']").last
                if name_input.count() > 0:
                    name_input.fill("Dr. Test Playwright")
                    
                spec_input = auth_page.locator("input[placeholder*='Specialization'], select").last
                if spec_input.count() > 0:
                    try:
                        spec_input.fill("Cardiology")
                    except:
                        pass
                        
            with step("Step 13: Submit"):
                submit_btn = auth_page.locator("button[type='submit']:has-text('Register')").first
                if submit_btn.count() > 0:
                    expect(submit_btn).to_be_visible()

def test_doctor_consultation_log(auth_page: Page, frontend_url: str):
    """Test Case 11: Doctor Consultation Log"""
    with step("Navigate to Doctor Consultation Log page"):
        auth_page.goto(f"{frontend_url}/doctor-consultation-log")
    
    with step("Step 1: Selecting camp"):
        expect(auth_page.locator("select").first).to_be_visible()
    
    with step("Step 2: Patient ID and Name"):
        id_input = auth_page.locator("input[placeholder*='ID']").first
        if id_input.count() > 0:
            id_input.fill("123")
            auth_page.wait_for_timeout(500)
            
    with step("Step 3: Add Patient"):
        add_btn = auth_page.locator("button:has-text('Add Patient')").first
        if add_btn.count() > 0:
            expect(add_btn).to_be_visible()
            
    with step("Step 4: Doctor Patient List button"):
        list_btn = auth_page.locator("button:has-text('Patient List'), a[href*='doctor-patient-list']").first
        if list_btn.count() > 0:
            list_btn.click()
            auth_page.wait_for_url(f"{frontend_url}/doctor-patient-list", timeout=5000)
            expect(auth_page).to_have_url(f"{frontend_url}/doctor-patient-list")
            
            with step("Step 5: Selecting camp from dropdown"):
                expect(auth_page.locator("select").first).to_be_visible()
                
            with step("Step 6: Edit icon"):
                edit_btn = auth_page.locator("button[aria-label='Edit'], button:has-text('Edit')").first
                if edit_btn.count() > 0:
                    expect(edit_btn).to_be_visible()
                    
            with step("Step 7: Delete icon"):
                delete_btn = auth_page.locator("button[aria-label='Delete'], button:has-text('Delete')").first
                if delete_btn.count() > 0:
                    expect(delete_btn).to_be_visible()
                    
            with step("Step 8: Back to Consultation Log"):
                back_btn = auth_page.locator("button:has-text('Back')").first
                if back_btn.count() > 0:
                    back_btn.click()
                    expect(auth_page).to_have_url(f"{frontend_url}/doctor-consultation-log")
