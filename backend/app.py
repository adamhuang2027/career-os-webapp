from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from pathlib import Path
from datetime import datetime, date, timedelta
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

    CREATE TABLE IF NOT EXISTS project_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      stage TEXT,
      status TEXT,
      start_date TEXT,
      end_date TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
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

    CREATE TABLE IF NOT EXISTS backlog_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'weekly' CHECK (category IN ('weekly','longterm')),
      priority TEXT DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog','doing','done')),
      notes TEXT,
      target_date TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS people_connect_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      person_id INTEGER NOT NULL,
      connect_date TEXT NOT NULL,
      channel TEXT,
      summary TEXT,
      notes TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS promotion_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      evidence_date TEXT NOT NULL,
      period TEXT,
      tags TEXT,
      content TEXT NOT NULL,
      source_snapshot TEXT,
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


def period_start(period: str):
    now = datetime.now(APP_TZ)
    if period == 'month':
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if period == 'year':
        return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    # default week (last 7 days)
    return (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)


def connect_period_start_date(period: str):
    now = datetime.now(APP_TZ).date()
    if period == 'month':
        return now.replace(day=1).isoformat()
    if period == 'year':
        return now.replace(month=1, day=1).isoformat()
    return (now - timedelta(days=6)).isoformat()


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


@app.get('/api/projects/<int:project_id>/tasks')
def get_project_tasks(project_id):
    c = conn()
    rows = c.execute('''
      SELECT * FROM project_tasks
      WHERE project_id=?
      ORDER BY COALESCE(start_date, '9999-12-31') ASC, id ASC
    ''', (project_id,)).fetchall()
    c.close()
    return jsonify({'data': rows_to_dict(rows)})


@app.post('/api/projects/<int:project_id>/tasks')
def create_project_task(project_id):
    b = request.json or {}
    now = now_iso()
    c = conn()
    c.execute('''
      INSERT INTO project_tasks(project_id, title, stage, status, start_date, end_date, notes, created_at, updated_at)
      VALUES(?,?,?,?,?,?,?,?,?)
    ''', (
      project_id,
      b.get('title'),
      b.get('stage'),
      b.get('status', 'planned'),
      b.get('start_date'),
      b.get('end_date'),
      b.get('notes'),
      now,
      now
    ))
    c.commit()
    c.close()
    return jsonify({'data': {'ok': True}})


@app.put('/api/projects/<int:project_id>/tasks/<int:task_id>')
def update_project_task(project_id, task_id):
    b = request.json or {}
    c = conn()
    cur = c.execute('''
      UPDATE project_tasks
      SET title=?, stage=?, status=?, start_date=?, end_date=?, notes=?, updated_at=?
      WHERE id=? AND project_id=?
    ''', (
      b.get('title'),
      b.get('stage'),
      b.get('status', 'planned'),
      b.get('start_date'),
      b.get('end_date'),
      b.get('notes'),
      now_iso(),
      task_id,
      project_id
    ))
    c.commit()
    updated = cur.rowcount
    c.close()
    if not updated:
        return jsonify({'error': 'task not found'}), 404
    return jsonify({'data': {'ok': True}})


@app.delete('/api/projects/<int:project_id>/tasks/<int:task_id>')
def delete_project_task(project_id, task_id):
    c = conn()
    cur = c.execute('DELETE FROM project_tasks WHERE id=? AND project_id=?', (task_id, project_id))
    c.commit()
    deleted = cur.rowcount
    c.close()
    if not deleted:
        return jsonify({'error': 'task not found'}), 404
    return jsonify({'data': {'ok': True}})


@app.get('/api/projects/gantt')
def get_projects_gantt():
    c = conn()
    project_rows = rows_to_dict(c.execute('SELECT id, title FROM projects ORDER BY id DESC').fetchall())
    task_rows = rows_to_dict(c.execute('''
      SELECT * FROM project_tasks
      WHERE start_date IS NOT NULL AND start_date != ''
      ORDER BY start_date ASC, id ASC
    ''').fetchall())
    c.close()

    by_project = {}
    for t in task_rows:
        by_project.setdefault(t['project_id'], []).append(t)

    data = []
    for p in project_rows:
        tasks = by_project.get(p['id'], [])
        if not tasks:
            continue
        starts = [t['start_date'] for t in tasks if t.get('start_date')]
        ends = [t.get('end_date') or t.get('start_date') for t in tasks if t.get('start_date')]
        if not starts:
            continue
        data.append({
            'project_id': p['id'],
            'project_title': p['title'],
            'project_start': min(starts),
            'project_end': max(ends),
            'tasks': tasks,
        })

    return jsonify({'data': data})


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
    period = (request.args.get('period') or 'all').strip().lower()
    c = conn()

    if period in ('week', 'month', 'year'):
        start_date = connect_period_start_date(period)
        rows = c.execute('''
          SELECT p.*, COALESCE(cl.connect_count, 0) AS connect_count, cl.last_connect_date
          FROM people p
          LEFT JOIN (
            SELECT person_id, COUNT(*) AS connect_count, MAX(connect_date) AS last_connect_date
            FROM people_connect_logs
            WHERE connect_date >= ?
            GROUP BY person_id
          ) cl ON p.id = cl.person_id
          ORDER BY p.id DESC
        ''', (start_date,)).fetchall()
    else:
        rows = c.execute('''
          SELECT p.*, COALESCE(cl.connect_count, 0) AS connect_count, cl.last_connect_date
          FROM people p
          LEFT JOIN (
            SELECT person_id, COUNT(*) AS connect_count, MAX(connect_date) AS last_connect_date
            FROM people_connect_logs
            GROUP BY person_id
          ) cl ON p.id = cl.person_id
          ORDER BY p.id DESC
        ''').fetchall()

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


