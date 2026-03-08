# CareerOS / WorkOS (MVP)

A practical web app to help ICs train 4 core capabilities daily:
1. Execution
2. Upward communication
3. Business insight
4. Resource mapping

## Stack
- Frontend: React + Ant Design + React Router + Axios + Vite
- Backend: Flask + SQLite
- AI (MVP mock): `/api/ai/generate-update` template endpoint

## MVP Pages
1. Today Dashboard
2. Projects
3. Manager Update
4. Insights
5. People / Resource Map

## Data Model (v1)
- users
- projects
- updates
- insights
- people
- reflections

## Run Locally

### 1) Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```
Backend runs on: `http://127.0.0.1:5001`

### 2) Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on: `http://127.0.0.1:5174`

## API (MVP)
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/insights`
- `POST /api/insights`
- `GET /api/people`
- `POST /api/people`
- `POST /api/ai/generate-update`

## Next Steps
- Add auth
- Connect real OpenAI API
- Add Manager Update history table writes
- Add reflections and capability scoring
