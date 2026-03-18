# BridgEd

## **Competency-Based Industrial Placement & Recruitment Filtration System**

## Project Description

BridgEd is a **web-based industrial placement platform** designed to bridge the gap between Nigerian university graduates and employers through **competency-based matching**. The system addresses the critical unemployment crisis among Nigerian youth by providing intelligent job-student matching based on verified skills rather than manual CV screening.

---

**Quick Links**
**Demo video (5 min)** [Watch demo](https://drive.google.com/file/d/1DHFSvEh2ZfNzijYhmcx-FyfY-xjn5z9H/view?usp=sharing) — covers core components (CV upload, matching, shortlist, messaging).

**Live app:** [Deployed version](https://www.bridged.page/)

**Repo:** [GitHub](https://github.com/Skomaiya/BridgEd.git)

---

## What it does

- **Students:** Upload CV (PDF/DOCX); get parsed skills and job matches; accept/decline matches; message employers.
- **Employers:** Post jobs with skill requirements; view pre-qualified shortlists; download CVs; employ or dismiss candidates.
- **Admins:** User management, company verification, platform analytics.

---

## Install and run (step by step)
### Prerequisites

Ensure the following software is installed:
- **Python 3.10+** - [Download](https://www.python.org/downloads/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **PostgreSQL 14+** - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/)

### 1. Clone the repo

```bash
git clone https://github.com/Skomaiya/BridgEd.git
cd BridgEd
```

### 2. Backend Setup (Django)

**Create Virtual Environment:**

```bash
cd bridged-backend
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
```

```bash
pip install -r requirements.txt
cp .env.example .env
# Edit .env: set SECRET_KEY, DB credentials, and LLM/Supabase/Paystack keys.
```

**Database:**

```bash
# In PostgreSQL: create DB and user, then from bridged-backend:
python manage.py migrate

# Create superuser (admin)
python manage.py createsuperuser
```

**Run backend:**

```bash
python manage.py runserver
# API: http://127.0.0.1:8000
```

### 3. Frontend (React + Vite)

```bash
# From repo root
cd bridged-frontend
npm install
npm run dev
# App: http://localhost:5173
```

### 4. Use the app

- Open **http://localhost:5173**: register as Student or Employer (skip long sign-up in demo; focus on CV upload, matches, shortlist, messaging).
- Admin: **http://127.0.0.1:8000/admin** (use superuser account from step 2).

---

## Related files and project structure

```
Resume Parsing Implementations/
├── README.md
├── bridged-frontend/           # React 19 + Vite + Tailwind
│   ├── src/
│   │   ├── components/         # LandingPage, Auth, Dashboard, StudentParser, EmployerMatchesPage, …
│   │   ├── api/api.js         # API client
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── bridged-backend/            # Django REST API
│   ├── api/
│   │   ├── views.py           # Endpoints (auth, jobs, matches, profiles, notifications, …)
│   │   ├── serializers.py
│   │   ├── models.py
│   │   ├── urls.py
│   │   └── permissions.py
│   ├── config/
│   │   ├── settings.py
│   │   └── urls.py
│   ├── services/
│   │   ├── resume_pipeline.py # CV parsing orchestration
│   │   ├── llm_parser.py      # LLM-based resume structuring
│   │   ├── matching_engine.py # Job–student matching
│   │   └── text_extractor.py  # PDF/DOCX extraction
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example           # Env template
│
└── docs/                       # Documentation and diagrams (add as needed)
    └── diagrams/              # Images (e.g. system_architecture.png, use_case_diagram.png, class_diagram.png)
```

**Key files:**

| Area | Files |
|------|--------|
| API & auth | `bridged-backend/api/views.py`, `urls.py`, `serializers.py`, `models.py` |
| CV parsing | `bridged-backend/services/resume_pipeline.py`, `llm_parser.py`, `text_extractor.py` |
| Matching | `bridged-backend/services/matching_engine.py` |
| Frontend UI | `bridged-frontend/src/App.jsx`, `components/*.jsx`, `api/api.js` |

---

## Tech stack

- **Frontend:** React 19, Vite, TailwindCSS, Axios, PWA (vite-plugin-pwa).
- **Backend:** Django 4.2+, Django REST Framework, JWT (Simple JWT), PostgreSQL.
- **Parsing:** pdfplumber, python-docx, LLM (Hugging Face) for structured CV data.
- **Deployment:** Backend (Render), Frontend (Render), DB (Render PostgreSQL).

---

## Documentation and architecture

For a deeper view of the system design and screenshots:

| Resource | Description |
|----------|-------------|
| [docs/](docs/) | Documentation folder (diagrams). |
| [System architecture](docs/diagrams/system_architecture.png) | BridgEd system architecture diagram. |
| [Class diagram](docs/diagrams/class_diagram_final.png) | Class diagram showcasing system class composition. |
| [Use case diagram](docs/diagrams/use_case_final.png) | Use case diagram showcasing user functions. |

---

## Deployment

- **Environments:** Development (local), Production (cloud).
- **Steps:**

(1) Set production `DEBUG=False`, `ALLOWED_HOSTS`, and DB/Supabase/Paystack in `.env`.

(2) Backend: build and run with gunicorn (e.g. on Render).

(3) Frontend: `npm run build` and deploy the `dist/` output (e.g. Render).

(4) Run migrations and create superuser on the production DB.
- **Verification:** Test login, CV upload, matching, and shortlist flows on the deployed URL.

---

## Testing

- Backend tests: from `bridged-backend`, run `pytest` or `python manage.py test`.
- Functionality has been checked with different data (e.g. multiple CVs, job variants, match thresholds) and on different environments (local Windows and deployed application) as per testing requirements.
