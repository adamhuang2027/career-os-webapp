import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Select, Space, Table, Typography, message, Tag } from 'antd'
import { api } from '../api/client'

export default function InsightsPage() {
  const [items, setItems] = useState([])
  const [form] = Form.useForm()
  const [generating, setGenerating] = useState(false)
  const [language, setLanguage] = useState('en')
  const [draftMeta, setDraftMeta] = useState(null)

  const load = async () => {
    const { data } = await api.get('/insights')
    setItems(data.data)
  }
  useEffect(() => { load() }, [])

  const onFinish = async (values) => {
    await api.post('/insights', values)
    form.resetFields()
    load()
  }

  const generateDraft = async () => {
    const phenomenon = form.getFieldValue('phenomenon')
    if (!phenomenon || !phenomenon.trim()) return message.warning('Please enter phenomenon first')
    setGenerating(true)
    const { data } = await api.post('/ai/generate-insight', { phenomenon, language })
    form.setFieldsValue({
      hypothesis: data.data.hypothesis,
      evidence: data.data.evidence,
      recommendation: data.data.recommendation,
    })
    setDraftMeta(data.meta || { fallback: false, engine: 'openai' })
    setGenerating(false)
  }

  return (
    <>
      <Typography.Title level={3}>Insights</Typography.Title>
      <Card title="New Insight" style={{ marginBottom: 16 }}>
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phenomenon" label="Phenomenon"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="hypothesis" label="Hypothesis"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="evidence" label="Evidence"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="recommendation" label="Recommendation"><Input.TextArea rows={2} /></Form.Item>
          <Space wrap>
            <Select value={language} onChange={setLanguage} options={[{value:'en',label:'English'},{value:'zh',label:'中文'},{value:'bilingual',label:'Bilingual'}]} />
            <Button onClick={generateDraft} loading={generating}>AI Draft from Phenomenon</Button>
            <Button onClick={generateDraft}>Retry Draft</Button>
            <Button type="primary" htmlType="submit">Save Insight</Button>
          </Space>
        </Form>
      </Card>
      {draftMeta && (
        <Space style={{ marginBottom: 10 }}>
          <Tag color={draftMeta.fallback ? 'orange' : 'green'}>{draftMeta.fallback ? 'Fallback' : 'OpenAI'}</Tag>
          {draftMeta.fallback && <Alert type="warning" showIcon message="Using fallback draft (OpenAI unavailable)." />}
        </Space>
      )}
      <Card title="Insight List">
        <Table
          dataSource={items}
          rowKey="id"
          pagination={false}
          columns={[
            { title: 'Title', dataIndex: 'title' },
            { title: 'Phenomenon', dataIndex: 'phenomenon' },
            { title: 'Recommendation', dataIndex: 'recommendation' }
          ]}
        />
      </Card>
    </>
  )
}
