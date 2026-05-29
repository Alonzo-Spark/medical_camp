# Project.md

## Metadata

- **Project Name**: Medical Camp Management System with Telugu Voicebot
- **Version**: 1.0.0
- **Repository**: https://github.com/Alonzo-Spark/medical_camp.git
- **Created**: 02/04/2026
- **Primary Maintainer**: Pavithra Philomena

## Goals

1. Manage medical camps, registrations, patient profiles, vitals tracking, and doctor consultations.
2. Track and manage medicine inventory, including camp-wise entry, category classification, formulations, and unit cost adjustments.
3. Automatically broadcast voice call reminders to patients about upcoming medical camps.
4. Provide a bidirectional Telugu AI voicebot via Exotel streaming:
   - Play a pre-recorded Telugu greeting or dynamic Telugu TTS immediately when the call connects.
   - Listen to patient speech, transcribe using Sarvam ASR, and respond in Telugu.
5. Implement a robust background task that automatically retries failed calls up to 3 times with a 15-minute delay.

## Tech Stack

- **Language**: Python (Backend), JavaScript/React (Frontend)
- **Backend Framework**: FastAPI + Django unified as a single ASGI application (FastAPI handles high-concurrency WebSockets for Exotel; Django handles traditional HTTP/Admin APIs & ORM)
- **Frontend Framework**: React (Vite, TailwindCSS-style layout)
- **Database**: SQLite (via Django ORM)
- **Telephony & Streaming**: Exotel Stream URL (bidirectional audio streaming via WebSockets, 8kHz PCM 16-bit mono)
- **Speech Processing**: Sarvam AI (ASR WebSocket at 16kHz for speech-to-text; TTS Streaming using bulbul:v2)
- **Audio Conversion**: ffmpeg (for resampling audio on-the-fly between 8kHz Exotel streams and 16kHz Sarvam streams / raw WAV)

## Users & Personas

- **Persona**: Medical Camp Organizers, Doctors, Registration Staff, and Patients.
  - **Registration Staff**: Log vitals, register new/old patients, manage medicine inventories.
  - **Doctors**: Consult patients, view vitals, log treatment logs, and prescribe medicines.
  - **Patients**: Receive automated Telugu voice reminder calls and interact with the AI voicebot to confirm attendance or report symptoms.

## Rules & Guardrails

- Keep a `.env` file for credentials (Exotel SID/Token, Sarvam API Key, etc.) and NEVER commit it to git.
- The voicebot stream MUST handle 8kHz 16-bit mono audio for Exotel and 16kHz for Sarvam ASR.
- Always use `venv` virtual environment for python dependencies.
- Ensure CORS and proxy configurations are correctly set between frontend and backend.
