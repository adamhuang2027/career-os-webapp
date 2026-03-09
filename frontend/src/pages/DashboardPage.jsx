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
        <Col xs={24} md={12}>
          <Card title="Top 3 Priorities" extra={<Typography.Text type="secondary">写今天最重要的3件事（可执行、可交付）</Typography.Text>}>
            <Input.TextArea
              rows={5}
              value={form.top3}
              placeholder={'建议格式：\n1) [任务] - [完成标准]\n2) [任务] - [完成标准]\n3) [任务] - [完成标准]'}
              onChange={(e)=>setForm({...form, top3:e.target.value})}
            />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Current Blockers" extra={<Typography.Text type="secondary">写当前卡点、影响、需要谁支持</Typography.Text>}>
            <Input.TextArea
              rows={5}
              value={form.blockers}
              placeholder={'建议格式：\n- Blocker: [是什么问题]\n- Impact: [影响什么]\n- Need: [需要谁在何时支持]'}
              onChange={(e)=>setForm({...form, blockers:e.target.value})}
            />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="What to Sync Upward Today" extra={<Typography.Text type="secondary">给上级同步：进展/风险/影响/请求</Typography.Text>}>
            <Input.TextArea
              rows={5}
              value={form.manager_sync}
              placeholder={'建议格式（最多6-8行）：\n- Progress:\n- Risk:\n- Impact:\n- Ask:'}
              onChange={(e)=>setForm({...form, manager_sync:e.target.value})}
            />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Weekly Project Progress" extra={<Typography.Text type="secondary">按项目写本周里程碑进展</Typography.Text>}>
            <Input.TextArea
              rows={5}
              value={form.weekly_progress}
              placeholder={'建议格式：\n[Project A]: 本周完成/下步/风险\n[Project B]: 本周完成/下步/风险'}
              onChange={(e)=>setForm({...form, weekly_progress:e.target.value})}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Wins" extra={<Typography.Text type="secondary">记录今天做成的事（最好有量化结果）</Typography.Text>}>
            <Input.TextArea
              rows={3}
              value={form.wins}
              placeholder={'示例：\n- 优化SQL后报表耗时从12min降到4min\n- 完成X功能并提交PR #123'}
              onChange={(e)=>setForm({...form, wins:e.target.value})}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Lessons + Tomorrow Focus" extra={<Typography.Text type="secondary">复盘1条经验 + 明天最优先目标</Typography.Text>}>
            <Input.TextArea
              rows={4}
              value={form.lessons + '\n' + form.tomorrow_focus}
              placeholder={'第一行写 Lesson（今天学到/下次避免）\n后续写 Tomorrow Focus（明天最关键1-3件事）'}
              onChange={(e)=>{
                const [first,...rest] = e.target.value.split('\n')
                setForm({...form, lessons:first || '', tomorrow_focus:rest.join('\n')})
              }}
            />
          </Card>
        </Col>
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
