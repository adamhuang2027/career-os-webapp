from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from pathlib import Path
from datetime import datetime

app = Flask(__name__)
CORS(app)

BASE = Path(__file__).resolve().parent
DB_PATH = BASE / 'careeros.db'


def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    c = conn()
    c.executescript('''
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      title TEXT NOT NULL,
      goal TEXT,
      status TEXT,
      priority TEXT,
      milestone TEXT,
      blocker TEXT,
      next_action TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      project_id INTEGER,
      raw_notes TEXT,
      summary TEXT,
      risk TEXT,
      decision_needed TEXT,
      next_step TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      title TEXT,
      phenomenon TEXT,
      hypothesis TEXT,
      evidence TEXT,
      recommendation TEXT,
      result TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      name TEXT,
      role TEXT,
      team TEXT,
      relationship_level TEXT,
      current_topics TEXT,
      value_exchange TEXT,
      next_followup_date TEXT
    );

    CREATE TABLE IF NOT EXISTS reflections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      date TEXT,
      wins TEXT,
      blockers TEXT,
      lessons TEXT,
      tomorrow_focus TEXT
    );
    ''')
    c.commit()
    c.close()


def rows_to_dict(rows):
    return [dict(r) for r in rows]


@app.get('/api/health')
def health():
    return jsonify({'data': {'ok': True}})


@app.get('/api/projects')
def get_projects():
    c = conn()
    rows = c.execute('SELECT * FROM projects ORDER BY id DESC').fetchall()
    c.close()
    return jsonify({'data': rows_to_dict(rows)})


@app.post('/api/projects')
def create_project():
    b = request.json or {}
    now = datetime.utcnow().isoformat()
    c = conn()
    c.execute('''
      INSERT INTO projects(title, goal, status, priority, milestone, blocker, next_action, created_at, updated_at)
      VALUES(?,?,?,?,?,?,?,?,?)
    ''', (
      b.get('title'), b.get('goal'), b.get('status', 'planned'), b.get('priority', 'medium'),
      b.get('milestone'), b.get('blocker'), b.get('next_action'), now, now
    ))
    c.commit()
    c.close()
    return jsonify({'data': {'ok': True}})


@app.get('/api/insights')
def get_insights():
    c = conn()
    rows = c.execute('SELECT * FROM insights ORDER BY id DESC').fetchall()
    c.close()
    return jsonify({'data': rows_to_dict(rows)})


@app.post('/api/insights')
def create_insight():
    b = request.json or {}
    c = conn()
    c.execute('''
      INSERT INTO insights(title, phenomenon, hypothesis, evidence, recommendation, result, created_at)
      VALUES(?,?,?,?,?,?,?)
    ''', (
      b.get('title'), b.get('phenomenon'), b.get('hypothesis'), b.get('evidence'), b.get('recommendation'), b.get('result'), datetime.utcnow().isoformat()
    ))
    c.commit()
    c.close()
    return jsonify({'data': {'ok': True}})


@app.get('/api/people')
def get_people():
    c = conn()
    rows = c.execute('SELECT * FROM people ORDER BY id DESC').fetchall()
    c.close()
    return jsonify({'data': rows_to_dict(rows)})


@app.post('/api/people')
def create_people():
    b = request.json or {}
    c = conn()
    c.execute('''
      INSERT INTO people(name, role, team, relationship_level, current_topics, value_exchange, next_followup_date)
      VALUES(?,?,?,?,?,?,?)
    ''', (
      b.get('name'), b.get('role'), b.get('team'), b.get('relationship_level'),
      b.get('current_topics'), b.get('value_exchange'), b.get('next_followup_date')
    ))
    c.commit()
    c.close()
    return jsonify({'data': {'ok': True}})


@app.post('/api/ai/generate-update')
def ai_generate_update():
    b = request.json or {}
    notes = (b.get('raw_notes') or '').strip()
    style = b.get('style', 'concise')

    if style == 'risk':
        output = f"Risk Alert Update\n- Current notes: {notes}\n- Key risk: clarify blocker and owner\n- Decision needed: manager escalation on dependencies\n- Next step: resolve blocker by EOD with explicit owner."
    elif style == 'result':
        output = f"Result-Oriented Update\n- Outcomes: {notes}\n- Business impact: improved execution visibility and delivery confidence\n- Next: convert open risks into dated actions."
    else:
        output = f"Concise Update\n- Completed: {notes}\n- In progress: close blockers\n- Risks: pending dependency alignment\n- Ask: decision support on priority trade-offs."

    return jsonify({'data': {'output': output}})


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5001, debug=True)
