from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from pathlib import Path
from datetime import datetime, date
from zoneinfo import ZoneInfo
import os
import json
import requests

app = Flask(__name__)
CORS(app)

BASE = Path(__file__).resolve().parent
DB_PATH = BASE / 'careeros.db'
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '').strip()
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
APP_TZ = ZoneInfo('America/Chicago')


def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def now_iso():
    return datetime.now(APP_TZ).isoformat()


def today_ct():
    return datetime.now(APP_TZ).date().isoformat()


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
      parent_id INTEGER,
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
      style TEXT,
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
      date TEXT UNIQUE,
      top3 TEXT,
      blockers TEXT,
      manager_sync TEXT,
      weekly_progress TEXT,
      wins TEXT,
      lessons TEXT,
      tomorrow_focus TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS upward_syncs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      date TEXT,
      language TEXT,
      content TEXT,
      source_top3 TEXT,
      source_blockers TEXT,
      source_weekly_progress TEXT,
      created_at TEXT
    );
    ''')

    # lightweight migration for existing DBs
    cols = [r['name'] for r in c.execute("PRAGMA table_info(updates)").fetchall()]
    if 'style' not in cols:
        c.execute("ALTER TABLE updates ADD COLUMN style TEXT")

    pcols = [r['name'] for r in c.execute("PRAGMA table_info(projects)").fetchall()]
    if 'parent_id' not in pcols:
        c.execute("ALTER TABLE projects ADD COLUMN parent_id INTEGER")

    rcols = [r['name'] for r in c.execute("PRAGMA table_info(reflections)").fetchall()]
    reflection_columns = {
        'top3': 'TEXT',
        'blockers': 'TEXT',
        'manager_sync': 'TEXT',
        'weekly_progress': 'TEXT',
        'wins': 'TEXT',
        'lessons': 'TEXT',
        'tomorrow_focus': 'TEXT',
        'updated_at': 'TEXT',
    }
    for col, typ in reflection_columns.items():
        if col not in rcols:
            c.execute(f"ALTER TABLE reflections ADD COLUMN {col} {typ}")

    c.commit()
    c.close()


def rows_to_dict(rows):
    return [dict(r) for r in rows]


def call_openai_text(system_prompt: str, user_prompt: str) -> str:
    if not OPENAI_API_KEY:
        raise RuntimeError('OPENAI_API_KEY is missing')

    payload = {
        'model': OPENAI_MODEL,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt}
        ],
        'temperature': 0.3
    }

    resp = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {OPENAI_API_KEY}',
            'Content-Type': 'application/json'
        },
        data=json.dumps(payload),
        timeout=40
    )
    resp.raise_for_status()
    return resp.json()['choices'][0]['message']['content'].strip()


@app.get('/api/health')
def health():
    return jsonify({'data': {'ok': True}})


@app.get('/api/projects')
def get_projects():
    c = conn()
    rows = c.execute('''
      SELECT p.*, pp.title AS parent_title
      FROM projects p
      LEFT JOIN projects pp ON p.parent_id = pp.id
      ORDER BY p.id DESC
    ''').fetchall()
    c.close()
    return jsonify({'data': rows_to_dict(rows)})


@app.post('/api/projects')
def create_project():
    b = request.json or {}
    now = now_iso()
    c = conn()
    c.execute('''
      INSERT INTO projects(parent_id, title, goal, status, priority, milestone, blocker, next_action, created_at, updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)
    ''', (
      b.get('parent_id'), b.get('title'), b.get('goal'), b.get('status', 'planned'), b.get('priority', 'medium'),
      b.get('milestone'), b.get('blocker'), b.get('next_action'), now, now
    ))
    c.commit()
    c.close()
    return jsonify({'data': {'ok': True}})


@app.put('/api/projects/<int:project_id>')
def update_project(project_id):
    b = request.json or {}
    c = conn()
    cur = c.execute('''
      UPDATE projects
      SET parent_id=?, title=?, goal=?, status=?, priority=?, milestone=?, blocker=?, next_action=?, updated_at=?
      WHERE id=?
    ''', (
      b.get('parent_id'), b.get('title'), b.get('goal'), b.get('status', 'planned'), b.get('priority', 'medium'),
      b.get('milestone'), b.get('blocker'), b.get('next_action'), now_iso(), project_id
    ))
    c.commit()
    updated = cur.rowcount
    c.close()
    if not updated:
      return jsonify({'error': 'project not found'}), 404
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
      b.get('title'), b.get('phenomenon'), b.get('hypothesis'), b.get('evidence'), b.get('recommendation'), b.get('result'), now_iso()
    ))
    c.commit()
    c.close()
    return jsonify({'data': {'ok': True}})


@app.put('/api/insights/<int:insight_id>')
def update_insight(insight_id):
    b = request.json or {}
    c = conn()
    cur = c.execute('''
      UPDATE insights
      SET title=?, phenomenon=?, hypothesis=?, evidence=?, recommendation=?, result=?
      WHERE id=?
    ''', (
      b.get('title'), b.get('phenomenon'), b.get('hypothesis'), b.get('evidence'), b.get('recommendation'), b.get('result'), insight_id
    ))
    c.commit()
    updated = cur.rowcount
    c.close()
    if not updated:
        return jsonify({'error': 'insight not found'}), 404
    return jsonify({'data': {'ok': True}})


@app.post('/api/ai/generate-insight')
def ai_generate_insight():
    b = request.json or {}
    phenomenon = (b.get('phenomenon') or '').strip()
    language = (b.get('language') or 'en').strip().lower()
    if not phenomenon:
        return jsonify({'error': 'phenomenon is required'}), 400

    lang_rule = {
        'en': 'Output in English.',
        'zh': 'Output in Simplified Chinese.',
        'bilingual': 'Output concise bilingual Chinese + English.',
    }.get(language, 'Output in English.')

    try:
        raw = call_openai_text(
            'You are a senior business/data analyst assistant. Output strict JSON with keys: hypothesis, evidence, recommendation. Keep each field concise and actionable.',
            f"Phenomenon: {phenomenon}\n{lang_rule}\nReturn JSON only."
        )
        data = json.loads(raw)
        output = {
            'hypothesis': data.get('hypothesis', ''),
            'evidence': data.get('evidence', ''),
            'recommendation': data.get('recommendation', ''),
        }
        return jsonify({'data': output, 'meta': {'fallback': False, 'engine': 'openai'}})
    except Exception as e:
        # fallback
        output = {
            'hypothesis': f"Potential root causes for '{phenomenon}': data latency, upstream quality issue, or business process change.",
            'evidence': "Check trend by date, null-rate shift, and segment-level deviation against 4-week baseline.",
            'recommendation': "Run a 3-step validation: reproduce -> isolate source -> propose owner with ETA and monitoring metric."
        }
        return jsonify({'data': output, 'meta': {'fallback': True, 'engine': 'template', 'reason': str(e)}})


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


@app.put('/api/people/<int:person_id>')
def update_people(person_id):
    b = request.json or {}
    c = conn()
    cur = c.execute('''
      UPDATE people
      SET name=?, role=?, team=?, relationship_level=?, current_topics=?, value_exchange=?, next_followup_date=?
      WHERE id=?
    ''', (
      b.get('name'), b.get('role'), b.get('team'), b.get('relationship_level'),
      b.get('current_topics'), b.get('value_exchange'), b.get('next_followup_date'), person_id
    ))
    c.commit()
    updated = cur.rowcount
    c.close()
    if not updated:
        return jsonify({'error': 'person not found'}), 404
    return jsonify({'data': {'ok': True}})


@app.get('/api/reflections/today')
def get_reflection_today():
    d = request.args.get('date') or today_ct()
    c = conn()
    row = c.execute('SELECT * FROM reflections WHERE date = ?', (d,)).fetchone()
    c.close()
    return jsonify({'data': dict(row) if row else None})


@app.post('/api/reflections/today')
def upsert_reflection_today():
    b = request.json or {}
    d = b.get('date') or today_ct()
    payload = (
        b.get('top3', ''), b.get('blockers', ''), b.get('manager_sync', ''), b.get('weekly_progress', ''),
        b.get('wins', ''), b.get('lessons', ''), b.get('tomorrow_focus', ''), now_iso(), d
    )

    c = conn()
    existing = c.execute('SELECT id FROM reflections WHERE date = ? ORDER BY id DESC LIMIT 1', (d,)).fetchone()
    if existing:
        c.execute('''
          UPDATE reflections
          SET top3=?, blockers=?, manager_sync=?, weekly_progress=?, wins=?, lessons=?, tomorrow_focus=?, updated_at=?
          WHERE id=?
        ''', (
          b.get('top3', ''), b.get('blockers', ''), b.get('manager_sync', ''), b.get('weekly_progress', ''),
          b.get('wins', ''), b.get('lessons', ''), b.get('tomorrow_focus', ''), now_iso(), existing['id']
        ))
    else:
        c.execute('''
          INSERT INTO reflections(date, top3, blockers, manager_sync, weekly_progress, wins, lessons, tomorrow_focus, updated_at)
          VALUES(?,?,?,?,?,?,?,?,?)
        ''', (
          d, b.get('top3', ''), b.get('blockers', ''), b.get('manager_sync', ''), b.get('weekly_progress', ''),
          b.get('wins', ''), b.get('lessons', ''), b.get('tomorrow_focus', ''), now_iso()
        ))
    c.commit()
    c.close()
    return jsonify({'data': {'ok': True}})


@app.get('/api/updates')
def get_updates():
    c = conn()
    rows = c.execute('SELECT * FROM updates ORDER BY id DESC LIMIT 20').fetchall()
    c.close()
    return jsonify({'data': rows_to_dict(rows)})


@app.get('/api/upward-syncs')
def get_upward_syncs():
    c = conn()
    rows = c.execute('SELECT * FROM upward_syncs ORDER BY id DESC LIMIT 50').fetchall()
    c.close()
    return jsonify({'data': rows_to_dict(rows)})


@app.post('/api/upward-syncs')
def create_upward_sync():
    b = request.json or {}
    c = conn()
    c.execute('''
      INSERT INTO upward_syncs(date, language, content, source_top3, source_blockers, source_weekly_progress, created_at)
      VALUES(?,?,?,?,?,?,?)
    ''', (
      b.get('date'), b.get('language', 'en'), b.get('content', ''),
      b.get('source_top3', ''), b.get('source_blockers', ''), b.get('source_weekly_progress', ''),
      now_iso()
    ))
    c.commit()
    c.close()
    return jsonify({'data': {'ok': True}})


@app.post('/api/ai/generate-dashboard-sync')
def ai_generate_dashboard_sync():
    b = request.json or {}
    top3 = (b.get('top3') or '').strip()
    blockers = (b.get('blockers') or '').strip()
    weekly_progress = (b.get('weekly_progress') or '').strip()
    language = (b.get('language') or 'en').strip().lower()

    lang_rule = {
        'en': 'Output in English.',
        'zh': 'Output in Simplified Chinese.',
        'bilingual': 'Output concise bilingual Chinese + English.'
    }.get(language, 'Output in English.')

    source = f"Top priorities: {top3}\nBlockers: {blockers}\nWeekly progress: {weekly_progress}"

    try:
        output = call_openai_text(
            'You are a senior manager communications assistant. Write a concise upward sync update for leadership. Keep it to 4 bullets: Progress / Risk / Impact / Ask.',
            f"Context:\n{source}\n\n{lang_rule}\nMax 8 lines."
        )
        return jsonify({'data': {'output': output, 'fallback': False, 'engine': 'openai'}})
    except Exception:
        output = f"Progress: {weekly_progress or top3 or 'Made progress on planned priorities.'}\nRisk: {blockers or 'No major blockers.'}\nImpact: Improved delivery visibility and execution confidence.\nAsk: Align dependency owners and priority trade-offs this week."
        return jsonify({'data': {'output': output, 'fallback': True, 'engine': 'template'}})


@app.post('/api/ai/generate-update')
def ai_generate_update():
    b = request.json or {}
    notes = (b.get('raw_notes') or '').strip()
    style = b.get('style', 'concise')
    language = (b.get('language') or 'en').strip().lower()
    project_id = b.get('project_id')

    if not notes:
        return jsonify({'error': 'raw_notes is required'}), 400

    style_guide = {
        'concise': 'Keep it brief, 4 bullet points: Completed / In progress / Risks / Ask.',
        'result': 'Result-oriented, highlight measurable impact and outcomes.',
        'risk': 'Risk alert style: emphasize blockers, decision-needed, mitigation and owner.'
    }.get(style, 'Keep it concise and practical.')
    lang_rule = {
        'en': 'Output in English.',
        'zh': 'Output in Simplified Chinese.',
        'bilingual': 'Output in concise bilingual Chinese + English.'
    }.get(language, 'Output in English.')

    try:
        output = call_openai_text(
            'You are a senior engineering manager assistant writing crisp status updates for leadership. Return plain text only.',
            f"Raw notes:\n{notes}\n\nStyle:\n{style_guide}\n{lang_rule}\n\nMax 8 lines."
        )
        fallback = False
    except Exception as e:
        fallback = True
        if style == 'risk':
            output = f"Risk Alert Update\n- Current notes: {notes}\n- Key risk: clarify blocker and owner\n- Decision needed: manager escalation on dependencies\n- Next step: resolve blocker by EOD with explicit owner."
        elif style == 'result':
            output = f"Result-Oriented Update\n- Outcomes: {notes}\n- Business impact: improved execution visibility and delivery confidence\n- Next: convert open risks into dated actions."
        else:
            output = f"Concise Update\n- Completed: {notes}\n- In progress: close blockers\n- Risks: pending dependency alignment\n- Ask: decision support on priority trade-offs."

    c = conn()
    cur = c.execute('''
      INSERT INTO updates(project_id, raw_notes, summary, style, risk, decision_needed, next_step, created_at)
      VALUES(?,?,?,?,?,?,?,?)
    ''', (
      project_id,
      notes,
      output,
      style,
      'pending dependency alignment',
      'manager support on priority trade-offs',
      'close blocker by EOD',
      now_iso()
    ))
    c.commit()
    update_id = cur.lastrowid
    c.close()

    return jsonify({'data': {'output': output, 'update_id': update_id, 'fallback': fallback, 'engine': 'template' if fallback else 'openai'}})


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False)