@app.get('/api/people/<int:person_id>/connect-logs')
def get_people_connect_logs(person_id):
    c = conn()
    rows = c.execute('''
      SELECT * FROM people_connect_logs
      WHERE person_id = ?
      ORDER BY connect_date DESC, id DESC
      LIMIT 200
    ''', (person_id,)).fetchall()
    c.close()
    return jsonify({'data': rows_to_dict(rows)})


@app.post('/api/people/<int:person_id>/connect-logs')
def create_people_connect_log(person_id):
    b = request.json or {}
    c = conn()
    c.execute('''
      INSERT INTO people_connect_logs(person_id, connect_date, channel, summary, notes, created_at)
      VALUES(?,?,?,?,?,?)
    ''', (
      person_id,
      b.get('connect_date') or today_ct(),
      b.get('channel'),
      b.get('summary'),
      b.get('notes'),
      now_iso()
    ))
    c.commit()
    c.close()
    return jsonify({'data': {'ok': True}})


@app.put('/api/people/<int:person_id>/connect-logs/<int:log_id>')
def update_people_connect_log(person_id, log_id):
    b = request.json or {}
    c = conn()
    cur = c.execute('''
      UPDATE people_connect_logs
      SET connect_date=?, channel=?, summary=?, notes=?
      WHERE id=? AND person_id=?
    ''', (
      b.get('connect_date') or today_ct(),
      b.get('channel'),
      b.get('summary'),
      b.get('notes'),
      log_id,
      person_id
    ))
    c.commit()
    updated = cur.rowcount
    c.close()
    if not updated:
        return jsonify({'error': 'connect log not found'}), 404
    return jsonify({'data': {'ok': True}})


@app.delete('/api/people/<int:person_id>/connect-logs/<int:log_id>')
def delete_people_connect_log(person_id, log_id):
    c = conn()
    cur = c.execute('DELETE FROM people_connect_logs WHERE id=? AND person_id=?', (log_id, person_id))
    c.commit()
    deleted = cur.rowcount
    c.close()
    if not deleted:
        return jsonify({'error': 'connect log not found'}), 404
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


@app.get('/api/backlog-tasks')
def get_backlog_tasks():
    category = (request.args.get('category') or '').strip().lower()
    c = conn()
    if category in ('weekly', 'longterm'):
        rows = c.execute('''
          SELECT * FROM backlog_tasks
          WHERE category = ?
          ORDER BY CASE status WHEN 'doing' THEN 0 WHEN 'backlog' THEN 1 ELSE 2 END, id DESC
        ''', (category,)).fetchall()
    else:
        rows = c.execute('''
          SELECT * FROM backlog_tasks
          ORDER BY CASE category WHEN 'weekly' THEN 0 ELSE 1 END,
                   CASE status WHEN 'doing' THEN 0 WHEN 'backlog' THEN 1 ELSE 2 END,
                   id DESC
        ''').fetchall()
    c.close()
    return jsonify({'data': rows_to_dict(rows)})


