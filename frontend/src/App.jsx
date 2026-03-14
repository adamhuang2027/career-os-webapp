import { Drawer, Grid, Layout, Menu, Typography } from 'antd'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import ManagerUpdatePage from './pages/ManagerUpdatePage'
import InsightsPage from './pages/InsightsPage'
import PeoplePage from './pages/PeoplePage'
import PromotionEvidencePage from './pages/PromotionEvidencePage'

const { Sider, Content, Header } = Layout
const { useBreakpoint } = Grid

const items = [
  { key: '/', label: 'Today Dashboard' },
  { key: '/projects', label: 'Projects' },
  { key: '/manager-update', label: 'Manager Update' },
  { key: '/insights', label: 'Insights' },
  { key: '/people', label: 'People / Resource Map' },
  { key: '/promotion-evidence', label: 'Promotion Evidence' },
]

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [open, setOpen] = useState(false)

  const menuNode = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={items}
      onClick={({ key }) => {
        navigate(key)
        setOpen(false)
      }}
    />
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile ? (
        <Sider width={260} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
          <div style={{ padding: 16 }}>
            <Typography.Title level={4} style={{ margin: 0 }}>CareerOS</Typography.Title>
            <Typography.Text type="secondary">WorkOS MVP</Typography.Text>
          </div>
          {menuNode}
        </Sider>
      ) : (
        <Drawer title="CareerOS" placement="left" open={open} onClose={() => setOpen(false)}>
          {menuNode}
        </Drawer>
      )}

      <Layout>
        <Header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', display:'flex', alignItems:'center', gap: 12, paddingInline: 16 }}>
          {isMobile && <a onClick={() => setOpen(true)} style={{ fontSize: 18 }}>☰</a>}
          <Typography.Text strong>From doing work → driving impact</Typography.Text>
        </Header>
        <Content style={{ padding: isMobile ? 12 : 24 }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/manager-update" element={<ManagerUpdatePage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/promotion-evidence" element={<PromotionEvidencePage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}
