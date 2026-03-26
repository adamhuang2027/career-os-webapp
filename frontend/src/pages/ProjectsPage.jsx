import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Form, Input, Select, Space, Table, Typography, message, Modal, DatePicker, Tag, Slider } from 'antd'
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
  const [expandedProjectKeys, setExpandedProjectKeys] = useState([])
  const [timelineScrollPct, setTimelineScrollPct] = useState(0)
  const timelineScrollRef = useRef(null)

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
    if (!ganttData.length) return []

    const starts = ganttData.map((p) => dayjs(p.project_start))
    const ends = ganttData.map((p) => dayjs(p.project_end))
    const globalStart = starts.reduce((min, d) => (d.isBefore(min) ? d : min), starts[0]).startOf('month')
    const globalEnd = ends.reduce((max, d) => (d.isAfter(max) ? d : max), ends[0]).endOf('month')
    const globalTotalDays = Math.max(1, globalEnd.diff(globalStart, 'day') + 1)

    const monthTicks = []
    let cursor = globalStart.startOf('month')
    while (cursor.isBefore(globalEnd) || cursor.isSame(globalEnd, 'day')) {
      monthTicks.push(cursor)
      cursor = cursor.add(1, 'month')
    }

    const timelineWidth = Math.max(720, monthTicks.length * 96)

    const renderTimeline = ({ leftPct, widthPct, color, showLabels = false, keyPrefix = 'tick' }) => (
      <div style={{ width: timelineWidth }}>
        <div style={{ position: 'relative', height: 22, background: '#f3f4f6', borderRadius: 8, overflow: 'hidden' }}>
          {monthTicks.map((m) => {
            const x = Math.max(0, m.diff(globalStart, 'day')) / globalTotalDays * 100
            const yearStart = m.month() === 0
            return (
              <div
                key={`${keyPrefix}-line-${m.format('YYYY-MM')}`}
                style={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: 0,
                  width: 1,
                  height: 22,
                  background: yearStart ? '#9ca3af' : '#d1d5db'
                }}
              />
            )
          })}
          <div style={{ position: 'absolute', left: `${leftPct}%`, top: 0, width: `${widthPct}%`, height: 22, borderRadius: 8, background: color }} />
        </div>
        {showLabels && (
          <div style={{ position: 'relative', height: 18, marginTop: 6 }}>
            {monthTicks.map((m) => {
              const x = Math.max(0, m.diff(globalStart, 'day')) / globalTotalDays * 100
              const label = m.month() === 0 ? m.format('YYYY-MM') : m.format('MM')
              const yearStart = m.month() === 0
              return (
                <div key={`${keyPrefix}-label-${m.format('YYYY-MM')}`}>
                  <div style={{ position: 'absolute', left: `${x}%`, top: -30, width: 1, height: 30, background: yearStart ? '#6b7280' : '#d1d5db' }} />
                  <div style={{ position: 'absolute', left: `${x}%`, top: 0, transform: 'translateX(-10%)', fontSize: 11, color: yearStart ? '#374151' : '#6b7280' }}>{label}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )

    return ganttData.map((p) => {
      const projectStart = dayjs(p.project_start)
      const projectEnd = dayjs(p.project_end)
      const projectTotal = Math.max(1, projectEnd.diff(projectStart, 'day') + 1)

      const tasks = p.tasks || []
      const doneCount = tasks.filter(t => t.status === 'done').length
      const progressPct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0

      const subtaskRows = tasks.map((t) => {
        const ts = dayjs(t.start_date)
        const te = dayjs(t.end_date || t.start_date)
        const days = Math.max(1, te.diff(ts, 'day') + 1)
        const left = Math.max(0, ts.diff(globalStart, 'day')) / globalTotalDays * 100
        const width = Math.max(2, days / globalTotalDays * 100)
        const color = t.status === 'done' ? '#16a34a' : t.status === 'in_progress' ? '#2563eb' : '#94a3b8'
        return {
          id: t.id,
          title: t.title,
          start: ts.format('YYYY-MM-DD'),
          end: te.format('YYYY-MM-DD'),
          days,
          bar: renderTimeline({ leftPct: left, widthPct: width, color, keyPrefix: `subtask-${t.id}` })
        }
      })

      const actualDays = subtaskRows.reduce((sum, row) => sum + (row.days || 0), 0)

      const projectLeft = Math.max(0, projectStart.diff(globalStart, 'day')) / globalTotalDays * 100
      const projectWidth = Math.max(2, projectTotal / globalTotalDays * 100)
      const summaryTimeline = renderTimeline({
        leftPct: projectLeft,
        widthPct: projectWidth,
        color: '#2563eb',
        showLabels: true,
        keyPrefix: `project-${p.project_id}`,
      })

      return {
        ...p,
        rowType: 'project',
        date_range: `${projectStart.format('YYYY-MM-DD')} ~ ${projectEnd.format('YYYY-MM-DD')}`,
        total_days: projectTotal,
        actual_days: actualDays,
        progress_pct: progressPct,
        timeline: summaryTimeline,
        subtask_rows: subtaskRows,
        children: subtaskRows.map((s) => ({
          key: `subtask-${s.id}`,
          rowType: 'subtask',
          project_id: p.project_id,
          project_title: '',
          subtask_title: s.title,
          start: s.start,
          end: s.end,
          days: s.days,
          progress_pct: '',
          timeline: s.bar,
        })),
      }
    })
  }, [ganttData])

  return (
    <div className="premium-page">
      <Typography.Title level={3}>Projects</Typography.Title>

      <Card title="Project Gantt (by sub-task timeline)" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 10 }}>
          <Typography.Text type="secondary">Timeline Window</Typography.Text>
          <Slider
            min={0}
            max={100}
            step={1}
            value={timelineScrollPct}
            tooltip={{ formatter: (v) => `${v}%` }}
            onChange={(v) => {
              const value = Array.isArray(v) ? v[0] : v
              setTimelineScrollPct(value)
              const el = timelineScrollRef.current
              if (!el) return
              const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
              el.scrollLeft = (value / 100) * maxScroll
            }}
          />
        </div>

        <div
          ref={timelineScrollRef}
          style={{ overflowX: 'auto' }}
          onScroll={(e) => {
            const el = e.currentTarget
            const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
            const pct = maxScroll ? Math.round((el.scrollLeft / maxScroll) * 100) : 0
            setTimelineScrollPct(pct)
          }}
        >
        <Table
          loading={loading}
          dataSource={ganttRows}
          rowKey={(r) => r.rowType === 'subtask' ? r.key : r.project_id}
          pagination={false}
          columns={[
            {
              title: 'Project / Subtask',
              width: 240,
              render: (_, r) => r.rowType === 'subtask' ? r.subtask_title : r.project_title
            },
            {
              title: 'Date Range',
              width: 240,
              render: (_, r) => r.rowType === 'subtask' ? `${r.start} ~ ${r.end}` : r.date_range
            },
            {
              title: 'Actual Days',
              width: 120,
              render: (_, r) => r.rowType === 'subtask' ? r.days : r.actual_days
            },
            {
              title: 'Progress',
              width: 100,
              render: (_, r) => r.rowType === 'subtask' ? '-' : `${r.progress_pct}%`
            },
            {
              title: 'Timeline',
              dataIndex: 'timeline',
              render: (v, r) => {
                if (r.rowType === 'project' && expandedProjectKeys.includes(r.project_id)) return null
                return v
              }
            },
          ]}
          expandable={{
            expandedRowKeys: expandedProjectKeys,
            onExpand: (expanded, record) => {
              if (record.rowType === 'subtask') return
              const key = record.project_id
              setExpandedProjectKeys(prev => expanded ? [...prev, key] : prev.filter(k => k !== key))
            },
            rowExpandable: (record) => record.rowType === 'project' && (record.children || []).length > 0,
          }}
        />
        </div>
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
    </div>
  )
}
