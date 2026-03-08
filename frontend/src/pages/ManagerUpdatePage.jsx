import { useState } from 'react'
import { Button, Card, Input, Select, Space, Typography } from 'antd'
import { api } from '../api/client'

export default function ManagerUpdatePage() {
  const [raw, setRaw] = useState('')
  const [style, setStyle] = useState('concise')
  const [result, setResult] = useState('')

  const generate = async () => {
    const { data } = await api.post('/ai/generate-update', { raw_notes: raw, style })
    setResult(data.data.output)
  }

  return (
    <>
      <Typography.Title level={3}>Manager Update</Typography.Title>
      <Card title="Raw Notes" style={{ marginBottom: 16 }}>
        <Input.TextArea rows={8} value={raw} onChange={(e)=>setRaw(e.target.value)} placeholder="Write what you did this week..." />
        <Space style={{ marginTop: 12 }}>
          <Select value={style} onChange={setStyle} options={[{value:'concise',label:'Concise'},{value:'result',label:'Result-Oriented'},{value:'risk',label:'Risk Alert'}]} />
          <Button type="primary" onClick={generate}>Generate Update</Button>
        </Space>
      </Card>
      <Card title="Generated Output">
        <Typography.Paragraph style={{ whiteSpace:'pre-wrap' }}>{result || 'No output yet.'}</Typography.Paragraph>
      </Card>
    </>
  )
}
