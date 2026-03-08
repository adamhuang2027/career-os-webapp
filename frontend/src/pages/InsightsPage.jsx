import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, Space, Table, Typography, message } from 'antd'
import { api } from '../api/client'

export default function InsightsPage() {
  const [items, setItems] = useState([])
  const [form] = Form.useForm()
  const [generating, setGenerating] = useState(false)

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
    const { data } = await api.post('/ai/generate-insight', { phenomenon })
    form.setFieldsValue({
      hypothesis: data.data.hypothesis,
      evidence: data.data.evidence,
      recommendation: data.data.recommendation,
    })
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
          <Space>
            <Button onClick={generateDraft} loading={generating}>AI Draft from Phenomenon</Button>
            <Button type="primary" htmlType="submit">Save Insight</Button>
          </Space>
        </Form>
      </Card>
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
