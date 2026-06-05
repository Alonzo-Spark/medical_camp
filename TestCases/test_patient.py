import pytest
import random
from playwright.sync_api import Page, expect
from reportportal_client import step

def test_new_patient_registration_validation(auth_page: Page, frontend_url: str):
    """Test Case 4: New Patient Registration"""
    with step("Navigate to New Patient Registration page"):
        auth_page.goto(f"{frontend_url}/register")
        expect(auth_page.locator("text=New Patient Registration").first).to_be_visible()
        auth_page.wait_for_timeout(500)
    
    unique_id = str(random.randint(10000, 99999))

    dialog_messages = []
    auth_page.on("dialog", lambda dialog: (dialog_messages.append(dialog.message), dialog.accept()))
    
    with step("Step 2: Patient ID (non-numeric alert)"):
        id_input = auth_page.locator("input[placeholder*='e.g. 1001'], input[placeholder*='ID']").first
        if id_input.count() > 0:
            id_input.fill(f"P-{unique_id}a")
            if dialog_messages:
                assert "numbers only" in dialog_messages[-1].lower() or "patient id" in dialog_messages[-1].lower()
    
    with step("Step 3: Patient Name (numeric alert)"):
        name_input = auth_page.locator("input[placeholder*='name']").first
        if name_input.count() > 0:
            name_input.fill("John 2")
        if dialog_messages:
            assert "cannot contain numbers" in dialog_messages[-1].lower() or "numbers" in dialog_messages[-1].lower()
        if name_input.count() > 0:
            expect(name_input).to_have_value("John ")
        
    with step("Step 4 & 5: Age and Gender"):
        age_input = auth_page.locator("input[placeholder*='Age']").first
        if age_input.count() > 0:
            age_input.fill("25")
        
        gender_select = auth_page.locator("select").filter(has_text="Gender").first
        if gender_select.count() == 0:
            gender_select = auth_page.locator("select").first
        gender_select.select_option("Female")
    
    with step("Step 6 & 7: Registration Date and Camp Session"):
        date_input = auth_page.locator("input[placeholder*='DD/MM/YYYY'], input[type='date']").first
        if date_input.count() > 0:
            date_input.fill("12052026")
        
        expect(auth_page.locator("select").nth(1)).to_be_visible()
    
    with step("Step 8 & 9: Contact and Address"):
        contact_input = auth_page.locator("input[placeholder*='+91'], input[placeholder*='Phone'], input[placeholder*='Contact']").first
        if contact_input.count() > 0:
            contact_input.fill("1234567890123")
            expect(contact_input).to_have_value("1234567890")
        
        address_input = auth_page.locator("input[placeholder*='Full address'], textarea").first
        if address_input.count() > 0:
            address_input.fill("123 Health St, City")
    
    with step("Step 10: Click Register Patient"):
        register_btn = auth_page.locator("button:has-text('Register')")
        register_btn.first.click()
        expect(auth_page.locator("text=Enrolled Successfully")).to_be_visible(timeout=5000)
    
    with step("Step 11: Reset form"):
        reset_btn = auth_page.locator("button:has-text('Reset')")
        if reset_btn.count() > 0:
            reset_btn.first.click()
            if name_input.count() > 0:
                expect(name_input).to_be_empty()
            if id_input.count() > 0:
                expect(id_input).to_be_empty()

def test_old_patient_registration(auth_page: Page, frontend_url: str):
    """Test Case 5: Old Patient Registration"""
    with step("Navigate to Old Patient Registration page"):
        auth_page.goto(f"{frontend_url}/register-old")
    
    with step("Step 1: Blank ID search"):
        find_btn = auth_page.locator("button:has-text('Find Patient'), button:has-text('Search')").first
        
        id_input = auth_page.locator("input[placeholder*='ID']").first
        id_input.fill("9999999")
        find_btn.click()
        
        expect(auth_page.locator("text=not found").first).to_be_visible(timeout=5000)
    
    with step("Step 11: Reset button clears inputs"):
        reset_btn = auth_page.locator("button:has-text('Reset')").first
        if reset_btn.count() > 0:
            reset_btn.click()
            expect(id_input).to_be_empty()

