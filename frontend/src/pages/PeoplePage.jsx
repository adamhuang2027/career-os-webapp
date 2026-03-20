import { useEffect, useMemo, useState } from 'react'
import { Button, Card, DatePicker, Form, Input, Select, Table, Typography, Modal, Tag, Row, Col, Statistic, message, Progress, List, Space, Popconfirm } from 'antd'
import dayjs from 'dayjs'
import { api } from '../api/client'

export default function PeoplePage() {
  const [items, setItems] = useState([])
  const [graphPeriod, setGraphPeriod] = useState('week')
  const [graphTeam, setGraphTeam] = useState('all')
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [connectForm] = Form.useForm()
  const [editConnectForm] = Form.useForm()
  const [editing, setEditing] = useState(null)
  const [showNewContact, setShowNewContact] = useState(false)
  const [connectTarget, setConnectTarget] = useState(null)
  const [connectLogs, setConnectLogs] = useState([])
  const [editingLog, setEditingLog] = useState(null)

  const load = async () => {
    const { data } = await api.get('/people', { params: { period: graphPeriod } })
    setItems(data.data)
  }
  useEffect(() => { load() }, [graphPeriod])

  const onFinish = async (values) => {
    await api.post('/people', {
      ...values,
      next_followup_date: values.next_followup_date?.format('YYYY-MM-DD')
    })
    form.resetFields()
    setShowNewContact(false)
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

  const refreshConnectLogs = async (personId) => {
    const { data } = await api.get(`/people/${personId}/connect-logs`)
    setConnectLogs(data.data || [])
  }

  const openConnectLogs = async (row) => {
    setConnectTarget(row)
    setEditingLog(null)
    connectForm.setFieldsValue({ connect_date: dayjs(), channel: 'Slack' })
    await refreshConnectLogs(row.id)
  }

  const saveConnectLog = async () => {
    const values = await connectForm.validateFields()
    await api.post(`/people/${connectTarget.id}/connect-logs`, {
      connect_date: values.connect_date?.format('YYYY-MM-DD'),
      channel: values.channel,
      summary: values.summary,
      notes: values.notes,
    })
    connectForm.resetFields(['summary', 'notes'])
    connectForm.setFieldValue('connect_date', dayjs())
    message.success('Connect log saved')
    await refreshConnectLogs(connectTarget.id)
    load()
  }

  const openEditConnectLog = (row) => {
    setEditingLog(row)
    editConnectForm.setFieldsValue({
      connect_date: row.connect_date ? dayjs(row.connect_date) : dayjs(),
      channel: row.channel,
      summary: row.summary,
      notes: row.notes,
    })
  }

  const saveEditConnectLog = async () => {
    const values = await editConnectForm.validateFields()
    await api.put(`/people/${connectTarget.id}/connect-logs/${editingLog.id}`, {
      connect_date: values.connect_date?.format('YYYY-MM-DD'),
      channel: values.channel,
      summary: values.summary,
      notes: values.notes,
    })
    message.success('Connect log updated')
    setEditingLog(null)
    await refreshConnectLogs(connectTarget.id)
    load()
  }

  const deleteConnectLog = async (logId) => {
    await api.delete(`/people/${connectTarget.id}/connect-logs/${logId}`)
    message.success('Connect log deleted')
    await refreshConnectLogs(connectTarget.id)
    load()
  }

  const stats = useMemo(() => {
    const strong = items.filter(x => x.relationship_level === 'strong').length
    const medium = items.filter(x => x.relationship_level === 'medium').length
    const weak = items.filter(x => x.relationship_level === 'weak').length
    const byTeam = {}
    for (const x of items) {
      const key = x.team || 'Unknown'
      byTeam[key] = byTeam[key] || { total: 0, strong: 0, medium: 0, weak: 0 }
      byTeam[key].total += 1
      const level = x.relationship_level || 'weak'
      byTeam[key][level] = (byTeam[key][level] || 0) + 1
    }

    const teamRows = Object.entries(byTeam).map(([team, s]) => ({
      team,
      ...s,
      strengthScore: s.total ? Math.round(((s.strong * 1 + s.medium * 0.6 + s.weak * 0.2) / s.total) * 100) : 0
    })).sort((a, b) => a.strengthScore - b.strengthScore)

    return { strong, medium, weak, byTeam, teamRows }
  }, [items])

  const followups = useMemo(() => {
    const today = dayjs().startOf('day')
    return [...items]
      .filter(x => x.next_followup_date)
      .map(x => {
        const d = dayjs(x.next_followup_date)
        const diff = d.diff(today, 'day')
        let bucket = 'later'
        if (diff < 0) bucket = 'overdue'
        else if (diff <= 7) bucket = 'next7'
        else if (diff <= 14) bucket = 'next14'
        return { ...x, diff, bucket }
      })
      .sort((a, b) => a.diff - b.diff)
  }, [items])

  const topConnectors = useMemo(() => {
    const map = {}
    for (const x of items) {
      const key = x.team || 'Unknown'
      map[key] = map[key] || []
      map[key].push(x)
    }
    return Object.entries(map).map(([team, people]) => ({
      team,
      people: people
        .sort((a, b) => (b.connect_count || 0) - (a.connect_count || 0))
        .slice(0, 3)
    }))
  }, [items])

  const graphTeamOptions = useMemo(() => {
    const teams = [...new Set(items.map(p => p.team || 'Unknown'))]
    return [{ value: 'all', label: 'All Teams' }, ...teams.map(t => ({ value: t, label: t }))]
  }, [items])

  useEffect(() => {
    if (!graphTeamOptions.find(x => x.value === graphTeam)) {
      setGraphTeam('all')
    }
  }, [graphTeamOptions, graphTeam])

  const networkGraph = useMemo(() => {
    const width = 980
    const height = 520
    const cx = width / 2
    const cy = height / 2

    const periodScoped = ['week', 'month', 'year'].includes(graphPeriod)
      ? items.filter(p => Number(p.connect_count || 0) > 0)
      : items
    const teamScoped = graphTeam === 'all'
      ? periodScoped
      : periodScoped.filter(p => (p.team || 'Unknown') === graphTeam)

    const people = teamScoped.slice(0, 24)
    const teams = [...new Set(people.map(p => p.team || 'Unknown'))]

    const teamConnectTotals = {}
    for (const p of people) {
      const team = p.team || 'Unknown'
      teamConnectTotals[team] = (teamConnectTotals[team] || 0) + Number(p.connect_count || 0)
    }

    const maxPersonConnect = Math.max(1, ...people.map(p => Number(p.connect_count || 0)))
    const maxTeamConnect = Math.max(1, ...teams.map(t => Number(teamConnectTotals[t] || 0)))

    const teamRadius = Math.min(width, height) * 0.38
    const personRadius = Math.min(width, height) * 0.24

    const teamNodes = teams.map((team, i) => {
      const angle = (2 * Math.PI * i) / Math.max(teams.length, 1)
      const connectTotal = Number(teamConnectTotals[team] || 0)
      const sizeRatio = connectTotal / maxTeamConnect
      const nodeR = 12 + sizeRatio * 16
      return {
        id: `team-${team}`,
        type: 'team',
        label: team,
        connectTotal,
        r: nodeR,
        x: cx + teamRadius * Math.cos(angle),
        y: cy + teamRadius * Math.sin(angle),
      }
    })

    const personNodes = people.map((p, i) => {
      const angle = (2 * Math.PI * i) / Math.max(people.length, 1)
      const connectCount = Number(p.connect_count || 0)
      const sizeRatio = connectCount / maxPersonConnect
      const nodeR = 9 + sizeRatio * 12
      return {
        id: `person-${p.id}`,
        type: 'person',
        label: p.name || `P${p.id}`,
        relation: p.relationship_level || 'weak',
        team: p.team || 'Unknown',
        connectCount,
        r: nodeR,
        x: cx + personRadius * Math.cos(angle),
        y: cy + personRadius * Math.sin(angle),
      }
    })

    const centerNode = { id: 'me', type: 'me', label: 'Adam', x: cx, y: cy }

    const edges = []
    for (const p of personNodes) {
      edges.push({ from: centerNode, to: p, type: 'ownership', strength: Math.min(6, 1 + p.connectCount * 0.5) })
      const t = teamNodes.find(x => x.label === p.team)
      if (t) edges.push({ from: p, to: t, type: 'team', strength: 1 })
    }

    return { width, height, centerNode, personNodes, teamNodes, edges }
  }, [items, graphPeriod, graphTeam])

  return (
    <>
      <Typography.Title level={3}>People / Resource Map</Typography.Title>

      <Card
        title="Relationship Graph (Nodes & Edges)"
        extra={
          <Space>
            <Typography.Text type="secondary">Period</Typography.Text>
            <Select
              size="small"
              value={graphPeriod}
              onChange={setGraphPeriod}
              style={{ width: 120 }}
              options={[
                { value: 'week', label: 'Weekly' },
                { value: 'month', label: 'Monthly' },
                { value: 'year', label: 'Yearly' },
              ]}
            />
            <Typography.Text type="secondary">Team</Typography.Text>
            <Select
              size="small"
              value={graphTeam}
              onChange={setGraphTeam}
              style={{ width: 160 }}
              options={graphTeamOptions}
            />
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Typography.Text type="secondary">Edge thickness is based on connect count within the selected period. Nodes with zero connects in that period are hidden.</Typography.Text>
        <div style={{ overflowX: 'auto', marginTop: 10, border: '1px solid #f0f0f0', borderRadius: 8, background: '#fff' }}>
          <svg width={networkGraph.width} height={networkGraph.height}>
            {networkGraph.edges.map((e, i) => (
              <line
                key={i}
                x1={e.from.x}
                y1={e.from.y}
                x2={e.to.x}
                y2={e.to.y}
                stroke={e.type === 'team' ? '#93c5fd' : '#94a3b8'}
                strokeDasharray={e.type === 'team' ? '4 4' : '0'}
                strokeWidth={e.strength}
              />
            ))}

            {networkGraph.teamNodes.map((n) => (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={n.r} fill="#e0f2fe" stroke="#0284c7" />
                <text x={n.x} y={n.y + n.r + 14} textAnchor="middle" fontSize="11" fill="#0f172a">{n.label} ({n.connectTotal})</text>
              </g>
            ))}

            {networkGraph.personNodes.map((n) => (
              <g key={n.id}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={n.relation === 'strong' ? '#86efac' : n.relation === 'medium' ? '#fde68a' : '#e5e7eb'}
                  stroke="#334155"
                />
                <text x={n.x} y={n.y - (n.r + 6)} textAnchor="middle" fontSize="10" fill="#0f172a">{n.label} ({n.connectCount})</text>
              </g>
            ))}

            <g>
              <circle cx={networkGraph.centerNode.x} cy={networkGraph.centerNode.y} r={18} fill="#2563eb" />
              <text x={networkGraph.centerNode.x} y={networkGraph.centerNode.y + 4} textAnchor="middle" fontSize="11" fill="#fff">Adam</text>
            </g>
          </svg>
        </div>
      </Card>

      <Card title="Relationship Overview" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={8}><Statistic title="Strong" value={stats.strong} /></Col>
          <Col xs={8}><Statistic title="Medium" value={stats.medium} /></Col>
          <Col xs={8}><Statistic title="Weak" value={stats.weak} /></Col>
          <Col span={24}>
            <Typography.Text type="secondary">By Team:</Typography.Text>
            <div style={{ marginTop: 8 }}>
              {Object.entries(stats.byTeam).map(([team, count]) => (
                <Tag key={team} color="blue" style={{ marginBottom: 6 }}>{team}: {count.total}</Tag>
              ))}
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Follow-up Timeline (Next 14 Days)">
            <List
              dataSource={followups.filter(x => x.bucket === 'overdue' || x.bucket === 'next7' || x.bucket === 'next14').slice(0, 20)}
              locale={{ emptyText: 'No scheduled follow-ups in next 14 days.' }}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Space>
                      <Typography.Text strong>{item.name}</Typography.Text>
                      <Tag>{item.team || 'Unknown'}</Tag>
                      <Tag color={item.bucket === 'overdue' ? 'red' : item.bucket === 'next7' ? 'gold' : 'blue'}>
                        {item.bucket === 'overdue' ? `Overdue ${Math.abs(item.diff)}d` : `In ${item.diff}d`}
                      </Tag>
                    </Space>
                    <Typography.Text type="secondary">{item.role || '-'} · {item.next_followup_date}</Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Team Relationship Heatmap">
            <List
              dataSource={stats.teamRows}
              renderItem={(row) => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Typography.Text>{row.team}</Typography.Text>
                      <Typography.Text type="secondary">{row.strong}/{row.total} strong</Typography.Text>
                    </Space>
                    <Progress percent={row.strengthScore} size="small" status={row.strengthScore < 55 ? 'exception' : 'normal'} />
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Network Snapshot (Top Contacts by Team)" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          {topConnectors.map(group => (
            <Col xs={24} md={12} xl={8} key={group.team}>
              <Card size="small" title={group.team}>
                {group.people.map(p => (
                  <div key={p.id} style={{ marginBottom: 8 }}>
                    <Typography.Text>{p.name}</Typography.Text>
                    <Tag style={{ marginLeft: 8 }} color={p.relationship_level === 'strong' ? 'green' : p.relationship_level === 'medium' ? 'gold' : 'default'}>{p.relationship_level || 'weak'}</Tag>
                    <Tag color="blue">connects: {p.connect_count || 0}</Tag>
                  </div>
                ))}
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card
        title="Contact List"
        extra={<Button type="primary" onClick={() => setShowNewContact(true)}>New Contact</Button>}
      >
        <Table
          dataSource={items}
          rowKey="id"
          pagination={false}
          columns={[
            {
              title: 'Name', dataIndex: 'name',
              sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
              defaultSortOrder: 'ascend'
            },
            {
              title: 'Role', dataIndex: 'role',
              sorter: (a, b) => (a.role || '').localeCompare(b.role || '')
            },
            {
              title: 'Team', dataIndex: 'team',
              sorter: (a, b) => (a.team || '').localeCompare(b.team || '')
            },
            {
              title: 'Relationship', dataIndex: 'relationship_level',
              sorter: (a, b) => (a.relationship_level || '').localeCompare(b.relationship_level || '')
            },
            {
              title: `Connect Count (${graphPeriod})`, dataIndex: 'connect_count', width: 160,
              sorter: (a, b) => Number(a.connect_count || 0) - Number(b.connect_count || 0)
            },
            {
              title: 'Last Connect', dataIndex: 'last_connect_date', width: 130,
              sorter: (a, b) => (a.last_connect_date || '').localeCompare(b.last_connect_date || '')
            },
            {
              title: 'Action', key: 'action', width: 220, render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => openEdit(row)}>Edit</Button>
                  <Button size="small" onClick={() => openConnectLogs(row)}>Connect Logs</Button>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal
        title="New Contact"
        open={showNewContact}
        onCancel={() => setShowNewContact(false)}
        footer={null}
      >
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
      </Modal>


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

      <Modal
        title={connectTarget ? `Connect Logs · ${connectTarget.name}` : 'Connect Logs'}
        open={!!connectTarget}
        onCancel={() => { setConnectTarget(null); setEditingLog(null) }}
        onOk={saveConnectLog}
        okText="Add Connect Log"
        width={900}
      >
        <Form layout="vertical" form={connectForm}>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="connect_date" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="channel" label="Channel"><Select options={[{value:'Slack'},{value:'Teams'},{value:'Email'},{value:'1:1'},{value:'Call'},{value:'Other'}]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="summary" label="Summary" rules={[{ required: true }]}><Input placeholder="What did you discuss?" /></Form.Item></Col>
          </Row>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} placeholder="Key details, blockers, commitments, follow-up" /></Form.Item>
        </Form>

        <Table
          rowKey="id"
          dataSource={connectLogs}
          pagination={{ pageSize: 6 }}
          columns={[
            { title: 'Date', dataIndex: 'connect_date', width: 110 },
            { title: 'Channel', dataIndex: 'channel', width: 100 },
            { title: 'Summary', dataIndex: 'summary' },
            { title: 'Notes', dataIndex: 'notes' },
            {
              title: 'Action', width: 140, render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => openEditConnectLog(row)}>Edit</Button>
                  <Popconfirm title="Delete this connect log?" onConfirm={() => deleteConnectLog(row.id)}>
                    <Button size="small" danger>Delete</Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Modal>

      <Modal
        title="Edit Connect Log"
        open={!!editingLog}
        onCancel={() => setEditingLog(null)}
        onOk={saveEditConnectLog}
        okText="Save Changes"
      >
        <Form layout="vertical" form={editConnectForm}>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="connect_date" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="channel" label="Channel"><Select options={[{value:'Slack'},{value:'Teams'},{value:'Email'},{value:'1:1'},{value:'Call'},{value:'Other'}]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="summary" label="Summary" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}
