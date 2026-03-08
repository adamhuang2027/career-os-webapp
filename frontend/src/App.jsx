import { Layout, Menu, Typography } from 'antd'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import ManagerUpdatePage from './pages/ManagerUpdatePage'
import InsightsPage from './pages/InsightsPage'
import PeoplePage from './pages/PeoplePage'

const { Sider, Content, Header } = Layout

const items = [
  { key: '/', label: 'Today Dashboard' },
  { key: '/projects', label: 'Projects' },
  { key: '/manager-update', label: 'Manager Update' },
  { key: '/insights', label: 'Insights' },
  { key: '/people', label: 'People / Resource Map' },
]

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={260} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>CareerOS</Typography.Title>
          <Typography.Text type="secondary">WorkOS MVP</Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', display:'flex', alignItems:'center' }}>
          <Typography.Text strong>From doing work → driving impact</Typography.Text>
        </Header>
        <Content style={{ padding: 24 }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/manager-update" element={<ManagerUpdatePage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/people" element={<PeoplePage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}
