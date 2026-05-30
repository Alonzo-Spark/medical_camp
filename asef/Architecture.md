# Architecture.md

## Components

- **Django Web Backend**:
  - **Django REST Framework (DRF)**: Responsibility: Manages all standard HTTP REST APIs, patient registrations, inventory management, patient records, vitals logging, auth, and Admin dashboards via the Django ORM.
  - Key files/modules: `medicalcamp_inventory/` (Django config), `inventory/views.py` (clinical/inventory APIs), `inventory/models.py` (core models).
- **Automated Telugu Reminder & Voicebot System**:
  - **Voicebot Application**: Responsibility: Handles voice call reminder scheduling, phonetic Telugu text generation, and webhook callbacks from Exotel telephony.
  - **Sarvam AI TTS Service**: Responsibility: Interface with Sarvam AI's Text-to-Speech API (`bulbul:v3`) to synthesize natural-sounding Telugu voice reminders.
  - **Audio Resampler**: Responsibility: Converts Sarvam AI's 22.050kHz output into 8kHz mono 16-bit WAV format on-the-fly using native Python libraries (`audioop` and `wave`) for Exotel compatibility.
  - Key files/modules: `voicebot/services/reminder_service.py` (speech formatting and management), `voicebot/services/tts_service.py` (TTS service and resampler), `voicebot/views.py` (Exotel callback views).
- **Smart Medical OCR Service**:
  - **Gemini Vision Engine**: Responsibility: Leverages Google Generative AI (`gemini-3.1-flash-lite`) to extract structured clinical data (demographics, vitals, doctor info, tests, and medicine lists) from scanned report files or sheets.
  - Key files/modules: `inventory/ocr_service.py`
- **Frontend Client (React)**:
  - Responsibility: Provides a sleek, modern UI for medical camp staff to manage inventory, register patients, record vitals, upload documents for OCR, generate camp reports, and trigger automated patient reminders.
  - Key files/modules: `frontend/src/App.jsx`, `frontend/src/pages/`
- **Database (SQLite)**:
  - Responsibility: Acts as the primary persistent datastore for patient records, camp dates, doctor assignments, medicine stock, and voice call schedules.
  - Key files/modules: `db.sqlite3`

## Connections

- **Frontend** → **Django Backend (REST APIs)**:
  - Method: HTTP REST API calls (JSON).
  - Notes: Performs patient registration, logs vitals, uploads report images for OCR processing, and triggers reminder broadcasts.
- **Django Backend** → **Exotel API**:
  - Method: HTTP POST requests (JSON).
  - Notes: Outbound calls are initiated via Exotel's Calls API passing the target phone number and the Exotel Flow URL.
- **Exotel** → **Django Backend (Callbacks & Play XML)**:
  - Method: HTTP GET requests.
  - Notes: Exotel accesses `/api/voicebot/exotel-callback/` to dynamically retrieve the raw URL of the generated WAV audio reminder, which it then downloads and plays to the patient.
- **Django Backend** → **Sarvam AI APIs**:
  - Method: HTTP POST.
  - Notes: Sends phonetic Telugu text to Sarvam's text-to-speech engine and receives back base64 encoded audio.
- **Django Backend** → **Google Gemini API**:
  - Method: HTTP API request (via the `google-generativeai` SDK).
  - Notes: Sends scanned document images alongside a detailed processing prompt to convert unstructured sheets into structured JSON records.

## Folder Structure

```
./
├── medicalcamp_inventory/     # Django project settings and root urls
│   ├── settings.py            # Global settings (CORS, installed apps, database configuration)
│   ├── urls.py                # Main url dispatcher
│   ├── asgi.py                # ASGI application entrypoint
│   └── wsgi.py                # WSGI application entrypoint
├── inventory/                 # Main inventory and clinical database application
│   ├── models.py              # Patient, Vitals, Medicine, Camp, and Stock models
│   ├── views.py               # REST API views for inventory and clinical operations
│   ├── urls.py                # Dispatcher for inventory endpoints
│   └── ocr_service.py         # Google Gemini OCR extraction logic for report sheets
├── voicebot/                  # Outbound reminder and voice callback app
│   ├── services/
│   │   ├── reminder_service.py# Orchestrates text phrasing, date/acronym translation
│   │   └── tts_service.py     # Sarvam TTS API integration and audio resampler (8kHz WAV)
│   ├── models.py              # CallSchedule and CampVoiceReminder models
│   ├── views.py               # Trigger view, Exotel callback, Play ExoML, and Status views
│   └── urls.py                # Routing for telephony callbacks
├── frontend/                  # React Frontend client
│   ├── src/                   # React components and page modules
│   ├── package.json           # Node configuration and dependencies
│   └── vite.config.js         # Vite bundler config
├── scratch/                   # DB seed scripts and testing files
├── asef/                      # Project state and documentation
│   ├── Project.md
│   ├── Architecture.md
│   └── FlowDiagram.md
├── venv/                      # Python virtual environment
└── .env                       # Local environment configurations (API keys, Exotel credentials)
```

## Code Style Guidelines

- **Naming**:
  - Python: `snake_case` for variables/functions, `CamelCase` for classes.
  - JavaScript/React: `camelCase` for variables/functions, `PascalCase` for React components.
- **External API Safety**: Wrap requests to external services (Sarvam AI, Exotel, Google Gemini) in robust try/except blocks to ensure network or provider downtime does not crash the Django server.
- **Static Assets Management**: Ensure temporary resampled audio files or generated reminder WAVs are correctly managed and served through Django's static/media file handlers or public URL redirects.
