import { Drawer, Grid, Layout, Menu, Spin, Switch, Typography } from 'antd'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const ManagerUpdatePage = lazy(() => import('./pages/ManagerUpdatePage'))
const InsightsPage = lazy(() => import('./pages/InsightsPage'))
const PeoplePage = lazy(() => import('./pages/PeoplePage'))
const PromotionEvidencePage = lazy(() => import('./pages/PromotionEvidencePage'))

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
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('careeros-dark-mode')
    if (saved === '1') setDarkMode(true)
  }, [])

  useEffect(() => {
    localStorage.setItem('careeros-dark-mode', darkMode ? '1' : '0')
    document.body.classList.toggle('theme-dark', darkMode)
  }, [darkMode])

  const menuNode = (
    <Menu
      mode="inline"
      theme={darkMode ? 'dark' : 'light'}
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
        <Sider width={260} theme={darkMode ? 'dark' : 'light'} style={{ borderRight: darkMode ? '1px solid #1f2937' : '1px solid #f0f0f0' }}>
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
        <Header style={{ background: darkMode ? '#0f172a' : '#fff', borderBottom: darkMode ? '1px solid #1f2937' : '1px solid #f0f0f0', display:'flex', alignItems:'center', gap: 12, paddingInline: 16 }}>
          {isMobile && <a onClick={() => setOpen(true)} style={{ fontSize: 18, color: darkMode ? '#e2e8f0' : undefined }}>☰</a>}
          <Typography.Text strong style={{ color: darkMode ? '#e2e8f0' : undefined }}>From doing work → driving impact</Typography.Text>
          <div style={{ marginLeft: 'auto' }}>
            <Switch checked={darkMode} onChange={setDarkMode} checkedChildren="Dark" unCheckedChildren="Light" />
          </div>
        </Header>
        <Content style={{ padding: isMobile ? 12 : 24 }}>
          <Suspense fallback={<div style={{ minHeight: 240, display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/manager-update" element={<ManagerUpdatePage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/promotion-evidence" element={<PromotionEvidencePage />} />
            </Routes>
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  )
}
