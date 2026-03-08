import { useEffect, useState } from 'react'
import { Button, Card, DatePicker, Form, Input, Select, Table, Typography } from 'antd'
import { api } from '../api/client'

export default function PeoplePage() {
  const [items, setItems] = useState([])
  const [form] = Form.useForm()

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

  return (
    <>
      <Typography.Title level={3}>People / Resource Map</Typography.Title>
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
            { title: 'Relationship', dataIndex: 'relationship_level' },
            { title: 'Next Follow-up', dataIndex: 'next_followup_date' }
          ]}
        />
      </Card>
    </>
  )
}
