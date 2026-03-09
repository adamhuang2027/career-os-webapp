import { useEffect, useRef, useState } from 'react'
import { Button, Card, Col, Input, Row, Typography, message, Tag, Space, Select } from 'antd'
import { api } from '../api/client'

export default function DashboardPage() {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
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
  const loadedRef = useRef(false)

  const loadToday = async () => {
    const { data } = await api.get('/reflections/today', { params: { date: form.date } })
    if (data.data) {
      setForm(prev => ({ ...prev, ...data.data }))
    }
  }

  useEffect(() => { loadToday().finally(() => { loadedRef.current = true }) }, [])

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

  const generateUpwardSync = async () => {
    const { data } = await api.post('/ai/generate-dashboard-sync', {
      top3: form.top3,
      blockers: form.blockers,
      weekly_progress: form.weekly_progress,
      language: syncLang,
    })
    setSyncDraft(data.data.output)
    message.success(data.data.fallback ? 'Generated (fallback template)' : 'Generated with OpenAI')
  }

  return (
    <>
      <Typography.Title level={3}>Today Dashboard</Typography.Title>
      <Tag color={autoSaveState === 'saved' ? 'green' : autoSaveState === 'saving' ? 'blue' : autoSaveState === 'error' ? 'red' : 'default'} style={{ marginBottom: 12 }}>
        {autoSaveState === 'saved' ? 'Auto-saved' : autoSaveState === 'saving' ? 'Auto-saving...' : autoSaveState === 'error' ? 'Auto-save failed' : 'Auto-save idle'}
      </Tag>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}><Card title="Top 3 Priorities"><Input.TextArea rows={5} value={form.top3} onChange={(e)=>setForm({...form, top3:e.target.value})} /></Card></Col>
        <Col xs={24} md={12}><Card title="Current Blockers"><Input.TextArea rows={5} value={form.blockers} onChange={(e)=>setForm({...form, blockers:e.target.value})} /></Card></Col>
        <Col xs={24} md={12}><Card title="What to Sync Upward Today"><Input.TextArea rows={5} value={form.manager_sync} onChange={(e)=>setForm({...form, manager_sync:e.target.value})} /></Card></Col>
        <Col xs={24} md={12}><Card title="Weekly Project Progress"><Input.TextArea rows={5} value={form.weekly_progress} onChange={(e)=>setForm({...form, weekly_progress:e.target.value})} /></Card></Col>
        <Col xs={24}><Card title="Wins"><Input.TextArea rows={3} value={form.wins} onChange={(e)=>setForm({...form, wins:e.target.value})} /></Card></Col>
        <Col xs={24}><Card title="Lessons + Tomorrow Focus"><Input.TextArea rows={4} value={form.lessons + '\n' + form.tomorrow_focus} onChange={(e)=>{
          const [first,...rest] = e.target.value.split('\n')
          setForm({...form, lessons:first || '', tomorrow_focus:rest.join('\n')})
        }} /></Card></Col>
      </Row>
      <Space style={{ marginTop: 16 }} wrap>
        <Button type="primary" onClick={saveToday}>Save Dashboard Reflection</Button>
        <Select value={syncLang} onChange={setSyncLang} options={[{value:'en',label:'English'},{value:'zh',label:'中文'},{value:'bilingual',label:'Bilingual'}]} />
        <Button onClick={generateUpwardSync}>Generate Upward Sync with AI</Button>
      </Space>
      {!!syncDraft && (
        <Card title="Upward Sync Draft" style={{ marginTop: 16 }}>
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{syncDraft}</Typography.Paragraph>
        </Card>
      )}
    </>
  )
}
