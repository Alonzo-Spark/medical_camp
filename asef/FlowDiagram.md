# Flow Diagram

The diagram below represents the end-to-end architecture and data flow of the SWASTH Medical Camp System, mapping frontend modules, backend API services, SQLite databases, and external API gateways.

```mermaid
flowchart TD
    subgraph Frontend [React App]
        RegisterUI["Patient Registration Page"]
        VitalsUI["Vitals Entry Page"]
        InventoryUI["Medicine Inventory Page"]
        OCR_UI["OCR Report Upload Page"]
        CampaignUI["Voice Campaign Dashboard"]
    end

    subgraph Backend [Django Server & REST APIs]
        Auth["Login / Auth System"]
        CoreAPI["Clinical & Inventory APIs (views.py)"]
        OCRService["Medical OCR Service (ocr_service.py)"]
        ReminderService["Voice Reminder Service (reminder_service.py)"]
        CallbackView["Exotel Callback Handler (views.py)"]
    end

    subgraph DB [SQLite Database]
        Tables[("Patient, Vitals, Medicine, Camp, Stock, CallSchedule Tables")]
    end

    subgraph External [External Services]
        Gemini["Google Gemini Vision API"]
        Sarvam["Sarvam AI TTS API (bulbul:v3)"]
        Exotel["Exotel Telephony Gateway"]
    end

    %% User Authentication
    RegisterUI & VitalsUI & InventoryUI & OCR_UI & CampaignUI --> Auth
    Auth --> CoreAPI

    %% 1. Patient & Vitals Flow
    RegisterUI & VitalsUI -->|"Submit patient & vitals details"| CoreAPI
    CoreAPI -->|"Write/Read records"| Tables

    %% 2. Inventory Management Flow
    InventoryUI -->|"Manage stock, formulations & issues"| CoreAPI
    CoreAPI -->|"Update stock and issue tables"| Tables

    %% 3. OCR Processing Flow
    OCR_UI -->|"Upload scanned report or list sheet"| CoreAPI
    CoreAPI -->|"Request image parsing"| OCRService
    OCRService -->|"Analyze image & extract JSON"| Gemini
    Gemini -->|"Return structured clinical data"| OCRService
    OCRService -->|"Auto-populate patient details, vitals & medicine issues"| Tables

    %% 4. Outbound Voice Reminder Flow
    CampaignUI -->|"Trigger call broadcast"| CoreAPI
    CoreAPI -->|"Format phonetic Telugu & request TTS"| ReminderService
    ReminderService -->|"Generate voice WAV"| Sarvam
    Sarvam -->|"Resample to 8kHz WAV & save"| Tables
    CoreAPI -->|"POST connect call"| Exotel
    Exotel -->|"HTTP GET callback for play URL"| CallbackView
    CallbackView -->|"Serve dynamic WAV URL"| Exotel
    Exotel -->|"Play reminder to patient phone"| Exotel
```
