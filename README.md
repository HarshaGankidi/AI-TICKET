# AI-Powered Ticket System

This project is a professional-grade automated ticket creation and categorization system.

## Architecture

The project is split into two distinct services:
1.  **Backend (`backend/`)**: FastAPI application handling ML inference and Database operations.
2.  **Frontend (`frontend/`)**: Pure HTML/CSS/JS Single Page Application.

## Prerequisites

-   Python 3.10+
-   PostgreSQL (Supabase connected)
-   Modern Web Browser

## Setup & Installation

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
```

**Training the Model:**
Before running the API, ensure models are trained on your dataset:
```bash
python app/ml/train.py
```

**Running the API:**
```bash
python app/main.py
# API will run at http://localhost:8000
```

### 2. Frontend

Simply open `frontend/index.html` in your web browser. 

For a better experience (to avoid file protocol restrictions), you can serve it using Python's http server:

```bash
cd frontend
python -m http.server 5500
# Open http://localhost:5500 in your browser
```

## Features

-   **High-Accuracy ML**: Uses TF-IDF + SGDClassifier (SVM) optimized via GridSearchCV.
-   **Database Integration**: Stores tickets in Supabase (PostgreSQL).
-   **Professional UI**: Custom CSS Dashboard Design.
-   **Real-time AI**: Instant analysis of support requests.
