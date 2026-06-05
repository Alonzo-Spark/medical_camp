import pytest
import os
import time
from playwright.sync_api import Page, APIRequestContext

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")

import builtins
import reportportal_client
from contextlib import contextmanager
import logging
import re
import os
import hashlib

original_step = reportportal_client.step

@contextmanager
def patched_step(name, status=None, **kwargs):
    with original_step(name, status, **kwargs) as s:
        yield s
        # After the step finishes, take a screenshot!
        page = getattr(builtins, "GLOBAL_PAGE", None)
        if page:
            try:
                page.wait_for_timeout(200) # Let UI settle
                safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', name)
                
                os.makedirs("test-results", exist_ok=True)
                # Cap the filename length
                screenshot_path = f"test-results/step_{safe_name[:40]}_screenshot.png"
                screenshot = page.screenshot(full_page=True, path=screenshot_path)
                
                # Deduplication logic: Don't upload if it's identical to the previous step's screenshot
                screenshot_hash = hashlib.md5(screenshot).hexdigest()
                last_hash = getattr(builtins, "LAST_SCREENSHOT_HASH", None)
                
                if screenshot_hash != last_hash:
                    builtins.LAST_SCREENSHOT_HASH = screenshot_hash
                    logger = logging.getLogger(__name__)
                    try:
                        logger.info(f"Screenshot for step: {name}", attachment={"name": f"{safe_name[:40]}.png", "data": screenshot, "mime": "image/png"})
                    except TypeError:
                        logger.info(f"Screenshot for step: {name}", extra={"attachment": {"name": f"{safe_name[:40]}.png", "data": screenshot, "mime": "image/png"}})
            except Exception as e:
                print(f"Step screenshot failed for {name}: {e}")

# Monkey patch it!
reportportal_client.step = patched_step

@pytest.fixture(autouse=True)
def capture_global_page(request):
    page_fixture = None
    if "page" in request.fixturenames:
        page_fixture = request.getfixturevalue("page")
    elif "auth_page" in request.fixturenames:
        page_fixture = request.getfixturevalue("auth_page")
    
    builtins.GLOBAL_PAGE = page_fixture
    builtins.LAST_SCREENSHOT_HASH = None
    yield
    builtins.GLOBAL_PAGE = None
    builtins.LAST_SCREENSHOT_HASH = None

@pytest.fixture(scope="session")
def frontend_url():
    return FRONTEND_URL

@pytest.fixture(scope="session")
def backend_url():
    return BACKEND_URL

@pytest.fixture
def auth_page(page: Page, frontend_url):
    """Fixture that logs in and returns an authenticated page for an admin."""
    page.goto(frontend_url)
    page.fill("input[placeholder='Enter username']", "admin")
    page.fill("input[placeholder='••••••••']", "medcamp2024")  # Using mock default admin credentials
    page.click("button[type='submit']")
    page.wait_for_timeout(1500) # wait for redirect
    return page

# Removed report_portal_screenshot fixture to fix fixture order closure bug

def pytest_configure(config):
    config._pdf_results = []

@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    # execute all other hooks to obtain the report object
    outcome = yield
    rep = outcome.get_result()

    # we only look at the actual test execution, not setup/teardown (unless they fail)
    if rep.when == "call" or (rep.when == "setup" and rep.failed):
        # ---------- SCREENSHOT CAPTURE LOGIC ----------
        if rep.when == "call":
            page = item.funcargs.get("page") or item.funcargs.get("auth_page")
            if page:
                try:
                    import os
                    import logging
                    # Give UI a moment to settle before screenshot
                    page.wait_for_timeout(500) 
                    os.makedirs("test-results", exist_ok=True)
                    screenshot_path = f"test-results/{item.name}_screenshot.png"
                    screenshot = page.screenshot(full_page=True, path=screenshot_path)
                    
                    logger = logging.getLogger(__name__)
                    try:
                        logger.info("Application state screenshot", attachment={"name": f"{item.name}.png", "data": screenshot, "mime": "image/png"})
                    except TypeError:
                        logger.info("Application state screenshot", extra={"attachment": {"name": f"{item.name}.png", "data": screenshot, "mime": "image/png"}})
                except Exception as e:
                    print(f"Failed to capture or attach screenshot: {e}")
        # ----------------------------------------------
        
        pdf_results = getattr(item.config, "_pdf_results", None)
        if pdf_results is not None:
            error_msg = ""
            if rep.failed:
                error_msg = str(rep.longreprtext) if rep.longreprtext else "Failed"
            
            pdf_results.append({
                "name": item.nodeid.split("::")[-1],
                "status": rep.outcome,
                "duration": rep.duration,
                "error": error_msg
            })

def pytest_sessionfinish(session, exitstatus):
    pdf_results = getattr(session.config, "_pdf_results", None)
    if pdf_results is not None:
        try:
            import sys
            # Ensure the current directory is in sys.path
            current_dir = os.path.dirname(os.path.abspath(__file__))
            if current_dir not in sys.path:
                sys.path.insert(0, current_dir)
                
            from generate_pdf_report import create_pdf_report
            
            # Save the report in the current working directory
            report_name = f"Test_Report_{int(time.time())}.pdf"
            report_path = os.path.join(str(session.config.rootdir), report_name)
            
            create_pdf_report(pdf_results, report_path)
        except Exception as e:
            print(f"\\nFailed to generate PDF report: {e}")
