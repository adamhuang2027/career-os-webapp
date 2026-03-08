import { useEffect, useState } from 'react'
import { Button, Card, Col, Input, Row, Typography, message } from 'antd'
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

  const loadToday = async () => {
    const { data } = await api.get('/reflections/today', { params: { date: form.date } })
    if (data.data) {
      setForm(prev => ({ ...prev, ...data.data }))
    }
  }

  useEffect(() => { loadToday() }, [])

  const saveToday = async () => {
    await api.post('/reflections/today', form)
    message.success('Today reflection saved')
  }

  return (
    <>
      <Typography.Title level={3}>Today Dashboard</Typography.Title>
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
      <Button type="primary" style={{ marginTop: 16 }} onClick={saveToday}>Save Dashboard Reflection</Button>
    </>
  )
}
