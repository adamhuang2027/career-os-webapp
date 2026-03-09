import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Modal, Select, Space, Table, Typography, message, Tag } from 'antd'
import { api } from '../api/client'

export default function InsightsPage() {
  const [items, setItems] = useState([])
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [generating, setGenerating] = useState(false)
  const [language, setLanguage] = useState('en')
  const [draftMeta, setDraftMeta] = useState(null)
  const [editing, setEditing] = useState(null)

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

  const generateDraft = async (targetForm = form) => {
    const phenomenon = targetForm.getFieldValue('phenomenon')
    if (!phenomenon || !phenomenon.trim()) return message.warning('Please enter phenomenon first')
    setGenerating(true)
    const { data } = await api.post('/ai/generate-insight', { phenomenon, language })
    targetForm.setFieldsValue({
      hypothesis: data.data.hypothesis,
      evidence: data.data.evidence,
      recommendation: data.data.recommendation,
    })
    setDraftMeta(data.meta || { fallback: false, engine: 'openai' })
    setGenerating(false)
  }

  const openEdit = (row) => {
    setEditing(row)
    editForm.setFieldsValue({ ...row })
  }

  const saveEdit = async () => {
    const values = await editForm.validateFields()
    await api.put(`/insights/${editing.id}`, values)
    message.success('Insight updated')
    setEditing(null)
    load()
  }

  const useAiLater = (row) => {
    form.setFieldsValue({
      title: row.title,
      phenomenon: row.phenomenon,
      hypothesis: row.hypothesis,
      evidence: row.evidence,
      recommendation: row.recommendation,
      result: row.result,
    })
    message.success('Loaded into editor, you can run AI Draft now')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
          <Form.Item name="result" label="Result (optional)"><Input.TextArea rows={2} /></Form.Item>
          <Space wrap>
            <Select value={language} onChange={setLanguage} options={[{value:'en',label:'English'},{value:'zh',label:'中文'},{value:'bilingual',label:'Bilingual'}]} />
            <Button onClick={() => generateDraft(form)} loading={generating}>AI Draft from Phenomenon</Button>
            <Button onClick={() => generateDraft(form)}>Retry Draft</Button>
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
            { title: 'Recommendation', dataIndex: 'recommendation' },
            {
              title: 'Action', key: 'action', width: 220,
              render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => openEdit(row)}>Edit</Button>
                  <Button size="small" onClick={() => useAiLater(row)}>Use AI Later</Button>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal title="Edit Insight" open={!!editing} onCancel={() => setEditing(null)} onOk={saveEdit} okText="Save Changes">
        <Form layout="vertical" form={editForm}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phenomenon" label="Phenomenon"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="hypothesis" label="Hypothesis"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="evidence" label="Evidence"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="recommendation" label="Recommendation"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="result" label="Result"><Input.TextArea rows={2} /></Form.Item>
          <Space>
            <Button onClick={() => generateDraft(editForm)} loading={generating}>AI Draft (Edit)</Button>
            <Button onClick={() => generateDraft(editForm)}>Retry</Button>
          </Space>
        </Form>
      </Modal>
    </>
  )
}
