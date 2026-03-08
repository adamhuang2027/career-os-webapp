import { Card, Col, Input, Row, Typography } from 'antd'

export default function DashboardPage() {
  return (
    <>
      <Typography.Title level={3}>Today Dashboard</Typography.Title>
      <Row gutter={[16,16]}>
        <Col span={12}><Card title="Top 3 Priorities"><Input.TextArea rows={5} placeholder="1) ..." /></Card></Col>
        <Col span={12}><Card title="Current Blockers"><Input.TextArea rows={5} placeholder="- waiting on ..." /></Card></Col>
        <Col span={12}><Card title="What to Sync Upward Today"><Input.TextArea rows={5} placeholder="Manager sync..." /></Card></Col>
        <Col span={12}><Card title="Weekly Project Progress"><Input.TextArea rows={5} placeholder="Project A 70%" /></Card></Col>
        <Col span={24}><Card title="Today Reflection"><Input.TextArea rows={4} placeholder="Was I just doing tasks, or driving outcomes?" /></Card></Col>
      </Row>
    </>
  )
}
