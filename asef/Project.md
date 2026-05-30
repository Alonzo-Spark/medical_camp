# Project.md

## Metadata

- **Project Name**: SWASTH - Medical Camp Management System with Telugu Voice Reminders & OCR
- **Version**: 1.0.0
- **Repository**: https://github.com/Alonzo-Spark/medical_camp.git
- **Created**: 06/05/2026
- **Primary Maintainer**: Neeraj,Pavithra,Sathwika,Suman

## Goals

1. **Medical Camp Management**: Manage medical camps, patient registrations, patient profiles, vitals tracking, and doctor consultations.
2. **Inventory Tracking**: Track and manage medicine inventory, including camp-wise entry, category classification, formulations, and unit cost adjustments.
3. **Automated Reminders**: Automatically broadcast automated voice call reminders in Telugu to patients about upcoming medical camps.
4. **Phonetic Conversion**: Format dates, acronyms (e.g. KPHB, CCC), and venues into natural, phonetically accurate Telugu text before generating audio.
5. **Speech Synthesis**: Utilize Sarvam AI's Text-to-Speech API (`bulbul:v3`) to synthesize clear, high-quality Telugu reminders.
6. **Smart Medical OCR**: Provide a Google Gemini-based (`gemini-3.1-flash-lite`) OCR engine to extract and digitize details from medical reports and patient lists (vitals, diagnoses, laboratory tests, and medicines lists).

## Tech Stack

- **Language**: Python (Backend), JavaScript/React (Frontend)
- **Backend Framework**: Django + Django REST Framework (DRF)
- **Frontend Framework**: React (Vite, TailwindCSS-style layout)
- **Database**: SQLite (via Django ORM)
- **OCR Engine**: Google Generative AI (`gemini-3.1-flash-lite` model)
- **Telephony & Streaming**: Exotel Telephony integration using Flow URL redirecting to custom ExoML and Text endpoints.
- **Speech Processing**: Sarvam AI Text-to-Speech API (`bulbul:v3` model) for Telugu audio generation.
- **Audio Conversion**: Python's native `wave` and `audioop` libraries (for resampling Sarvam 22050Hz output down to Exotel's required 8000Hz mono 16-bit WAV format on-the-fly).

## Users & Personas

- **Persona**: Medical Camp Organizers, Doctors, Registration Staff, and Patients.
  - **Registration Staff**: Log vitals, register new/old patients, scan paper records for OCR ingestion, and manage medicine inventories.
  - **Doctors**: Consult patients, view vitals, log treatment logs, and prescribe medicines.
  - **Patients**: Receive automated Telugu voice reminder calls informing them of camp dates and locations.

## Rules & Guardrails

- Keep a `.env` file for credentials (Exotel SID/Token, Sarvam API Key, Gemini API Key, etc.) and NEVER commit it to git.
- Outbound voice reminders played to Exotel MUST be resampled to 8kHz mono 16-bit WAV format to ensure telephony compatibility.
- Always use the `venv` virtual environment for python dependencies.
- Ensure CORS configurations are correctly set between frontend and backend.
