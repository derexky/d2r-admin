import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  type TableProps,
} from 'antd'
import { api, type ColumnMeta, type Row, type TableMeta } from './api'

const looksLikeJson = (v: unknown) => typeof v === 'string' && /^\s*[[{]/.test(v)

// DB 內 JSON 字串存成緊湊格式，編輯時才展開
function toFormValue(c: ColumnMeta, v: unknown) {
  if (c.kind === 'boolean') return !!v
  if (c.kind === 'text' && looksLikeJson(v)) {
    try {
      return JSON.stringify(JSON.parse(v as string), null, 2)
    } catch {
      return v
    }
  }
  return v
}

function fromFormValue(c: ColumnMeta, v: unknown) {
  if (v === undefined || v === '') return c.nullable ? null : v
  if (c.kind === 'text' && looksLikeJson(v)) return JSON.stringify(JSON.parse(v as string))
  return v
}

// Form.Item 會注入 value／checked／onChange／id，必須轉傳給實際的輸入元件
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FieldInput({ column, ...props }: { column: ColumnMeta; disabled: boolean } & Record<string, any>) {
  switch (column.kind) {
    case 'number':
      return <InputNumber style={{ width: '100%' }} {...props} />
    case 'boolean':
      return <Switch {...props} />
    case 'text':
      return <Input.TextArea autoSize={{ minRows: 2, maxRows: 16 }} {...props} />
    default:
      return <Input {...props} />
  }
}

export default function TablePage({ meta, title }: { meta: TableMeta; title?: string }) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [filterCol, setFilterCol] = useState<string>()
  const [filterVal, setFilterVal] = useState('')
  const [sort, setSort] = useState<{ sort?: string; order?: string }>({})
  const [editing, setEditing] = useState<Row | null>(null) // null = 關閉，{} = 新增
  const [saving, setSaving] = useState(false)

  const pk = meta.primary
  const isNew = editing !== null && editing[pk] === undefined

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) }
      if (search) params.search = search
      if (filterCol && filterVal !== '') params[filterCol] = filterVal
      if (sort.sort) Object.assign(params, sort)
      const res = await api.list(meta.table, params)
      setRows(res.data)
      setTotal(res.total)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [meta.table, page, pageSize, search, filterCol, filterVal, sort, message])

  useEffect(() => {
    load()
  }, [load])

  const openEditor = (row: Row) => {
    setEditing(row)
    form.setFieldsValue(
      Object.fromEntries(meta.columns.map((c) => [c.name, toFormValue(c, row[c.name])])),
    )
  }

  const save = async () => {
    // 驗證失敗時 antd 已在欄位下顯示錯誤，這裡只需中止
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    const body = Object.fromEntries(
      meta.columns
        .filter((c) => !c.generated)
        .map((c) => [c.name, fromFormValue(c, values[c.name])]),
    )
    setSaving(true)
    try {
      if (isNew) await api.create(meta.table, body)
      else await api.update(meta.table, editing![pk], body)
      message.success('已儲存')
      setEditing(null)
      load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: Row) => {
    try {
      await api.remove(meta.table, row[pk])
      message.success('已刪除')
      load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const columns: TableProps<Row>['columns'] = [
    ...meta.columns.map((c) => ({
      title: c.name,
      dataIndex: c.name,
      sorter: true,
      ellipsis: true,
      width: c.kind === 'text' ? 280 : c.kind === 'string' ? 180 : 100,
      render: (v: unknown) =>
        c.kind === 'boolean' ? (v ? '✓' : '') : v === null ? <Typography.Text type="secondary">null</Typography.Text> : String(v),
    })),
    {
      title: '操作',
      key: '_actions',
      fixed: 'right' as const,
      width: 130,
      render: (_: unknown, row: Row) => (
        <Space>
          <Button size="small" onClick={() => openEditor(row)}>
            編輯
          </Button>
          <Popconfirm title={`確定刪除 ${pk}=${String(row[pk])}？`} onConfirm={() => remove(row)}>
            <Button size="small" danger>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Space wrap style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title ?? meta.table}
        </Typography.Title>
        <Input.Search
          allowClear
          placeholder="搜尋文字欄位"
          onSearch={(v) => {
            setPage(1)
            setSearch(v)
          }}
          style={{ width: 220 }}
        />
        <Space.Compact>
          <Select
            allowClear
            placeholder="篩選欄位"
            value={filterCol}
            onChange={(v) => {
              setPage(1)
              setFilterCol(v)
            }}
            options={meta.columns.map((c) => ({ value: c.name, label: c.name }))}
            style={{ width: 150 }}
          />
          <Input.Search
            placeholder="等於…"
            onSearch={(v) => {
              setPage(1)
              setFilterVal(v)
            }}
            style={{ width: 150 }}
          />
        </Space.Compact>
        <Button type="primary" onClick={() => openEditor({})}>
          新增
        </Button>
      </Space>

      <Table<Row>
        rowKey={(r) => String(r[pk])}
        size="small"
        loading={loading}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 筆` }}
        onChange={(p, _f, sorter) => {
          setPage(p.current ?? 1)
          setPageSize(p.pageSize ?? 20)
          const s = Array.isArray(sorter) ? sorter[0] : sorter
          setSort(s?.order ? { sort: String(s.field), order: s.order === 'descend' ? 'desc' : 'asc' } : {})
        }}
      />

      <Modal
        open={editing !== null}
        title={isNew ? `新增 ${meta.table}` : `編輯 ${meta.table} #${String(editing?.[pk])}`}
        onCancel={() => setEditing(null)}
        onOk={save}
        confirmLoading={saving}
        okText="儲存"
        width={720}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical">
          {meta.columns
            .filter((c) => !(isNew && c.generated))
            .map((c) => (
              <Form.Item
                key={c.name}
                name={c.name}
                label={`${c.name}（${c.kind}${c.nullable ? '，可空' : ''}）`}
                valuePropName={c.kind === 'boolean' ? 'checked' : 'value'}
                rules={[
                  { required: !c.nullable && !c.generated && c.kind !== 'boolean', message: '必填' },
                  {
                    validator: async (_, v) => {
                      if (c.kind === 'text' && looksLikeJson(v)) JSON.parse(v)
                    },
                    message: 'JSON 格式錯誤',
                  },
                ]}
              >
                <FieldInput column={c} disabled={c.generated} />
              </Form.Item>
            ))}
        </Form>
      </Modal>
    </>
  )
}
