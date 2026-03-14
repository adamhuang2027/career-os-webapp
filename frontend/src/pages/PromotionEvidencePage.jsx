import { useEffect, useState } from 'react'
import { Button, Card, Select, Space, Table, Tag, Typography, message } from 'antd'
import { api } from '../api/client'

export default function PromotionEvidencePage() {
  const [period, setPeriod] = useState('week')
  const [language, setLanguage] = useState('en')
  const [rows, setRows] = useState([])
  const [latest, setLatest] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const { data } = await api.get('/promotion-evidence', { params: { period } })
    setRows(data.data || [])
  }

  useEffect(() => { load() }, [period])

  const generate = async () => {
    setLoading(true)
    const { data } = await api.post('/promotion-evidence/generate', { period, language })
    setLatest(data.data.content)
    message.success(data.data.fallback ? 'Generated (fallback template)' : 'Generated with OpenAI')
    setLoading(false)
    load()
  }

  const exportText = async () => {
    const { data } = await api.get('/promotion-evidence/export', { params: { period } })
    setLatest(data.data.text)
    message.success('Export text generated')
  }

  return (
    <>
      <Typography.Title level={3}>Promotion Evidence Engine (MVP)</Typography.Title>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select value={period} onChange={setPeriod} options={[{value:'week',label:'This Week'},{value:'month',label:'This Month'}]} />
          <Select value={language} onChange={setLanguage} options={[{value:'en',label:'English'},{value:'zh',label:'Chinese'},{value:'bilingual',label:'Bilingual'}]} />
          <Button type="primary" onClick={generate} loading={loading}>Generate STAR Evidence</Button>
          <Button onClick={exportText}>Export Manager-ready Text</Button>
        </Space>
      </Card>

      <Card title="Latest Output" style={{ marginBottom: 16 }}>
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{latest || 'No output yet.'}</Typography.Paragraph>
      </Card>

      <Card title={`Saved Evidence (${period})`}>
        <Table
          rowKey="id"
          dataSource={rows}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: 'Date', dataIndex: 'evidence_date', width: 120 },
            { title: 'Tags', dataIndex: 'tags', width: 260, render: (v) => (v || '').split(',').filter(Boolean).map(t => <Tag key={t}>{t}</Tag>) },
            { title: 'Content', dataIndex: 'content', render: (v) => <Typography.Text>{v}</Typography.Text> },
            { title: 'Created At', dataIndex: 'created_at', width: 220 },
          ]}
        />
      </Card>
    </>
  )
}
