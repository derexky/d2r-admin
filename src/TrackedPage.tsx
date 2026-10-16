import { useCallback, useEffect, useState } from 'react'
import { App, AutoComplete, Button, Form, Input, Popconfirm, Space, Table, Typography } from 'antd'
import { api, type TrackedItem } from './api'

// d2r-traderie 每 30 分鐘爬一次這份清單的成交價；改動直接寫進 traderie，不用重新部署
export default function TrackedPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm<TrackedItem>()
  const [rows, setRows] = useState<TrackedItem[]>([])
  const [loading, setLoading] = useState(false)
  // 編輯中物品的英文名稱；英文名稱是主鍵，不能改
  const [editing, setEditing] = useState<string>()
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await api.tracked())
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (item: TrackedItem) => {
    setSaving(true)
    try {
      if (editing) {
        await api.updateTracked(editing, item)
        message.success('已儲存')
        setEditing(undefined)
      } else {
        // 送出時會到 traderie 查名稱，約需數秒
        const res = await api.addTracked(item)
        message.success(res.synced ? `已新增，開始爬取 ${res.name}` : `已新增，${res.name} 會在下一輪排程爬取`)
      }
      form.resetFields(['name', 'zh'])
      load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (name: string) => {
    try {
      await api.removeTracked(name)
      message.success('已移除')
      load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const categories = [...new Set(rows.map((r) => r.category))]

  return (
    <>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        TR 價格追蹤物品
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        英文名稱會到 traderie 成交紀錄比對（不分大小寫，存成 traderie 的寫法），查不到就無法新增。移除後停止爬取與顯示，歷史價格保留。
      </Typography.Paragraph>
      <Form form={form} layout="inline" onFinish={submit} style={{ marginBottom: 16, rowGap: 8 }}>
        <Form.Item name="category" rules={[{ required: true, whitespace: true, message: '請輸入分類' }]}>
          <AutoComplete
            placeholder="分類"
            options={categories.map((c) => ({ value: c }))}
            style={{ width: 140 }}
          />
        </Form.Item>
        <Form.Item name="name" rules={[{ required: true, whitespace: true, message: '請輸入英文名稱' }]}>
          <Input placeholder="英文名稱（traderie）" disabled={!!editing} style={{ width: 220 }} />
        </Form.Item>
        <Form.Item name="zh" rules={[{ required: true, whitespace: true, message: '請輸入中文名稱' }]}>
          <Input placeholder="中文名稱" style={{ width: 160 }} />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>
            {editing ? '儲存' : '新增'}
          </Button>
          {editing && (
            <Button
              onClick={() => {
                setEditing(undefined)
                form.resetFields(['name', 'zh'])
              }}
            >
              取消
            </Button>
          )}
        </Space>
      </Form>
      <Table
        rowKey="name"
        size="small"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          {
            title: '分類',
            dataIndex: 'category',
            width: 120,
            filters: categories.map((c) => ({ text: c, value: c })),
            onFilter: (v, r) => r.category === v,
          },
          { title: '英文名稱', dataIndex: 'name' },
          { title: '中文名稱', dataIndex: 'zh' },
          {
            title: '操作',
            key: '_actions',
            width: 140,
            render: (_, r) => (
              <Space>
                <Button
                  size="small"
                  onClick={() => {
                    setEditing(r.name)
                    form.setFieldsValue(r)
                  }}
                >
                  編輯
                </Button>
                <Popconfirm title={`確定移除 ${r.name}？`} onConfirm={() => remove(r.name)}>
                  <Button size="small" danger>
                    移除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </>
  )
}
