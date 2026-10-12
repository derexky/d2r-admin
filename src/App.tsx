import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Input, Layout, Menu, Space, Spin, Typography } from 'antd'
import { api, getToken, setToken, type TableMeta } from './api'
import TablePage from './TablePage'

const TABLE_LABELS: Record<string, string> = {
  items: '暗金裝備',
  item_stats: '暗金裝備屬性',
  item_sets: '套裝',
  set_members: '套裝成員',
  set_bonuses: '套裝加成',
  runewords: '符文之語',
  runeword_stats: '符文之語屬性',
  runes: '符文',
  base_items: '底材',
  socket_bases: '打孔上限',
  affixes: '魔法詞綴',
  stat_defs: '屬性定義',
  skills: '技能',
  builds: '流派',
  mercenaries: '傭兵',
  ias_breakpoints: 'IAS 斷點',
  crafted_items: '合成裝備',
  announcements: '公告',
  trades: '交易',
}

export default function App() {
  const [tables, setTables] = useState<TableMeta[]>([])
  const [current, setCurrent] = useState<string>()
  const [token, setTokenInput] = useState(getToken)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const t = await api.tables()
      setTables(t)
      setCurrent((c) => c ?? t.find((x) => x.table === 'items')?.table ?? t[0]?.table)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const meta = tables.find((t) => t.table === current)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0, whiteSpace: 'nowrap' }}>
          D2R 後台
        </Typography.Title>
        <Space.Compact style={{ marginLeft: 'auto', maxWidth: 360 }}>
          <Input.Password
            placeholder="Admin Token"
            value={token}
            onChange={(e) => setTokenInput(e.target.value)}
            onPressEnter={() => {
              setToken(token)
              load()
            }}
          />
          <Button
            type="primary"
            onClick={() => {
              setToken(token)
              load()
            }}
          >
            套用
          </Button>
        </Space.Compact>
      </Layout.Header>
      <Layout>
        <Layout.Sider width={260} theme="light" breakpoint="lg" collapsedWidth={0}>
          <Menu
            mode="inline"
            selectedKeys={current ? [current] : []}
            onClick={(e) => setCurrent(e.key)}
            items={tables.map((t) => ({
              key: t.table,
              label: TABLE_LABELS[t.table] ? `${TABLE_LABELS[t.table]}（${t.table}）` : t.table,
            }))}
            style={{ height: '100%', borderInlineEnd: 0 }}
          />
        </Layout.Sider>
        <Layout.Content style={{ padding: 16, minWidth: 0 }}>
          {error && (
            <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />
          )}
          {loading && <Spin />}
          {meta && <TablePage key={meta.table} meta={meta} title={TABLE_LABELS[meta.table]} />}
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
