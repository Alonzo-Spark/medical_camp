# Knowledge

> Central repository for architectural decisions, tricky bug fixes, reusable context, and gotchas.

## Architecture Decisions

- **Unified ASGI Server (FastAPI + Django)**:
  We mounted Django inside a FastAPI app in `asgi_unified.py`. This lets us keep Django's powerful ORM, admin panel, and existing APIs, while using FastAPI's high-concurrency WebSocket server for Exotel streaming on a single port (`8000`).
- **Pre-recorded Greeting WAV**:
  To ensure instant delivery of the greeting message when a patient answers, we stream a pre-recorded WAV file (`test_telugu_reminder.wav`) directly to the Exotel stream, bypassing initial TTS generation latency.
- **Audio Pacing**:
  Exotel expects 20ms audio frames (320 bytes at 8kHz, 16-bit, mono PCM). When streaming audio, we must chunk the raw PCM into 320-byte blocks and sleep exactly `0.02` seconds between sends to match real-time playback.

## Patterns & Gotchas

- **Dotenv Initialization Order**:
  `load_dotenv()` must be called at the very beginning of the entrypoint file (`asgi_unified.py`) BEFORE any Django or voicebot modules are imported, otherwise class-level settings will fail to load credentials.
- **ffmpeg Subprocess Management**:
  Resampling audio from 8kHz (Exotel) to 16kHz (Sarvam ASR) and decoding MP3 to 8kHz PCM (Sarvam TTS) uses `ffmpeg` subprocesses. Always ensure `ffmpeg.stdin` is closed and the process is killed in a `finally` block to prevent file descriptor leaks.
- **NameError inside sync_to_async**:
  Django database operations inside FastAPI must be wrapped in `@sync_to_async`. Ensure all imports (like `from django.db import models` and `from inventory.models import Patient`) are placed inside the function body so they load dynamically once Django is ready.
