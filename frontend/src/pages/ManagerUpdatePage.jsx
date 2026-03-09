import { useEffect, useState } from 'react'
import { Alert, Button, Card, Input, Select, Space, Typography, Table, message, Tag } from 'antd'
import { api } from '../api/client'

const DRAFT_KEY = 'careeros:manager-update-draft'

export default function ManagerUpdatePage() {
  const getDraft = () => {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}')
    } catch {
      return {}
    }
  }

  const [raw, setRaw] = useState(() => getDraft().raw || '')
  const [style, setStyle] = useState(() => getDraft().style || 'concise')
  const [result, setResult] = useState('')
  const [language, setLanguage] = useState(() => getDraft().language || 'en')
  const [projectId, setProjectId] = useState(() => getDraft().projectId)
  const [projects, setProjects] = useState([])
  const [history, setHistory] = useState([])
  const [genMeta, setGenMeta] = useState(null)

  const load = async () => {
    const p = await api.get('/projects')
    setProjects((p.data.data || []).map(x => ({ value: x.id, label: x.title })))
    const h = await api.get('/updates')
    setHistory(h.data.data || [])
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ raw, style, language, projectId }))
  }, [raw, style, language, projectId])

  const generate = async () => {
    if (!raw.trim()) return message.warning('Please input raw notes first')
    const { data } = await api.post('/ai/generate-update', { raw_notes: raw, style, language, project_id: projectId })
    setResult(data.data.output)
    setGenMeta({ fallback: data.data.fallback, engine: data.data.engine })
    message.success(`Saved to updates table (#${data.data.update_id})`)
    load()
  }

  return (
    <>
      <Typography.Title level={3}>Manager Update</Typography.Title>
      <Card title="Raw Notes" style={{ marginBottom: 16 }}>
        <Input.TextArea rows={8} value={raw} onChange={(e)=>setRaw(e.target.value)} placeholder="Write what you did this week..." />
        <Space style={{ marginTop: 12 }} wrap>
          <Select style={{ minWidth: 220 }} allowClear placeholder="Link to project (optional)" value={projectId} onChange={setProjectId} options={projects} />
          <Select value={style} onChange={setStyle} options={[{value:'concise',label:'Concise'},{value:'result',label:'Result-Oriented'},{value:'risk',label:'Risk Alert'}]} />
          <Select value={language} onChange={setLanguage} options={[{value:'en',label:'English'},{value:'zh',label:'Chinese'},{value:'bilingual',label:'Bilingual'}]} />
          <Button type="primary" onClick={generate}>Generate + Save Update</Button>
          <Button onClick={generate}>Retry</Button>
        </Space>
      </Card>
      <Card title="Generated Output" style={{ marginBottom: 16 }}>
        {genMeta && (
          <Space style={{ marginBottom: 8 }}>
            <Tag color={genMeta.fallback ? 'orange' : 'green'}>{genMeta.fallback ? 'Fallback' : 'OpenAI'}</Tag>
            <Typography.Text type="secondary">engine: {genMeta.engine}</Typography.Text>
          </Space>
        )}
        {genMeta?.fallback && <Alert type="warning" showIcon message="Using fallback template output (OpenAI unavailable)." style={{ marginBottom: 8 }} />}
        <Typography.Paragraph style={{ whiteSpace:'pre-wrap' }}>{result || 'No output yet.'}</Typography.Paragraph>
      </Card>
      <Card title="Update History (latest 20)">
        <Table
          rowKey="id"
          dataSource={history}
          pagination={false}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 70 },
            { title: 'Style', dataIndex: 'style', width: 100 },
            { title: 'Raw Notes', dataIndex: 'raw_notes', ellipsis: true },
            { title: 'Created At', dataIndex: 'created_at', width: 220 }
          ]}
        />
      </Card>
    </>
  )
}