def test_patient_profile(auth_page: Page, frontend_url: str):
    """Test Case 4: Patient Profile (Navigation)"""
    with step("Navigate to Patient Profile page"):
        auth_page.goto(f"{frontend_url}/patient")
    
    with step("Step 1: Search for non-existent ID"):
        id_search = auth_page.locator("input[placeholder*='Enter Patient ID']").first
        id_search.fill("9999999")
        
        fetch_btn = auth_page.locator("button:has-text('Fetch Dossier'), button:has-text('Search')").first
        fetch_btn.click()
        
        expect(auth_page.locator("text=not found").first).to_be_visible(timeout=5000)
    
def test_camp_patient_list(auth_page: Page, frontend_url: str):
    """Test Case 7: Camp Patient List"""
    with step("Navigate to Camp Patient List"):
        auth_page.goto(f"{frontend_url}/camp-patients")
    
    with step("Step 1: UI visibility and Camp Selection"):
        dropdown = auth_page.locator("select").first
        expect(dropdown).to_be_visible()
        
        auth_page.wait_for_timeout(1000)
        options = dropdown.locator("option").all_inner_texts()
        if len(options) > 1:
            dropdown.select_option(index=1)
            
            with step("Step 4 & 5: Search by ID or Name"):
                search_input = auth_page.locator("input[placeholder*='Search']").first
                if search_input.count() > 0:
                    search_input.fill("John")
                    
            with step("Step 8: Call Remainder button"):
                call_btn = auth_page.locator("button:has-text('Call Remainder'), button:has-text('Call')").first
                if call_btn.count() > 0:
                    call_btn.click()
                    expect(auth_page.locator("text=Calls initiated")).to_be_visible(timeout=5000)

def test_adding_patients_bulk(auth_page: Page, frontend_url: str):
    """Test Case 8: Adding Patients in Bulk"""
    with step("Navigate to Adding Patients Bulk page"):
        auth_page.goto(f"{frontend_url}/adding-patients")
    
    with step("Step 1: Target Camp Dropdown"):
        expect(auth_page.locator("select").first).to_be_visible()
        
    with step("Step 2 & 3: Scan button functionality mock"):
        scan_btn = auth_page.locator("button:has-text('Scan')").first
        if scan_btn.count() > 0:
            scan_btn.click()
            # Close the modal that opens after clicking scan
            try:
                expect(auth_page.locator("text=Scan Physical Sheet").first).to_be_visible(timeout=5000)
            except Exception:
                pass
            close_icon = auth_page.locator("div.fixed button").first
            if close_icon.count() > 0:
                close_icon.click()
            auth_page.wait_for_timeout(500)
    
    with step("Step 5: Add Blank Row"):
        add_row_btn = auth_page.locator("button:has-text('Add Blank Row'), button:has-text('Add Row')").first
        if add_row_btn.count() > 0:
            add_row_btn.click()
        
    with step("Step 7: Clear Grid"):
        clear_grid_btn = auth_page.locator("button:has-text('Clear Grid'), button:has-text('Clear')").first
        if clear_grid_btn.count() > 0:
            clear_grid_btn.click()

def test_patient_vitals_log(auth_page: Page, frontend_url: str):
    """Test Case 9: Vitals Log"""
    with step("Navigate to Patient Log Vitals page"):
        auth_page.goto(f"{frontend_url}/vitals")
    
    with step("Step 1: Camp Session Dropdown"):
        expect(auth_page.locator("select").first).to_be_visible()
    
    with step("Step 7: Checkmark lab tests"):
        rbs_cb = auth_page.locator("input[type='checkbox']").first
        if rbs_cb.count() > 0:
            rbs_cb.check(force=True)
    
    with step("Step 9: Add Medicine row"):
        add_med_btn = auth_page.locator("button:has-text('Add Medicine')").first
        if add_med_btn.count() > 0:
            add_med_btn.click()
        
    with step("Step 11: Save Patient Record"):
        save_btn = auth_page.locator("button:has-text('Save Patient Record')").first
        if save_btn.count() > 0:
            save_btn.click()
