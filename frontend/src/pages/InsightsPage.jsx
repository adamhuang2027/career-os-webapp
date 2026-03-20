import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Modal, Select, Space, Table, Typography, message, Tag } from 'antd'
import { api } from '../api/client'

const DRAFT_KEY = 'careeros:insight-draft'

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

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (!saved) return
    try {
      const d = JSON.parse(saved)
      form.setFieldsValue(d.form || {})
      setLanguage(d.language || 'en')
    } catch {}
  }, [form])

  useEffect(() => {
    const t = setInterval(() => {
      const current = form.getFieldsValue()
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form: current, language }))
    }, 1500)
    return () => clearInterval(t)
  }, [form, language])

  const onFinish = async (values) => {
    await api.post('/insights', values)
    form.resetFields()
    localStorage.removeItem(DRAFT_KEY)
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

  const handleEvidencePaste = (targetForm) => async (e) => {
    const items = e.clipboardData?.items || []
    const imageItem = Array.from(items).find((it) => it.type?.startsWith('image/'))
    if (!imageItem) return

    e.preventDefault()
    const file = imageItem.getAsFile()
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      message.warning('Image is large (>2MB). Consider compressing for better performance.')
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const current = targetForm.getFieldValue('evidence') || ''
      const next = `${current}${current ? '\n\n' : ''}![screenshot](${dataUrl})`
      targetForm.setFieldValue('evidence', next)
      message.success('Screenshot pasted into Evidence')
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <Typography.Title level={3}>Insights</Typography.Title>
      <Card title="New Insight" style={{ marginBottom: 16 }}>
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phenomenon" label="Phenomenon"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="hypothesis" label="Hypothesis"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="evidence" label="Evidence">
            <Input.TextArea rows={3} onPaste={handleEvidencePaste(form)} placeholder="You can paste screenshot directly here (Ctrl/Cmd+V)." />
          </Form.Item>
          <Form.Item name="recommendation" label="Recommendation"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="result" label="Result (optional)"><Input.TextArea rows={2} /></Form.Item>
          <Space wrap>
            <Select value={language} onChange={setLanguage} options={[{value:'en',label:'English'},{value:'zh',label:'Chinese'},{value:'bilingual',label:'Bilingual'}]} />
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
          <Form.Item name="evidence" label="Evidence">
            <Input.TextArea rows={3} onPaste={handleEvidencePaste(editForm)} placeholder="You can paste screenshot directly here (Ctrl/Cmd+V)." />
          </Form.Item>
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
