import { useEffect, useMemo, useState } from 'react'
import { Button, Card, DatePicker, Form, Input, Select, Table, Typography, Modal, Tag, Row, Col, Statistic, message, Progress, List, Space } from 'antd'
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
        .sort((a, b) => {
          const score = { strong: 3, medium: 2, weak: 1 }
          return (score[b.relationship_level] || 1) - (score[a.relationship_level] || 1)
        })
        .slice(0, 3)
    }))
  }, [items])

  const networkGraph = useMemo(() => {
    const width = 980
    const height = 520
    const cx = width / 2
    const cy = height / 2

    const people = items.slice(0, 24)
    const teams = [...new Set(people.map(p => p.team || 'Unknown'))]

    const teamRadius = Math.min(width, height) * 0.38
    const personRadius = Math.min(width, height) * 0.24

    const teamNodes = teams.map((team, i) => {
      const angle = (2 * Math.PI * i) / Math.max(teams.length, 1)
      return {
        id: `team-${team}`,
        type: 'team',
        label: team,
        x: cx + teamRadius * Math.cos(angle),
        y: cy + teamRadius * Math.sin(angle),
      }
    })

    const personNodes = people.map((p, i) => {
      const angle = (2 * Math.PI * i) / Math.max(people.length, 1)
      return {
        id: `person-${p.id}`,
        type: 'person',
        label: p.name || `P${p.id}`,
        relation: p.relationship_level || 'weak',
        team: p.team || 'Unknown',
        x: cx + personRadius * Math.cos(angle),
        y: cy + personRadius * Math.sin(angle),
      }
    })

    const centerNode = { id: 'me', type: 'me', label: 'Adam', x: cx, y: cy }

    const edges = []
    for (const p of personNodes) {
      edges.push({ from: centerNode, to: p, type: 'ownership' })
      const t = teamNodes.find(x => x.label === p.team)
      if (t) edges.push({ from: p, to: t, type: 'team' })
    }

    return { width, height, centerNode, personNodes, teamNodes, edges }
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

      <Card title="Relationship Graph (Nodes & Edges)" style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">Center = Adam. Person nodes connect to Adam and to their Team node.</Typography.Text>
        <div style={{ overflowX: 'auto', marginTop: 10, border: '1px solid #f0f0f0', borderRadius: 8, background: '#fff' }}>
          <svg width={networkGraph.width} height={networkGraph.height}>
            {networkGraph.edges.map((e, i) => (
              <line
                key={i}
                x1={e.from.x}
                y1={e.from.y}
                x2={e.to.x}
                y2={e.to.y}
                stroke={e.type === 'team' ? '#93c5fd' : '#cbd5e1'}
                strokeDasharray={e.type === 'team' ? '4 4' : '0'}
                strokeWidth={e.type === 'team' ? 1.2 : 1.6}
              />
            ))}

            {networkGraph.teamNodes.map((n) => (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={16} fill="#e0f2fe" stroke="#0284c7" />
                <text x={n.x} y={n.y + 34} textAnchor="middle" fontSize="11" fill="#0f172a">{n.label}</text>
              </g>
            ))}

            {networkGraph.personNodes.map((n) => (
              <g key={n.id}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={11}
                  fill={n.relation === 'strong' ? '#86efac' : n.relation === 'medium' ? '#fde68a' : '#e5e7eb'}
                  stroke="#334155"
                />
                <text x={n.x} y={n.y - 16} textAnchor="middle" fontSize="10" fill="#0f172a">{n.label}</text>
              </g>
            ))}

            <g>
              <circle cx={networkGraph.centerNode.x} cy={networkGraph.centerNode.y} r={18} fill="#2563eb" />
              <text x={networkGraph.centerNode.x} y={networkGraph.centerNode.y + 4} textAnchor="middle" fontSize="11" fill="#fff">Adam</text>
            </g>
          </svg>
        </div>
      </Card>

      <Card title="Network Snapshot (Top Contacts by Team)" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          {topConnectors.map(group => (
            <Col xs={24} md={12} xl={8} key={group.team}>
              <Card size="small" title={group.team}>
                {group.people.map(p => (
                  <div key={p.id} style={{ marginBottom: 8 }}>
                    <Typography.Text>{p.name}</Typography.Text>
                    <Tag style={{ marginLeft: 8 }} color={p.relationship_level === 'strong' ? 'green' : p.relationship_level === 'medium' ? 'gold' : 'default'}>{p.relationship_level || 'weak'}</Tag>
                  </div>
                ))}
              </Card>
            </Col>
          ))}
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
