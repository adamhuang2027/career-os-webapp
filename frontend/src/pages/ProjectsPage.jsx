import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Form, Input, Select, Space, Table, Typography, message, Modal, DatePicker, Tag } from 'antd'
import dayjs from 'dayjs'
import { api } from '../api/client'

export default function ProjectsPage() {
  const [items, setItems] = useState([])
  const [ganttData, setGanttData] = useState([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [taskForm] = Form.useForm()
  const [editingTaskForm] = Form.useForm()
  const [editing, setEditing] = useState(null)
  const [parentOptions, setParentOptions] = useState([])

  const [taskProject, setTaskProject] = useState(null)
  const [taskRows, setTaskRows] = useState([])
  const [editingTask, setEditingTask] = useState(null)

  const load = async () => {
    setLoading(true)
    const [{ data: p }, { data: g }] = await Promise.all([
      api.get('/projects'),
      api.get('/projects/gantt')
    ])
    setItems(p.data)
    setParentOptions((p.data || []).map(x => ({ value: x.id, label: x.title })))
    setGanttData(g.data || [])
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
    editForm.setFieldsValue({ ...row })
  }

  const saveEdit = async () => {
    const values = await editForm.validateFields()
    await api.put(`/projects/${editing.id}`, values)
    message.success('Project updated')
    setEditing(null)
    load()
  }

  const openTasks = async (project) => {
    setTaskProject(project)
    setEditingTask(null)
    taskForm.resetFields()
    taskForm.setFieldsValue({ status: 'planned' })
    const { data } = await api.get(`/projects/${project.id}/tasks`)
    setTaskRows(data.data || [])
  }

  const refreshTasks = async () => {
    if (!taskProject) return
    const { data } = await api.get(`/projects/${taskProject.id}/tasks`)
    setTaskRows(data.data || [])
  }

  const addTask = async () => {
    const values = await taskForm.validateFields()
    await api.post(`/projects/${taskProject.id}/tasks`, {
      ...values,
      start_date: values.start_date?.format('YYYY-MM-DD'),
      end_date: values.end_date?.format('YYYY-MM-DD')
    })
    message.success('Task added')
    taskForm.resetFields()
    await refreshTasks()
    await load()
  }

  const openEditTask = (row) => {
    setEditingTask(row)
    editingTaskForm.setFieldsValue({
      ...row,
      start_date: row.start_date ? dayjs(row.start_date) : null,
      end_date: row.end_date ? dayjs(row.end_date) : null,
    })
  }

  const saveEditTask = async () => {
    const values = await editingTaskForm.validateFields()
    await api.put(`/projects/${taskProject.id}/tasks/${editingTask.id}`, {
      ...values,
      start_date: values.start_date?.format('YYYY-MM-DD'),
      end_date: values.end_date?.format('YYYY-MM-DD')
    })
    message.success('Task updated')
    setEditingTask(null)
    await refreshTasks()
    await load()
  }

  const deleteTask = async (row) => {
    await api.delete(`/projects/${taskProject.id}/tasks/${row.id}`)
    message.success('Task deleted')
    await refreshTasks()
    await load()
  }

  const ganttRows = useMemo(() => {
    return ganttData.map(p => {
      const start = dayjs(p.project_start)
      const end = dayjs(p.project_end)
      const total = Math.max(1, end.diff(start, 'day') + 1)

      const monthTicks = []
      let cursor = start.startOf('month')
      if (cursor.isBefore(start, 'day')) cursor = cursor.add(1, 'month')
      while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
        monthTicks.push(cursor)
        cursor = cursor.add(1, 'month')
      }

      return {
        ...p,
        total_days: total,
        timeline: (
          <div style={{ minWidth: 640 }}>
            <div style={{ position: 'relative', paddingBottom: 26 }}>
              {monthTicks.map((m) => {
                const x = Math.max(0, m.diff(start, 'day')) / total * 100
                const yearStart = m.month() === 0
                return (
                  <div key={m.format('YYYY-MM')}
                    style={{ position: 'absolute', left: `${x}%`, top: 0, bottom: 24, width: 1, background: yearStart ? '#6b7280' : '#d1d5db' }}
                  />
                )
              })}

              {p.tasks.map((t) => {
                const ts = dayjs(t.start_date)
                const te = dayjs(t.end_date || t.start_date)
                const left = Math.max(0, ts.diff(start, 'day')) / total * 100
                const width = Math.max(3, (te.diff(ts, 'day') + 1) / total * 100)
                const color = t.status === 'done' ? '#16a34a' : t.status === 'in_progress' ? '#2563eb' : '#94a3b8'
                return (
                  <div key={t.id} style={{ position: 'relative', height: 30, marginBottom: 10 }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 4, height: 22, background: '#f3f4f6', borderRadius: 8 }} />
                    <div style={{ position: 'absolute', left: `${left}%`, top: 4, width: `${width}%`, height: 22, borderRadius: 8, background: color }} />
                    <div style={{ position: 'absolute', left: 8, top: 6, fontSize: 12, color: '#111827' }}>
                      {t.title} · {`${ts.format('YYYY-MM-DD')} → ${te.format('YYYY-MM-DD')}`}
                    </div>
                  </div>
                )
              })}

              <div style={{ position: 'relative', height: 20, marginTop: 2 }}>
                {monthTicks.map((m) => {
                  const x = Math.max(0, m.diff(start, 'day')) / total * 100
                  const label = m.month() === 0 ? m.format('YYYY-MM') : m.format('MM')
                  return (
                    <div key={`label-${m.format('YYYY-MM')}`} style={{ position: 'absolute', left: `${x}%`, top: 2, transform: 'translateX(-10%)', fontSize: 11, color: m.month() === 0 ? '#374151' : '#6b7280' }}>
                      {label}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      }
    })
  }, [ganttData])

  return (
    <>
      <Typography.Title level={3}>Projects</Typography.Title>

      <Card title="Project Gantt (by sub-task timeline)" style={{ marginBottom: 16 }}>
        <Table
          loading={loading}
          dataSource={ganttRows}
          rowKey="project_id"
          pagination={false}
          columns={[
            { title: 'Project', dataIndex: 'project_title', width: 240 },
            { title: 'Start', dataIndex: 'project_start', width: 120 },
            { title: 'End', dataIndex: 'project_end', width: 120 },
            { title: 'Total Days', dataIndex: 'total_days', width: 110 },
            { title: 'Timeline', dataIndex: 'timeline' },
          ]}
        />
      </Card>

      <Card title="New Project" style={{ marginBottom: 16 }}>
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <Form.Item name="parent_id" label="Parent Project (optional)"><Select allowClear options={parentOptions} placeholder="Select a parent project" /></Form.Item>
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
            { title: 'Parent', dataIndex: 'parent_title', render: (v) => v || '-' },
            { title: 'Status', dataIndex: 'status' },
            { title: 'Priority', dataIndex: 'priority' },
            { title: 'Milestone', dataIndex: 'milestone' },
            { title: 'Next Action', dataIndex: 'next_action' },
            {
              title: 'Action', key: 'action', width: 220, render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => openEdit(row)}>Edit</Button>
                  <Button size="small" onClick={() => openTasks(row)}>Tasks</Button>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal title="Edit Project" open={!!editing} onCancel={() => setEditing(null)} onOk={saveEdit} okText="Save Changes">
        <Form layout="vertical" form={editForm}>
          <Form.Item name="parent_id" label="Parent Project (optional)"><Select allowClear options={(parentOptions || []).filter(o => o.value !== editing?.id)} placeholder="Select a parent project" /></Form.Item>
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

      <Modal
        title={taskProject ? `Tasks · ${taskProject.title}` : 'Tasks'}
        open={!!taskProject}
        onCancel={() => setTaskProject(null)}
        onOk={addTask}
        okText="Add Task"
        width={980}
      >
        <Form layout="vertical" form={taskForm}>
          <Space align="start" wrap>
            <Form.Item name="title" label="Task" rules={[{ required: true }]}><Input style={{ width: 220 }} /></Form.Item>
            <Form.Item name="stage" label="Stage"><Input style={{ width: 140 }} placeholder="Design/Build/Test" /></Form.Item>
            <Form.Item name="status" label="Status" initialValue="planned"><Select style={{ width: 140 }} options={[{value:'planned'},{value:'in_progress'},{value:'done'}]} /></Form.Item>
            <Form.Item name="start_date" label="Start" rules={[{ required: true }]}><DatePicker /></Form.Item>
            <Form.Item name="end_date" label="End"><DatePicker /></Form.Item>
          </Space>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>

        <Table
          rowKey="id"
          dataSource={taskRows}
          pagination={{ pageSize: 6 }}
          columns={[
            { title: 'Task', dataIndex: 'title' },
            { title: 'Stage', dataIndex: 'stage', render: (v) => v || '-' },
            { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={v === 'done' ? 'green' : v === 'in_progress' ? 'blue' : 'default'}>{v}</Tag> },
            { title: 'Start', dataIndex: 'start_date' },
            { title: 'End', dataIndex: 'end_date', render: (v) => v || '-' },
            {
              title: 'Action', width: 150, render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => openEditTask(row)}>Edit</Button>
                  <Button size="small" danger onClick={() => deleteTask(row)}>Delete</Button>
                </Space>
              )
            }
          ]}
        />
      </Modal>

      <Modal title="Edit Task" open={!!editingTask} onCancel={() => setEditingTask(null)} onOk={saveEditTask} okText="Save Task">
        <Form layout="vertical" form={editingTaskForm}>
          <Form.Item name="title" label="Task" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="stage" label="Stage"><Input /></Form.Item>
          <Form.Item name="status" label="Status"><Select options={[{value:'planned'},{value:'in_progress'},{value:'done'}]} /></Form.Item>
          <Space align="start" wrap>
            <Form.Item name="start_date" label="Start" rules={[{ required: true }]}><DatePicker /></Form.Item>
            <Form.Item name="end_date" label="End"><DatePicker /></Form.Item>
          </Space>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}
