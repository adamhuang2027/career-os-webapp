import { useEffect, useRef, useState } from 'react'
import { Button, Card, Col, Input, Row, Typography, message, Tag, Space, Select, Table } from 'antd'
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
  const loadedRef = useRef(false)

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

  useEffect(() => {
    loadToday().finally(() => { loadedRef.current = true })
    loadSyncHistory()
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

  return (
    <>
      <Typography.Title level={3}>Today Dashboard</Typography.Title>
      <Tag color={autoSaveState === 'saved' ? 'green' : autoSaveState === 'saving' ? 'blue' : autoSaveState === 'error' ? 'red' : 'default'} style={{ marginBottom: 12 }}>
        {autoSaveState === 'saved' ? 'Auto-saved' : autoSaveState === 'saving' ? 'Auto-saving...' : autoSaveState === 'error' ? 'Auto-save failed' : 'Auto-save idle'}
      </Tag>
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
