module.exports = {
  apps: [
    {
      name: 'careeros-backend',
      cwd: '/home/adam/.openclaw/workspace/career-os-webapp/backend',
      script: '/home/adam/.openclaw/workspace/career-os-webapp/backend/.venv/bin/python',
      args: 'app.py',
      env: {
        FLASK_ENV: 'production'
      }
    },
    {
      name: 'careeros-frontend',
      cwd: '/home/adam/.openclaw/workspace/career-os-webapp/frontend',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 5174'
    }
  ]
}
