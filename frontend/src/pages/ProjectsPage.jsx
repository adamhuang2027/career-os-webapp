import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, Select, Space, Table, Typography, message, Modal } from 'antd'
import { api } from '../api/client'

export default function ProjectsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [editing, setEditing] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await api.get('/projects')
    setItems(data.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const onFinish = async (values) => {
    await api.post('/projects', values)
    message.success('Project created')
    form.resetFields()
    load()
  }

  const openEdit = (row) => {
    setEditing(row)
    editForm.setFieldsValue({
      title: row.title,
      goal: row.goal,
      status: row.status,
      priority: row.priority,
      milestone: row.milestone,
      blocker: row.blocker,
      next_action: row.next_action,
    })
  }

  const saveEdit = async () => {
    const values = await editForm.validateFields()
    await api.put(`/projects/${editing.id}`, values)
    message.success('Project updated')
    setEditing(null)
    load()
  }

  return (
    <>
      <Typography.Title level={3}>Projects</Typography.Title>
      <Card title="New Project" style={{ marginBottom: 16 }}>
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="goal" label="Goal"><Input.TextArea rows={2} /></Form.Item>
          <Space style={{ width: '100%' }} align="start" wrap>
            <Form.Item name="status" label="Status" initialValue="in_progress"><Select style={{ width: 160 }} options={[{value:'in_progress'},{value:'planned'},{value:'done'}]} /></Form.Item>
            <Form.Item name="priority" label="Priority" initialValue="medium"><Select style={{ width: 160 }} options={[{value:'high'},{value:'medium'},{value:'low'}]} /></Form.Item>
          </Space>
          <Form.Item name="milestone" label="Milestone"><Input /></Form.Item>
          <Form.Item name="blocker" label="Risk / Blocker"><Input /></Form.Item>
          <Form.Item name="next_action" label="Next Action"><Input /></Form.Item>
          <Button type="primary" htmlType="submit">Save</Button>
        </Form>
      </Card>

      <Card title="Project List">
        <Table
          loading={loading}
          dataSource={items}
          rowKey="id"
          pagination={false}
          columns={[
            { title: 'Title', dataIndex: 'title' },
            { title: 'Status', dataIndex: 'status' },
            { title: 'Priority', dataIndex: 'priority' },
            { title: 'Milestone', dataIndex: 'milestone' },
            { title: 'Next Action', dataIndex: 'next_action' },
            { title: 'Action', key: 'action', width: 100, render: (_, row) => <Button size="small" onClick={() => openEdit(row)}>Edit</Button> }
          ]}
        />
      </Card>

      <Modal
        title="Edit Project"
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={saveEdit}
        okText="Save Changes"
      >
        <Form layout="vertical" form={editForm}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="goal" label="Goal"><Input.TextArea rows={2} /></Form.Item>
          <Space style={{ width: '100%' }} align="start" wrap>
            <Form.Item name="status" label="Status" initialValue="in_progress"><Select style={{ width: 160 }} options={[{value:'in_progress'},{value:'planned'},{value:'done'}]} /></Form.Item>
            <Form.Item name="priority" label="Priority" initialValue="medium"><Select style={{ width: 160 }} options={[{value:'high'},{value:'medium'},{value:'low'}]} /></Form.Item>
          </Space>
          <Form.Item name="milestone" label="Milestone"><Input /></Form.Item>
          <Form.Item name="blocker" label="Risk / Blocker"><Input /></Form.Item>
          <Form.Item name="next_action" label="Next Action"><Input /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}
