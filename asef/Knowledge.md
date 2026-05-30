# Knowledge

> Central repository for architectural decisions, tricky bug fixes, reusable context, and gotchas.

## Architecture Decisions

- **Django + Django REST Framework (DRF) Stack**:
  The system uses standard Django running via WSGI/ASGI. Django's robust ORM, admin dashboard, and signal system handle clinical records, while DRF exposes clean JSON endpoints for both the React frontend and Exotel webhooks.
- **Camp-Wide Synthesized WAV Reuse**:
  To minimize latency and avoid redundant Sarvam AI TTS API costs, we generate the Telugu reminder audio once per camp (e.g., `camp_reminder_<camp_id>.wav`). This audio is cached and reused for all patients scheduled for that camp unless the camp date, venue, or phonetic mapping changes.
- **Phonetic Telugu Mapping**:
  Because English abbreviations (such as KPHB, CCC) and date values do not pronounce correctly when read directly by Telugu text-to-speech engines, we run them through a custom translation layer (`voicebot/services/reminder_service.py`) to convert them to phonetic Telugu characters before calling the TTS API.
- **Gemini-Based Medical OCR Service**:
  To digitize paper records, we use the `gemini-3.1-flash-lite` vision model (`inventory/ocr_service.py`). It parses patient sheets and prescription reports directly into structured JSON maps containing patient details, vitals, lab test IDs, and medicine arrays.

## Patterns & Gotchas

- **Python Native Audio Resampling**:
  We resample Sarvam TTS's 22.050kHz output to Exotel's required 8kHz mono 16-bit format using Python's native `audioop.ratecv` and `wave` libraries. This avoids external subprocess calls (like `ffmpeg`) and protects against memory leaks or file descriptor exhaustions.
- **Public URL (`PUBLIC_URL`) Requirement**:
  For Exotel to successfully pull and play reminder WAV files, the callback endpoint must return a publicly accessible absolute URI. We configure a `PUBLIC_URL` variable in the `.env` file (e.g., pointing to our ngrok forwarding URL) to prefix files during development.
- **Gemini JSON Mime-Type Configuration**:
  To guarantee stable JSON output from Gemini, we configure `response_mime_type="application/json"` and temperature `0.1` inside `genai.GenerationConfig`. We also provide exact test-to-ID mappings in the prompt to match our database indices.
- **Handling Mock TTS audio**:
  If `SARVAM_API_KEY` is not configured in `.env`, the TTS service falls back to generating a tiny base64-encoded mock audio file to prevent app crashes and allow developers to test call-flow logic.
