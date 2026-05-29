# Architecture.md

## Components

- **Unified ASGI Application**:
  - **FastAPI**: Responsibility: Handles high-concurrency WebSocket connections for the Exotel bidirectional audio stream. Routes Exotel audio packets, interfaces with Sarvam AI ASR/TTS WebSockets, and controls voicebot conversation flows.
  - **Django**: Responsibility: Manages all standard HTTP REST APIs, camp registrations, inventory management, patient records, auth, and Admin dashboards via the Django ORM.
  - Key files/modules: `asgi_unified.py` (entry point), `medicalcamp_inventory/` (Django config), `inventory/voicebot_inbound.py` (voicebot stream logic).
- **Frontend Client (React)**:
  - Responsibility: Provides a sleek, modern UI for medical camp staff to manage inventory, register patients, record vitals, generate camp reports, and trigger automated patient reminder broadcasts.
  - Key files/modules: `frontend/src/App.jsx`, `frontend/src/pages/` (MedicineEntry, CampReport, PatientProfile, etc.)
- **Database (SQLite)**:
  - Responsibility: Acts as the primary persistent datastore for patient records, camp dates, doctor assignments, and medicine stock.
  - Key files/modules: `db.sqlite3`, `inventory/models.py`
- **Exotel Telephony Integration**:
  - Responsibility: Triggers outbound calls using Exotel's API with a Stream URL, sending raw 8kHz PCM bidirectional audio over WebSockets.
  - Key files/modules: `inventory/views.py` (broadcast api), `scratch/test_exotel_call.py` (test script).
- **Sarvam AI Integration**:
  - Responsibility: Real-time speech processing using Sarvam's Speech-to-Text (ASR) and Text-to-Speech (TTS) models.
  - Key files/modules: `inventory/voicebot_inbound.py` (ASR/TTS connection loops).
- **Background Retry Task**:
  - Responsibility: Polls the database to find failed calls and automatically retries dialing patients up to 3 times, spaced 15 minutes apart.
  - Key files/modules: `inventory/exotel_retry_task.py` (runs inside the FastAPI lifespan).

## Connections

- **Frontend** → **Unified ASGI (Django REST)**:
  - Method: HTTP REST API calls (JSON).
  - Notes: Performs patient registration, logs vitals, fetches inventory, and triggers reminder broadcasts.
- **Exotel WebSocket** → **Unified ASGI (FastAPI)**:
  - Method: Bidirectional WebSocket connection.
  - Notes: Stream of 8kHz 16-bit mono PCM audio packets (every 20ms).
- **FastAPI** → **Sarvam AI APIs**:
  - Method: WebSockets.
  - Notes: Sends 16kHz PCM audio to Sarvam ASR; retrieves real-time Telugu audio chunks from Sarvam TTS.
- **FastAPI/Django** → **Database**:
  - Method: Django ORM (sync/async database wrappers).
  - Notes: Updates call status, increments retry counts, and retrieves patient phone numbers.

## Folder Structure

```
./
├── asgi_unified.py            # Main entry point mounting Django inside FastAPI
├── medicalcamp_inventory/     # Django project settings and root urls
├── inventory/                 # Django main application
│   ├── voicebot_inbound.py    # Voicebot Settings, ASR, TTS, and WebSocket handlers
│   ├── exotel_retry_task.py   # Background retry task loop
│   ├── models.py              # Patient, Camp, Medicine models
│   ├── views.py               # Inventory APIs, call triggers
│   └── urls.py                # Django routes
├── frontend/                  # React Frontend client
│   ├── src/                   # React components and page modules
│   ├── package.json           # NPM dependencies
│   └── vite.config.js         # Vite bundler config
├── scratch/                   # Test scripts for TTS, ASR, WebSocket and Exotel calls
│   ├── test_exotel_call.py
│   ├── simulate_call.py
│   └── test_tts.py
├── asef/                      # Project state and documentation
│   ├── Project.md
│   ├── Architecture.md
│   ├── FlowDiagram.md
│   └── ...
├── venv/                      # Python virtual environment
└── .env                       # Environment variables (credentials)
```

## Code Style Guidelines

- **Naming**:
  - Python: `snake_case` for variables/functions, `CamelCase` for classes.
  - JavaScript/React: `camelCase` for variables/functions, `PascalCase` for React components.
- **WebSocket Safety**: Ensure WebSockets handle `ConnectionClosedOK` and `ConnectionClosedError` exceptions gracefully to prevent server crashes.
- **Database Operations**: Perform all async Django ORM operations using `sync_to_async` inside the FastAPI threadpool.
