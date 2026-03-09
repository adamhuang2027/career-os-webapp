import { useEffect, useMemo, useState } from 'react'
import { Button, Card, DatePicker, Form, Input, Select, Table, Typography, Modal, Tag, Row, Col, Statistic, message } from 'antd'
import dayjs from 'dayjs'
import { api } from '../api/client'

export default function PeoplePage() {
  const [items, setItems] = useState([])
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [editing, setEditing] = useState(null)

  const load = async () => {
    const { data } = await api.get('/people')
    setItems(data.data)
  }
  useEffect(() => { load() }, [])

  const onFinish = async (values) => {
    await api.post('/people', {
      ...values,
      next_followup_date: values.next_followup_date?.format('YYYY-MM-DD')
    })
    form.resetFields()
    load()
  }

  const openEdit = (row) => {
    setEditing(row)
    editForm.setFieldsValue({
      ...row,
      next_followup_date: row.next_followup_date ? dayjs(row.next_followup_date) : null
    })
  }

  const saveEdit = async () => {
    const values = await editForm.validateFields()
    await api.put(`/people/${editing.id}`, {
      ...values,
      next_followup_date: values.next_followup_date?.format('YYYY-MM-DD')
    })
    message.success('Contact updated')
    setEditing(null)
    load()
  }

  const stats = useMemo(() => {
    const strong = items.filter(x => x.relationship_level === 'strong').length
    const medium = items.filter(x => x.relationship_level === 'medium').length
    const weak = items.filter(x => x.relationship_level === 'weak').length
    const byTeam = {}
    for (const x of items) {
      const key = x.team || 'Unknown'
      byTeam[key] = (byTeam[key] || 0) + 1
    }
    return { strong, medium, weak, byTeam }
  }, [items])

  return (
    <>
      <Typography.Title level={3}>People / Resource Map</Typography.Title>

      <Card title="Relationship Overview" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={8}><Statistic title="Strong" value={stats.strong} /></Col>
          <Col xs={8}><Statistic title="Medium" value={stats.medium} /></Col>
          <Col xs={8}><Statistic title="Weak" value={stats.weak} /></Col>
          <Col span={24}>
            <Typography.Text type="secondary">By Team:</Typography.Text>
            <div style={{ marginTop: 8 }}>
              {Object.entries(stats.byTeam).map(([team, count]) => (
                <Tag key={team} color="blue" style={{ marginBottom: 6 }}>{team}: {count}</Tag>
              ))}
            </div>
          </Col>
        </Row>
      </Card>

      <Card title="New Contact" style={{ marginBottom: 16 }}>
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="role" label="Role"><Input /></Form.Item>
          <Form.Item name="team" label="Team"><Input /></Form.Item>
          <Form.Item name="relationship_level" label="Relationship"><Select options={[{value:'strong'},{value:'medium'},{value:'weak'}]} /></Form.Item>
          <Form.Item name="current_topics" label="Current Topics"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="value_exchange" label="Value I Can Offer"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="next_followup_date" label="Next Follow-up"><DatePicker /></Form.Item>
          <Button type="primary" htmlType="submit">Save Contact</Button>
        </Form>
      </Card>
      <Card title="Contact List">
        <Table
          dataSource={items}
          rowKey="id"
          pagination={false}
          columns={[
            { title: 'Name', dataIndex: 'name' },
            { title: 'Role', dataIndex: 'role' },
            { title: 'Team', dataIndex: 'team' },
            { title: 'Relationship', dataIndex: 'relationship_level' },
            { title: 'Next Follow-up', dataIndex: 'next_followup_date' },
            { title: 'Action', key: 'action', width: 100, render: (_, row) => <Button size="small" onClick={() => openEdit(row)}>Edit</Button> }
          ]}
        />
      </Card>

      <Modal title="Edit Contact" open={!!editing} onCancel={() => setEditing(null)} onOk={saveEdit} okText="Save Changes">
        <Form layout="vertical" form={editForm}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="role" label="Role"><Input /></Form.Item>
          <Form.Item name="team" label="Team"><Input /></Form.Item>
          <Form.Item name="relationship_level" label="Relationship"><Select options={[{value:'strong'},{value:'medium'},{value:'weak'}]} /></Form.Item>
          <Form.Item name="current_topics" label="Current Topics"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="value_exchange" label="Value I Can Offer"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="next_followup_date" label="Next Follow-up"><DatePicker /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}
