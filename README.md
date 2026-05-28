# 🏥 SWASTH — Medical Camp Management System

> **"Health is Happiness"**

SWASTH is a full-stack web application built for managing free medical camps. It handles everything from registering patients and recording their vitals to managing medicine inventory and issuing prescriptions — all from one unified dashboard.

---

## 📖 Table of Contents

- [What Does This Project Do?](#-what-does-this-project-do)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [How to Set Up & Run](#-how-to-set-up--run)
- [User Roles](#-user-roles)
- [Application Pages (Frontend)](#-application-pages-frontend)
- [Backend API Endpoints](#-backend-api-endpoints)
- [Database Models](#-database-models)
- [Mobile Scanner (OCR Feature)](#-mobile-scanner-ocr-feature)
- [Screenshots Flow](#-screenshots-flow)

---

## 🎯 What Does This Project Do?

When a free medical camp is organized, the staff needs to:

1. **Register the camp** with a venue, date, and camp number.
2. **Register patients** who come to the camp with their personal details.
3. **Record patient vitals** such as blood pressure, sugar levels, weight, height, etc.
4. **Assign a doctor** and note down the diagnosis.
5. **Prescribe medicines** and issue them from available stock.
6. **Recommend lab tests** like blood tests, urine tests, etc.
7. **Track medicine inventory** — how much stock is available, how much was sent to each camp, and how much was used.
8. **View patient history** — when the same patient visits across multiple camps, their past records and health trends are available.

**SWASTH automates all of this** in a modern, easy-to-use web interface that runs on a laptop and can even accept scanned handwritten reports from a mobile phone.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🏕️ **Camp Registration** | Create and manage multiple medical camp sessions with venue and date |
| 👤 **Patient Registration** | Enroll new patients or re-register returning patients with auto-fill |
| 🩺 **Vitals Recording** | Record weight, height, BP, pulse, blood sugar, haemoglobin, and more |
| 💊 **Medicine Prescription** | Prescribe medicines with dosage (morning/afternoon/night), auto-calculate quantity |
| 📦 **Inventory Management** | Track global medicine stock and allocate specific quantities to each camp |
| 🧪 **Lab Test Tracking** | Recommend lab tests and track whether reports have been issued |
| 👨‍⚕️ **Doctor Management** | Register doctors, assign them to patients, view per-doctor analytics |
| 📊 **Patient Analytics** | View BP / Sugar / Haemoglobin trend charts over multiple camp visits |
| 📱 **Mobile Scanner (OCR)** | Scan handwritten prescriptions using a phone camera and auto-fill the form |
| 🔐 **Role-Based Access** | Different menus for Main Admin, Registration Staff, and Vitals Staff |
| 📥 **CSV Export** | Download inventory and camp stock reports as CSV files |

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Python 3** | Programming language |
| **Django 3.2** | Web framework for the backend server |
| **Django REST Framework** | For building the JSON API |
| **SQLite** | Lightweight database (file-based, no setup needed) |
| **GLM OCR** | Extracts text from scanned handwritten reports |

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | JavaScript library for building the user interface |
| **Vite** | Fast development server and build tool |
| **React Router** | Client-side page navigation |
| **Axios** | HTTP client for API calls to the backend |
| **Tailwind CSS** | Utility-first CSS framework for styling |
| **Lucide React** | Icon library for clean, modern icons |
| **Chart.js** | Renders line charts for patient vital trends |
| **qrcode.react** | Generates QR codes for the mobile scanner feature |

---

## 📂 Project Structure

```
medical_camp/
│
├── manage.py                    # Django management script
├── db.sqlite3                   # SQLite database file
├── medlist.csv                  # CSV file used to seed the medicine database
│
├── medicalcamp_inventory/       # Django project settings
│   ├── settings.py              # Main configuration (database, apps, CORS, etc.)
│   ├── urls.py                  # Root URL configuration
│   ├── wsgi.py                  # WSGI entry point
│   └── asgi.py                  # ASGI entry point
│
├── inventory/                   # Django app — all backend logic lives here
│   ├── models.py                # Database table definitions (Patient, Medicine, Vitals, etc.)
│   ├── views.py                 # All API logic (register patient, save vitals, issue medicine, etc.)
│   ├── urls.py                  # API endpoint URL mapping
│   ├── admin.py                 # Django admin panel configuration
│   ├── serializers.py           # Data serialization for REST API responses
│   ├── signals.py               # Auto-creates user profiles on new user creation
│   ├── ocr_service.py           # Tesseract OCR processing for scanned reports
│   └── forms.py                 # Legacy Django form definitions
│
├── media/                       # Uploaded files (scanned report images)
│
├── frontend/                    # React application
│   ├── src/
│   │   ├── main.jsx             # React entry point
│   │   ├── App.jsx              # Route definitions and lazy-loading
│   │   ├── App.css              # Global custom styles
│   │   ├── index.css            # Base Tailwind CSS imports
│   │   │
│   │   ├── components/
│   │   │   └── Layout.jsx       # Sidebar navigation + header (shared across all pages)
│   │   │
│   │   ├── pages/
│   │   │   ├── AdminLogin.jsx           # Login page
│   │   │   ├── Dashboard.jsx            # Main navigation hub
│   │   │   ├── CampRegistration.jsx     # Register a new medical camp
│   │   │   ├── PatientRegistration.jsx  # Register a new patient
│   │   │   ├── OldPatientRegistration.jsx # Re-register a returning patient
│   │   │   ├── Vitals.jsx               # Record patient vitals + prescribe medicine
│   │   │   ├── PatientProfile.jsx       # Search & view patient history with charts
│   │   │   ├── Inventory.jsx            # View & edit global medicine stock
│   │   │   ├── MedicineEntry.jsx        # Add stock, allocate to camps, edit details
│   │   │   ├── CampPatients.jsx         # View all patients in a specific camp
│   │   │   ├── DoctorsList.jsx          # Manage doctors & view analytics
│   │   │   └── MobileUpload.jsx         # Mobile camera page for scanning reports
│   │   │
│   │   └── assets/
│   │       ├── ccc-logo.png             # Organization logo
│   │       ├── medical_camp_bg.png      # Login page background image
│   │       └── hero.png                 # Hero image asset
│   │
│   ├── package.json             # Node.js dependencies
│   └── vite.config.js           # Vite build configuration
│
└── venv/                        # Python virtual environment (not committed to git)
```

---

## 🚀 How to Set Up & Run

### Prerequisites

Make sure you have these installed on your computer:

- **Python 3.8+** → [Download Python](https://www.python.org/downloads/)
- **Node.js 16+** → [Download Node.js](https://nodejs.org/)
- **pip** (comes with Python)
- **npm** (comes with Node.js)

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd medical_camp
```

### Step 2: Set Up the Backend (Django)

```bash
# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate        # Linux / Mac
# venv\Scripts\activate         # Windows

# Install Python dependencies
pip install django djangorestframework django-cors-headers django-bootstrap5 Pillow

# (Optional) Install OCR dependencies for the mobile scanner feature
pip install opencv-python opencv-contrib-python python-dotenv


# Run database migrations
python3 manage.py makemigrations
python3 manage.py migrate

# Create an admin user (follow the prompts)
python3 manage.py createsuperuser

# Start the backend server
python3 manage.py runserver 0.0.0.0:8000
```

The backend will be running at: **http://localhost:8000**

### Step 3: Set Up the Frontend (React)

Open a **new terminal window** and run:

```bash
cd frontend

# Install Node.js dependencies
npm install

# Start the development server
npm install vite
npm run dev
```

The frontend will be running at: **http://localhost:5173**

### Step 4: Open the Application

1. Open your browser and go to **http://localhost:5173**
2. You will see the **SWASTH Login Page**
3. Log in with the admin credentials you created in Step 2
4. You're in! Start registering camps, patients, and recording vitals.

---

## 🔐 User Roles

The system supports three types of users. Each role sees a different set of menu items in the sidebar.

| Role | What They Can Do |
|---|---|
| **Main Admin** | Full access — can register camps, register patients, log vitals, manage inventory, manage doctors, view all reports |
| **Registration Staff** | Can register camps, register patients (new & old), and view camp patient lists |
| **Vitals Staff** | Can log patient vitals, prescribe medicines, manage doctors, and view camp patient lists |

Roles are assigned in the Django Admin panel at **http://localhost:8000/admin** under the **User Profiles** section.

---

## 📄 Application Pages (Frontend)

### 1. 🔑 Admin Login (`AdminLogin.jsx`)
The entry point of the application. Admins enter their username and password. On success, they are redirected to the Dashboard. The login page features the organization logo (CCC) and a professional medical-camp-themed background.

### 2. 🏠 Dashboard (`Dashboard.jsx`)
The main navigation hub after login. It shows three large, interactive cards:
- **Existing Patient** → Search and view a patient's complete profile and history.
- **Register New Patient** → Open the new patient enrollment form.
- **Old Patient Registration** → Re-register a returning patient with auto-filled data.

### 3. 🏕️ Camp Registration (`CampRegistration.jsx`)
A form to register a new medical camp session. Staff enters:
- **Camp Venue / Location** (e.g., "Community Center")
- **Camp Number** (a unique identifier)
- **Camp Date** (DD/MM/YYYY format with a calendar picker)

### 4. 📝 Patient Registration (`PatientRegistration.jsx`)
A comprehensive form to enroll a **brand-new** patient. Fields include:
- Patient ID, Name, Age, Gender
- Date of Registration, Camp Session
- Contact Number, Address

It auto-checks if the Patient ID already exists to avoid duplicates. The registration date and camp session are auto-filled with the latest camp by default.

### 5. 🔄 Old Patient Registration (`OldPatientRegistration.jsx`)
For **returning patients** who have visited before. Staff enters the Patient ID, clicks "Find Patient," and the system retrieves their existing details from the database. The staff can verify, update if needed, and re-register them for the current camp session.

### 6. 🩺 Patient Vitals (`Vitals.jsx`)
The most feature-rich page in the application. It is used by doctors/nurses during the consultation:
- **Camp Selection** — Choose which camp session this record belongs to.
- **Patient Info** — Patient ID, Date, Time, Entry Number.
- **Physical Vitals** — Weight, Height, Blood Pressure, Pulse.
- **Lab Values** — Blood Sugar (RBS), Haemoglobin.
- **Doctor Info** — Doctor ID (auto-fills the name), Diagnosis text.
- **Lab Tests** — A grid of checkboxes to recommend specific tests.
- **Medicine Prescription** — A dynamic table where you can:
  - Enter the medicine ID (auto-fills name and formulation from inventory)
  - Set dosage: Morning / Afternoon / Night tablets and number of Days
  - Quantity is **auto-calculated** as `Days × (Morning + Afternoon + Night)`
  - Shows a warning if the quantity exceeds available camp stock
- **Mobile Scanner** — A "Scan Patient Report" button that generates a QR code. Scanning this code on a phone opens a camera to photograph a handwritten prescription, which is processed via OCR and auto-fills the form.

### 7. 👤 Patient Profile (`PatientProfile.jsx`)
A comprehensive analytics page for any patient. Enter a Patient ID to see:
- **Identity Card** — Name, Age, Gender, Contact, Address (editable).
- **Trend Charts** — Interactive line charts showing Haemoglobin, Blood Sugar, and Blood Pressure trends across camp visits (powered by Chart.js).
- **Vitals History Table** — All past vitals in a tabular format.
- **Medicine Timeline** — What medicines were issued during each camp visit.

### 8. 📦 Inventory (`Inventory.jsx`)
The central pharmacy stock overview. Shows a table of all medicines with:
- Unique ID (UQID), Medicine Name, Formulation, Classification
- Available Stock (with a visual progress bar)
- Low stock alerts (flashing warning icon when stock < 50)
- **Click-to-edit** stock values inline
- **Download CSV** button for a stock audit report

### 9. ➕ Medicine Entry / Stock Management (`MedicineEntry.jsx`)
A powerful three-tab page for managing pharmacy inventory:

| Tab | What It Does |
|---|---|
| **Total Stock Entry** | Add new medicines to the database or increase/set the global stock of existing ones |
| **Camp Wise Entry** | Select a camp → Allocate medicines from warehouse to that camp → Track Allocated / Used / Available quantities → Return leftover stock to warehouse |
| **Medicine Details** | Edit metadata like Company Name, Cost (₹), and Expiry Date for each medicine |

### 10. 📋 Camp Patient List (`CampPatients.jsx`)
Select a camp from the dropdown to see all patients enrolled in it. Features:
- **Search** by Patient ID or Name.
- **Expandable cards** — Click a patient to see their full details including demographics, issued medicines (with quantities), and lab tests.
- **Checkbox** to mark if test reports have been issued back to the patient.

### 11. 👨‍⚕️ Doctors List (`DoctorsList.jsx`)
Manage medical staff across three tabs:

| Tab | What It Does |
|---|---|
| **Doctors List** | Table of all registered doctors with inline edit and delete functionality |
| **Doctor Analytics** | Select a camp → See which doctors attended, how many patients each saw, what medicines they prescribed, and what tests they ordered |
| **Register Doctor** | A simple form to add a new doctor with Name and Specialization |

### 12. 📱 Mobile Upload (`MobileUpload.jsx`)
A mobile-optimized page (no sidebar or navigation) that opens when a phone scans the QR code from the Vitals page. It allows the user to:
- Capture a photo using the phone's camera
- Preview the image
- Upload it to the server for OCR processing
- The desktop dashboard then auto-fills the form with the extracted data

---

## 🔌 Backend API Endpoints

All API endpoints are prefixed with `/api/` and return JSON responses.

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/login` | Authenticate an admin user |

### Camps
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/camps` | Get list of all registered camps |
| POST | `/api/register_camp` | Register a new medical camp |
| GET | `/api/camp_patients/<camp_id>` | Get all patients for a specific camp |
| GET | `/api/camp_details/<camp_id>` | Get detailed doctor-patient breakdown for a camp |

### Patients
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/register_patient` | Register or update a patient |
| GET | `/api/patient/<patient_id>` | Get full patient profile with vitals, charts, and medicine history |
| GET | `/api/check_patient_id/<pid>` | Check if a patient ID already exists |

### Vitals
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/save_vitals` | Save patient vitals, diagnosis, medicines, and lab tests |

### Medicines & Inventory
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/medicines` | Get all medicines with stock info |
| POST | `/api/add_medicine` | Add a new medicine to the database |
| POST | `/api/update_stock` | Add quantity to existing stock |
| POST | `/api/set_stock` | Set stock to a specific value |
| POST | `/api/update_medicine_details` | Update cost, company, and expiry date |
| POST | `/api/issue` | Issue medicine to a patient |

### Camp Stock Management
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/camp_stock/<camp_id>` | Get stock allocation for a specific camp |
| POST | `/api/allocate_to_camp` | Transfer stock from warehouse to a camp |
| POST | `/api/return_to_warehouse` | Return unused stock from camp to warehouse |

### Doctors
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/doctors` | Get all doctors |
| GET | `/api/doctor/<doctor_id>` | Get a specific doctor's name |
| POST | `/api/add_doctor` | Register a new doctor |
| POST | `/api/update_doctor` | Update doctor details |
| DELETE | `/api/delete_doctor/<doctor_id>` | Delete a doctor |

### Lab Tests
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tests` | Get all available lab tests |
| POST | `/api/update_test_record` | Mark a test report as issued |

### Mobile Scanner / OCR
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/create_scan_session` | Create a new scan session (returns session ID + QR code URL) |
| POST | `/api/upload_scan/<session_id>` | Upload a scanned image from mobile |
| GET | `/api/check_scan_status/<session_id>` | Poll for OCR processing status and results |

### Data Export
| Method | Endpoint | Description |
|---|---|---|
| GET | `/export` | Download full inventory as CSV |
| GET | `/export_camp_stock/<camp_id>` | Download a specific camp's stock as CSV |

---

## 🗃️ Database Models

The application uses **SQLite** with the following tables:

| Model | Purpose |
|---|---|
| `UserProfile` | Stores user roles (Main Admin, Registration Staff, Vitals Staff) |
| `Doctor` | Stores doctor information (name, specialization) |
| `MedicineCategory` | Categories for medicines (e.g., Antibiotic, Painkiller) |
| `Medicine` | Master medicine list with UQID, name, formulation, stock, cost, expiry |
| `MedicalCampVenue` | Camp locations / venues |
| `MedicalCamp` | Individual camp sessions (venue + number + date) |
| `Patient` | Patient demographics (ID, name, age, gender, contact, address) |
| `Vitals` | Simple vitals records (BP, sugar, haemoglobin) per camp visit |
| `PatientVitals` | Detailed vitals (weight, height, pulse, diagnosis, doctor, etc.) |
| `PatientMedicineIssue` | Records of medicines issued to patients with dosage details |
| `MedicalTest` | Master list of available lab tests |
| `TestIssue` | Records of lab tests issued to patients (with report status tracking) |
| `CampWiseStock` | Tracks medicine allocation per camp (allocated, used, remaining) |
| `ScanSession` | Tracks mobile OCR scan sessions (image upload, OCR results) |

---

## 📱 Mobile Scanner (OCR Feature)

This feature lets camp staff skip manual data entry by photographing handwritten prescriptions:

```
┌─────────────────────────────────────────────────┐
│                  WORKFLOW                        │
│                                                  │
│  1. On Desktop: Click "Scan Patient Report"      │
│     → A QR Code appears on screen                │
│                                                  │
│  2. On Phone: Scan the QR Code                   │
│     → Mobile camera page opens                   │
│                                                  │
│  3. On Phone: Take a photo of the prescription   │
│     → Image is uploaded to the server            │
│                                                  │
│  4. On Server: GLM OCR processes the image │
│     → Extracts patient ID, vitals, medicines     │
│                                                  │
│  5. On Desktop: Form auto-fills with OCR data    │
│     → Staff reviews, corrects if needed, saves   │
└─────────────────────────────────────────────────┘
```

> **Note:** Both the phone and the laptop must be connected to the **same Wi-Fi network** for this feature to work.

---

## 📝 License

This project is developed for internal use by the medical camp organizing team.

---

## 🤝 Contributors

- Developed and maintained by the medical camp administration team.

---

