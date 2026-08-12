from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1280, "height": 800},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
    )
    page = context.new_page()
    
    # Capture console logs
    console_logs = []
    page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: console_logs.append(f"[PAGE_ERROR] {err}"))
    page.on("requestfailed", lambda req: console_logs.append(f"[NET_FAIL] {req.url} -> {req.failure}"))

    print("Navigating to CV Builder...")
    page.goto("https://bridgecollectiveopport.org/cv-builder", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(2000)

    # Check if page loaded
    title = page.title()
    print(f"Page title: {title}")

    # Look for the summary textarea and Generate button
    page.wait_for_selector("textarea", timeout=5000)
    
    # Fill in name and title
    name_inputs = page.locator("input[placeholder='John']")
    if name_inputs.count() > 0:
        name_inputs.fill("Test")
        print("Filled first name")
    
    title_input = page.locator("input[placeholder*='Software']")
    if title_input.count() > 0:
        title_input.fill("Software Developer")
        print("Filled title")

    # Click Generate button
    generate_btn = page.get_by_role("button", name="Generate")
    if generate_btn.count() > 0:
        print("Found Generate button")
        generate_btn.click()
        print("Clicked Generate")
        
        # Wait for loading to finish
        page.wait_for_timeout(15000)
        
        # Check the summary field
        summary = page.locator("textarea").first.input_value()
        print(f"Summary after generate: '{summary[:100] if summary else 'EMPTY'}'")
    else:
        print("Generate button NOT FOUND!")
        # Debug: print all buttons
        buttons = page.locator("button").all()
        for b in buttons:
            text = b.text_content()
            if text:
                print(f"  Button: '{text.strip()}'")

    print("\n--- Console Logs ---")
    for log in console_logs:
        print(log)

    page.screenshot(path="C:\\Users\\hp\\AppData\\Local\\Temp\\opencode\\cv_builder_test.png", full_page=True)
    print("\nScreenshot saved")
    
    browser.close()
