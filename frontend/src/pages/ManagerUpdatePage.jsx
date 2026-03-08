import { useEffect, useState } from 'react'
import { Button, Card, Input, Select, Space, Typography, Table, message } from 'antd'
import { api } from '../api/client'

export default function ManagerUpdatePage() {
  const [raw, setRaw] = useState('')
  const [style, setStyle] = useState('concise')
  const [result, setResult] = useState('')
  const [projectId, setProjectId] = useState(undefined)
  const [projects, setProjects] = useState([])
  const [history, setHistory] = useState([])

  const load = async () => {
    const p = await api.get('/projects')
    setProjects((p.data.data || []).map(x => ({ value: x.id, label: x.title })))
    const h = await api.get('/updates')
    setHistory(h.data.data || [])
  }

  useEffect(() => { load() }, [])

  const generate = async () => {
    if (!raw.trim()) return message.warning('Please input raw notes first')
    const { data } = await api.post('/ai/generate-update', { raw_notes: raw, style, project_id: projectId })
    setResult(data.data.output)
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
          <Button type="primary" onClick={generate}>Generate + Save Update</Button>
        </Space>
      </Card>
      <Card title="Generated Output" style={{ marginBottom: 16 }}>
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
