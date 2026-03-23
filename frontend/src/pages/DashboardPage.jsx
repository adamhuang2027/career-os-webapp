import { useEffect, useMemo, useRef, useState } from 'react'

const POMODORO_STORAGE_KEY = 'careeros_pomodoro_state_v1'
import { Button, Card, Col, Input, Row, Typography, message, Tag, Space, Select, Table, Popconfirm, Progress, Switch } from 'antd'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../api/client'

export default function DashboardPage() {
  const todayCT = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date())

  const [form, setForm] = useState({
    date: todayCT(),
    top3: '',
    blockers: '',
    manager_sync: '',
    weekly_progress: '',
    wins: '',
    lessons: '',
    tomorrow_focus: ''
  })
  const [autoSaveState, setAutoSaveState] = useState('idle')
  const [syncDraft, setSyncDraft] = useState('')
  const [syncLang, setSyncLang] = useState('en')
  const [syncHistory, setSyncHistory] = useState([])
  const [backlog, setBacklog] = useState([])
  const [newBacklog, setNewBacklog] = useState({ title: '', category: 'weekly', priority: 'medium' })
  const [dragIndex, setDragIndex] = useState(null)
  const [pomodoroMinutes, setPomodoroMinutes] = useState(25)
  const [pomodoroTask, setPomodoroTask] = useState('')
  const [pomodoroRunning, setPomodoroRunning] = useState(false)
  const [pomodoroStartedAt, setPomodoroStartedAt] = useState(null)
  const [pomodoroEndAtMs, setPomodoroEndAtMs] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [pomodoroHistory, setPomodoroHistory] = useState([])
  const [autoNextPomodoro, setAutoNextPomodoro] = useState(true)
  const loadedRef = useRef(false)

  const top3Items = useMemo(() => {
    return (form.top3 || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.replace(/^\d+\)\s*/, ''))
  }, [form.top3])

  const loadToday = async () => {
    const { data } = await api.get('/reflections/today', { params: { date: form.date } })
    if (data.data) {
      setForm(prev => ({ ...prev, ...data.data }))
    }
  }

  const loadSyncHistory = async () => {
    const { data } = await api.get('/upward-syncs')
    setSyncHistory(data.data || [])
  }

  const loadBacklog = async () => {
    const { data } = await api.get('/backlog-tasks')
    setBacklog(data.data || [])
  }

  const loadPomodoroHistory = async () => {
    const { data } = await api.get('/pomodoro-sessions')
    setPomodoroHistory(data.data || [])
  }

  useEffect(() => {
    loadToday().finally(() => { loadedRef.current = true })
    loadSyncHistory()
    loadBacklog()
    loadPomodoroHistory()
  }, [])

  useEffect(() => {
    if (!loadedRef.current) return
    const t = setTimeout(async () => {
      try {
        setAutoSaveState('saving')
        await api.post('/reflections/today', form)
        setAutoSaveState('saved')
      } catch {
        setAutoSaveState('error')
      }
    }, 1200)
    return () => clearTimeout(t)
  }, [form])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POMODORO_STORAGE_KEY)
      if (!raw) return
      const s = JSON.parse(raw)
      if (!s || typeof s !== 'object') return

      setPomodoroMinutes(Number(s.pomodoroMinutes || 25))
      setPomodoroTask(String(s.pomodoroTask || ''))
      setPomodoroRunning(Boolean(s.pomodoroRunning))
      setPomodoroStartedAt(s.pomodoroStartedAt || null)
      setPomodoroEndAtMs(s.pomodoroEndAtMs || null)

      if (s.pomodoroRunning && s.pomodoroEndAtMs) {
        const remaining = Math.max(0, Math.ceil((Number(s.pomodoroEndAtMs) - Date.now()) / 1000))
        setSecondsLeft(remaining)
      } else {
        setSecondsLeft(Number(s.secondsLeft || (Number(s.pomodoroMinutes || 25) * 60)))
      }
    } catch {
      // ignore malformed cache
    }
  }, [])

  useEffect(() => {
    const snapshot = {
      pomodoroMinutes,
      pomodoroTask,
      pomodoroRunning,
      pomodoroStartedAt,
      pomodoroEndAtMs,
      secondsLeft,
    }
    localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(snapshot))
  }, [pomodoroMinutes, pomodoroTask, pomodoroRunning, pomodoroStartedAt, pomodoroEndAtMs, secondsLeft])

  useEffect(() => {
    if (!pomodoroRunning || !pomodoroEndAtMs) return
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((pomodoroEndAtMs - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        setPomodoroRunning(false)
        completePomodoro('completed', pomodoroMinutes, { autoNext: autoNextPomodoro })
      }
    }, 1000)
    return () => clearInterval(id)
  }, [pomodoroRunning, pomodoroEndAtMs, pomodoroMinutes, autoNextPomodoro])

  useEffect(() => {
    if (!pomodoroRunning && !pomodoroStartedAt) {
      setSecondsLeft(pomodoroMinutes * 60)
    }
  }, [pomodoroMinutes, pomodoroRunning, pomodoroStartedAt])

  const saveToday = async () => {
    await api.post('/reflections/today', form)
    message.success('Today reflection saved')
  }

  const insertTemplate = () => {
    setForm(prev => ({
      ...prev,
      top3: prev.top3 || '1) [Task] - [Definition of done]\n2) [Task] - [Definition of done]\n3) [Task] - [Definition of done]',
      blockers: prev.blockers || '- Blocker: [what]\n- Impact: [so what]\n- Need: [who/when support needed]',
      manager_sync: prev.manager_sync || '- Progress: [what moved]\n- Risk: [what may slip]\n- Impact: [business/team impact]\n- Ask: [decision/support needed]',
      weekly_progress: prev.weekly_progress || '[Project A]: done / next / risk\n[Project B]: done / next / risk',
      wins: prev.wins || '- [win + metric]\n- [win + metric]',
      lessons: prev.lessons || 'Lesson: [what worked / what to improve]',
      tomorrow_focus: prev.tomorrow_focus || '1) [highest priority]\n2) [second priority]\n3) [optional]'
    }))
    message.success('Template inserted')
  }

  const generateUpwardSync = async () => {
    const { data } = await api.post('/ai/generate-dashboard-sync', {
      top3: form.top3,
      blockers: form.blockers,
      weekly_progress: form.weekly_progress,
      language: syncLang,
    })
    const output = data.data.output
    setSyncDraft(output)

    await api.post('/upward-syncs', {
      date: form.date,
      language: syncLang,
      content: output,
      source_top3: form.top3,
      source_blockers: form.blockers,
      source_weekly_progress: form.weekly_progress,
    })
    loadSyncHistory()

    message.success(data.data.fallback ? 'Generated and saved (fallback template)' : 'Generated and saved with OpenAI')
  }

  const saveUpwardSync = async () => {
    if (!syncDraft.trim()) return message.warning('Generate a draft first')
    await api.post('/upward-syncs', {
      date: form.date,
      language: syncLang,
      content: syncDraft,
      source_top3: form.top3,
      source_blockers: form.blockers,
      source_weekly_progress: form.weekly_progress,
    })
    message.success('Upward sync saved')
    loadSyncHistory()
  }

  const addBacklogTask = async () => {
    const title = newBacklog.title.trim()
    if (!title) return message.warning('Please input backlog task title')
    try {
      await api.post('/backlog-tasks', {
        title,
        category: newBacklog.category,
        priority: newBacklog.priority,
        status: 'backlog',
      })
      setNewBacklog(prev => ({ ...prev, title: '' }))
      message.success('Backlog task added')
      loadBacklog()
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'Unknown error'
      message.error(`Add failed: ${detail}`)
    }
  }

  const updateBacklogStatus = async (task, status) => {
    try {
      await api.put(`/backlog-tasks/${task.id}`, { ...task, status })
      message.success('Backlog updated')
      loadBacklog()
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'Unknown error'
      message.error(`Update failed: ${detail}`)
    }
  }

  const deleteBacklogTask = async (taskId) => {
    try {
      await api.delete(`/backlog-tasks/${taskId}`)
      message.success('Backlog task deleted')
      loadBacklog()
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'Unknown error'
      message.error(`Delete failed: ${detail}`)
    }
  }

  const renumberTop3 = (items) => items.map((item, idx) => `${idx + 1}) ${item}`)

  const updateTop3Items = (items) => {
    const normalized = items.map(s => s.trim()).filter(Boolean).slice(0, 3)
    setForm(prev => ({ ...prev, top3: renumberTop3(normalized).join('\n') }))
  }

  const addBacklogToTop3 = (title) => {
    if (top3Items.length >= 3) {
      message.warning('Top 3 already has 3 lines. Edit one first.')
      return
    }
    updateTop3Items([...top3Items, `${title} - [Definition of done]`])
  }

  const reorderTop3 = (from, to) => {
    if (from == null || to == null || from === to) return
    const list = [...top3Items]
    const [moved] = list.splice(from, 1)
    list.splice(to, 0, moved)
    updateTop3Items(list)
  }

  const formatClock = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  const formatCentralTime = (iso) => {
    if (!iso) return ''
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  const startPomodoro = () => {
    if (!pomodoroTask.trim()) return message.warning('Please choose or type a task name')
    const now = Date.now()
    if (!pomodoroStartedAt) setPomodoroStartedAt(new Date(now).toISOString())
    setPomodoroEndAtMs(now + secondsLeft * 1000)
    setPomodoroRunning(true)
  }

  const pausePomodoro = () => {
    if (pomodoroEndAtMs) {
      const remaining = Math.max(0, Math.ceil((pomodoroEndAtMs - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }
    setPomodoroRunning(false)
    setPomodoroEndAtMs(null)
  }

  const resetPomodoro = () => {
    setPomodoroRunning(false)
    setPomodoroStartedAt(null)
    setPomodoroEndAtMs(null)
    setSecondsLeft(pomodoroMinutes * 60)
    localStorage.removeItem(POMODORO_STORAGE_KEY)
  }

  const completePomodoro = async (status = 'completed', manualActualMinutes = null, options = {}) => {
    const { autoNext = false } = options
    const elapsed = pomodoroMinutes * 60 - secondsLeft
    const actualMinutes = manualActualMinutes != null
      ? manualActualMinutes
      : Math.max(1, Math.round(elapsed / 60))

    try {
      await api.post('/pomodoro-sessions', {
        task_title: pomodoroTask,
        planned_minutes: pomodoroMinutes,
        actual_minutes: actualMinutes,
        status,
        started_at: pomodoroStartedAt,
        ended_at: new Date().toISOString(),
      })
      message.success(status === 'completed' ? 'Pomodoro saved' : 'Pomodoro cancelled and logged')
      loadPomodoroHistory()
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'Unknown error'
      message.error(`Pomodoro save failed: ${detail}`)
    }

    if (status === 'completed' && autoNext && pomodoroTask.trim()) {
      const now = Date.now()
      setPomodoroStartedAt(new Date(now).toISOString())
      setSecondsLeft(pomodoroMinutes * 60)
      setPomodoroEndAtMs(now + pomodoroMinutes * 60 * 1000)
      setPomodoroRunning(true)
      return
    }

    setPomodoroRunning(false)
    setPomodoroStartedAt(null)
    setPomodoroEndAtMs(null)
    setSecondsLeft(pomodoroMinutes * 60)
    localStorage.removeItem(POMODORO_STORAGE_KEY)
  }

  return (
    <>
      <Typography.Title level={3}>Today Dashboard</Typography.Title>
      <Tag color={autoSaveState === 'saved' ? 'green' : autoSaveState === 'saving' ? 'blue' : autoSaveState === 'error' ? 'red' : 'default'} style={{ marginBottom: 12 }}>
        {autoSaveState === 'saved' ? 'Auto-saved' : autoSaveState === 'saving' ? 'Auto-saving...' : autoSaveState === 'error' ? 'Auto-save failed' : 'Auto-save idle'}
      </Tag>
      <Card title="Weekly / Long-term Backlog" style={{ marginBottom: 16 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            style={{ width: 360 }}
            placeholder="Add weekly or long-term task..."
            value={newBacklog.title}
            onChange={(e) => setNewBacklog(prev => ({ ...prev, title: e.target.value }))}
            onPressEnter={addBacklogTask}
          />
          <Select
            value={newBacklog.category}
            onChange={(v) => setNewBacklog(prev => ({ ...prev, category: v }))}
            options={[{ value: 'weekly', label: 'Weekly' }, { value: 'longterm', label: 'Long-term' }]}
            style={{ width: 130 }}
          />
          <Select
            value={newBacklog.priority}
            onChange={(v) => setNewBacklog(prev => ({ ...prev, priority: v }))}
            options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]}
            style={{ width: 120 }}
          />
          <Button type="primary" onClick={addBacklogTask}>Add</Button>
        </Space>

        <Table
          rowKey="id"
          dataSource={backlog}
          size="small"
          pagination={{ pageSize: 8 }}
          columns={[
            { title: 'Task', dataIndex: 'title' },
            { title: 'Type', dataIndex: 'category', width: 100, render: (v) => <Tag color={v === 'weekly' ? 'blue' : 'purple'}>{v}</Tag> },
            { title: 'Priority', dataIndex: 'priority', width: 100 },
            { title: 'Status', dataIndex: 'status', width: 100, render: (v) => <Tag color={v === 'done' ? 'green' : v === 'doing' ? 'orange' : 'default'}>{v}</Tag> },
            {
              title: 'Actions',
              width: 290,
              render: (_, row) => (
                <Space size={4} wrap>
                  <Button size="small" onClick={() => addBacklogToTop3(row.title)}>Use in Top3</Button>
                  <Button size="small" onClick={() => updateBacklogStatus(row, 'doing')}>Doing</Button>
                  <Button size="small" onClick={() => updateBacklogStatus(row, 'done')}>Done</Button>
                  <Popconfirm title="Delete this backlog task?" onConfirm={() => deleteBacklogTask(row.id)}>
                    <Button danger size="small">Delete</Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Card title="Pomodoro Timer (Task Time Tracking)" style={{ marginBottom: 16 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Select
            value={pomodoroTask || undefined}
            placeholder="Select task"
            style={{ width: 320 }}
            showSearch
            allowClear
            onChange={(v) => setPomodoroTask(v || '')}
            options={[
              ...top3Items.map((t) => ({ value: t, label: `Top3: ${t}` })),
              ...backlog.filter((b) => b.status !== 'done').map((b) => ({ value: b.title, label: `Backlog: ${b.title}` })),
            ]}
          />
          <Input
            style={{ width: 260 }}
            placeholder="Or type task name..."
            value={pomodoroTask}
            onChange={(e) => setPomodoroTask(e.target.value)}
          />
          <Select
            value={pomodoroMinutes}
            style={{ width: 120 }}
            onChange={(v) => setPomodoroMinutes(v)}
            options={[{ value: 15, label: '15 min' }, { value: 25, label: '25 min' }, { value: 45, label: '45 min' }, { value: 60, label: '60 min' }]}
          />
          <Space size={6}>
            <Typography.Text type="secondary">Auto next</Typography.Text>
            <Switch checked={autoNextPomodoro} onChange={setAutoNextPomodoro} />
          </Space>
        </Space>

        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Typography.Title level={2} style={{ margin: 0 }}>{formatClock(secondsLeft)}</Typography.Title>
            <Typography.Text type="secondary">{pomodoroRunning ? 'Running...' : pomodoroStartedAt ? 'Paused' : 'Ready'}</Typography.Text>
          </Col>
          <Col xs={24} md={8}>
            <Progress percent={Math.round(((pomodoroMinutes * 60 - secondsLeft) / (pomodoroMinutes * 60)) * 100)} />
          </Col>
          <Col xs={24} md={8}>
            <Space wrap>
              {!pomodoroRunning ? <Button type="primary" onClick={startPomodoro}>Start</Button> : <Button onClick={pausePomodoro}>Pause</Button>}
              <Button onClick={resetPomodoro}>Reset</Button>
              <Button onClick={() => completePomodoro('completed')}>Finish & Save</Button>
              <Button danger onClick={() => completePomodoro('cancelled')}>Cancel</Button>
            </Space>
          </Col>
        </Row>

        <Table
          style={{ marginTop: 12 }}
          rowKey="id"
          size="small"
          dataSource={pomodoroHistory}
          pagination={{ pageSize: 5 }}
          columns={[
            { title: 'Task', dataIndex: 'task_title' },
            { title: 'Planned', dataIndex: 'planned_minutes', width: 90, render: (v) => `${v}m` },
            { title: 'Actual', dataIndex: 'actual_minutes', width: 90, render: (v) => `${v}m` },
            { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <Tag color={v === 'completed' ? 'green' : 'red'}>{v}</Tag> },
            { title: 'Ended At (CT)', dataIndex: 'ended_at', width: 220, render: (v) => formatCentralTime(v) },
          ]}
        />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Top 3 Priorities">
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Write the 3 most important deliverables for today.</Typography.Text>
            <Input.TextArea
              rows={5}
              value={form.top3}
              placeholder={'Suggested format:\n1) [Task] - [Definition of done]\n2) [Task] - [Definition of done]\n3) [Task] - [Definition of done]'}
              onChange={(e)=>setForm({...form, top3:e.target.value})}
            />

            {top3Items.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                  Drag to reorder (auto renumber):
                </Typography.Text>
                {top3Items.map((item, idx) => (
                  <div
                    key={`${idx}-${item}`}
                    draggable
                    onDragStart={() => setDragIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      reorderTop3(dragIndex, idx)
                      setDragIndex(null)
                    }}
                    onDragEnd={() => setDragIndex(null)}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: '8px 10px',
                      marginBottom: 6,
                      background: dragIndex === idx ? '#f5f5f5' : '#fff',
                      cursor: 'move',
                    }}
                  >
                    <b>{idx + 1})</b> {item}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Current Blockers">
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Capture blocker, impact, and who can help.</Typography.Text>
            <Input.TextArea
              rows={5}
              value={form.blockers}
              placeholder={'Suggested format:\n- Blocker: [what is blocked]\n- Impact: [what is impacted]\n- Need: [who/when support is needed]'}
              onChange={(e)=>setForm({...form, blockers:e.target.value})}
            />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="What to Sync Upward Today">
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Give leadership a quick progress/risk/impact/ask update.</Typography.Text>
            <Input.TextArea
              rows={5}
              value={form.manager_sync}
              placeholder={'Suggested format (max 6-8 lines):\n- Progress:\n- Risk:\n- Impact:\n- Ask:'}
              onChange={(e)=>setForm({...form, manager_sync:e.target.value})}
            />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Weekly Project Progress">
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Track milestone progress by project.</Typography.Text>
            <Input.TextArea
              rows={5}
              value={form.weekly_progress}
              placeholder={'Suggested format:\n[Project A]: done this week / next step / risk\n[Project B]: done this week / next step / risk'}
              onChange={(e)=>setForm({...form, weekly_progress:e.target.value})}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Wins">
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Record completed outcomes (ideally with metrics).</Typography.Text>
            <Input.TextArea
              rows={3}
              value={form.wins}
              placeholder={'Example:\n- Reduced report runtime from 12min to 4min after SQL optimization\n- Shipped feature X and opened PR #123'}
              onChange={(e)=>setForm({...form, wins:e.target.value})}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Lessons + Tomorrow Focus">
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Capture one lesson and tomorrow's top focus.</Typography.Text>
            <Input.TextArea
              rows={4}
              value={form.lessons + '\n' + form.tomorrow_focus}
              placeholder={'First line: Lesson learned (or what to avoid next time)\nNext lines: Tomorrow Focus (top 1-3 priorities)'}
              onChange={(e)=>{
                const [first,...rest] = e.target.value.split('\n')
                setForm({...form, lessons:first || '', tomorrow_focus:rest.join('\n')})
              }}
            />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginTop: 16 }} wrap>
        <Button onClick={insertTemplate}>Insert Template</Button>
        <Button type="primary" onClick={saveToday}>Save Dashboard Reflection</Button>
        <Select value={syncLang} onChange={setSyncLang} options={[{value:'en',label:'English'},{value:'zh',label:'Chinese'},{value:'bilingual',label:'Bilingual'}]} />
        <Button onClick={generateUpwardSync}>Generate Upward Sync with AI</Button>
        <Button onClick={saveUpwardSync}>Save Upward Sync</Button>
      </Space>

      {!!syncDraft && (
        <Card title="Upward Sync Draft" style={{ marginTop: 16 }}>
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{syncDraft}</ReactMarkdown>
          </div>
        </Card>
      )}

      <Card title="Saved Upward Sync Reports" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          dataSource={syncHistory}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: 'Date', dataIndex: 'date', width: 120 },
            { title: 'Lang', dataIndex: 'language', width: 100 },
            {
              title: 'Content',
              dataIndex: 'content',
              render: (v) => (
                <div className="markdown-body" style={{ maxWidth: 720 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{v || ''}</ReactMarkdown>
                </div>
              )
            },
            { title: 'Saved At', dataIndex: 'created_at', width: 220 },
          ]}
        />
      </Card>
    </>
  )
}