@app.post('/api/backlog-tasks')
def create_backlog_task():
    b = request.json or {}
    title = (b.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400

    now = now_iso()
    c = conn()
    c.execute('''
      INSERT INTO backlog_tasks(title, category, priority, status, notes, target_date, created_at, updated_at)
      VALUES(?,?,?,?,?,?,?,?)
    ''', (
      title,
      b.get('category') if b.get('category') in ('weekly', 'longterm') else 'weekly',
      b.get('priority', 'medium'),
      b.get('status') if b.get('status') in ('backlog', 'doing', 'done') else 'backlog',
      b.get('notes'),
      b.get('target_date'),
      now,
      now,
    ))
    c.commit()
    c.close()
    return jsonify({'data': {'ok': True}})


@app.put('/api/backlog-tasks/<int:task_id>')
def update_backlog_task(task_id):
    b = request.json or {}
    c = conn()
    cur = c.execute('''
      UPDATE backlog_tasks
      SET title=?, category=?, priority=?, status=?, notes=?, target_date=?, updated_at=?
      WHERE id=?
    ''', (
      b.get('title'),
      b.get('category') if b.get('category') in ('weekly', 'longterm') else 'weekly',
      b.get('priority', 'medium'),
      b.get('status') if b.get('status') in ('backlog', 'doing', 'done') else 'backlog',
      b.get('notes'),
      b.get('target_date'),
      now_iso(),
      task_id,
    ))
    c.commit()
    updated = cur.rowcount
    c.close()
    if not updated:
        return jsonify({'error': 'backlog task not found'}), 404
    return jsonify({'data': {'ok': True}})


@app.delete('/api/backlog-tasks/<int:task_id>')
def delete_backlog_task(task_id):
    c = conn()
    cur = c.execute('DELETE FROM backlog_tasks WHERE id=?', (task_id,))
    c.commit()
    deleted = cur.rowcount
    c.close()
    if not deleted:
        return jsonify({'error': 'backlog task not found'}), 404
    return jsonify({'data': {'ok': True}})


@app.get('/api/updates')
def get_updates():
    c = conn()
    rows = c.execute('SELECT * FROM updates ORDER BY id DESC LIMIT 20').fetchall()
    c.close()
    return jsonify({'data': rows_to_dict(rows)})


@app.get('/api/promotion-evidence')
def get_promotion_evidence():
    period = (request.args.get('period') or 'week').strip().lower()
    start_iso = period_start(period).isoformat()
    c = conn()
    rows = c.execute('''
      SELECT * FROM promotion_evidence
      WHERE created_at >= ?
      ORDER BY id DESC
      LIMIT 200
    ''', (start_iso,)).fetchall()
    c.close()
    return jsonify({'data': rows_to_dict(rows)})


@app.post('/api/promotion-evidence/generate')
def generate_promotion_evidence():
    b = request.json or {}
    period = (b.get('period') or 'week').strip().lower()
    language = (b.get('language') or 'en').strip().lower()
    start_iso = period_start(period).isoformat()

    c = conn()
    updates_rows = rows_to_dict(c.execute('SELECT * FROM updates WHERE created_at >= ? ORDER BY created_at DESC LIMIT 30', (start_iso,)).fetchall())
    insights_rows = rows_to_dict(c.execute('SELECT * FROM insights WHERE created_at >= ? ORDER BY created_at DESC LIMIT 30', (start_iso,)).fetchall())
    reflections_rows = rows_to_dict(c.execute('SELECT * FROM reflections WHERE updated_at >= ? ORDER BY updated_at DESC LIMIT 30', (start_iso,)).fetchall())

    source = {
      'updates': updates_rows,
      'insights': insights_rows,
      'reflections': reflections_rows,
      'period': period,
      'start_iso': start_iso,
    }

    lang_rule = {
        'en': 'Output in English.',
        'zh': 'Output in Simplified Chinese.',
        'bilingual': 'Output concise bilingual Chinese + English.'
    }.get(language, 'Output in English.')

    try:
        text = call_openai_text(
            'You are a promotion coach. Generate 3-6 STAR bullets for promotion evidence. Each bullet should include action and measurable impact where possible. Then add one-line tags from: ownership, reliability, automation, scale, cross-team, business-impact.',
            f"Data snapshot:\n{json.dumps(source, ensure_ascii=False)[:18000]}\n\n{lang_rule}\nReturn plain text."
        )
        fallback = False
    except Exception:
        fallback = True
        text = "- Built and shipped execution artifacts tied to delivery outcomes (ownership, reliability).\n- Improved visibility via structured updates and tracking workflows (cross-team, business-impact).\n- Converted ambiguous work into repeatable systems and templates (automation, scale)."

    tags = 'ownership,reliability,automation,business-impact'
    c.execute('''
      INSERT INTO promotion_evidence(evidence_date, period, tags, content, source_snapshot, created_at)
      VALUES(?,?,?,?,?,?)
    ''', (today_ct(), period, tags, text, json.dumps(source, ensure_ascii=False), now_iso()))
    evidence_id = c.execute('SELECT last_insert_rowid() AS id').fetchone()['id']
    c.commit()
    c.close()

    return jsonify({'data': {'id': evidence_id, 'content': text, 'tags': tags, 'fallback': fallback}})


@app.get('/api/promotion-evidence/export')
def export_promotion_evidence():
    period = (request.args.get('period') or 'week').strip().lower()
    start_iso = period_start(period).isoformat()
    c = conn()
    rows = rows_to_dict(c.execute('SELECT * FROM promotion_evidence WHERE created_at >= ? ORDER BY id DESC LIMIT 200', (start_iso,)).fetchall())
    c.close()
    lines = [f"Promotion Evidence Export ({period})", f"Generated at: {now_iso()}", ""]
    for r in rows:
      lines.append(f"[{r.get('evidence_date')}] tags={r.get('tags')}")
      lines.append(r.get('content') or '')
      lines.append('')
    return jsonify({'data': {'text': "\n".join(lines)}})


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
