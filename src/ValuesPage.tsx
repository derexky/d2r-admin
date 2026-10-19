import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, InputNumber, Popconfirm, Space, Table, Typography } from 'antd'
import { api, type PriceValue } from './api'

// d2r-traderie 換算掛單價格用的價值表；改動直接寫進 traderie，下一輪檢查就生效
export default function ValuesPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm<PriceValue>()
  const [rows, setRows] = useState<PriceValue[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await api.values())
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (v: PriceValue) => {
    setSaving(true)
    try {
      await api.setValue({ name: v.name.trim(), value: v.value })
      message.success('已儲存')
      form.resetFields()
      load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (name: string) => {
    try {
      await api.removeValue(name)
      message.success('已移除')
      load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  return (
    <>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        TR 物品價值
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        低價通知用這張表換算掛單價格：一組價格 = Σ 價值 × 數量，多組擇一取最便宜。名稱要跟 traderie 一樣（如 Ber
        Rune）；不在表內的物品無法換算，該組價格會被略過。單位自訂，與通知的目標價一致即可。
      </Typography.Paragraph>
      <Form form={form} layout="inline" onFinish={submit} style={{ marginBottom: 16, rowGap: 8 }}>
        <Form.Item name="name" rules={[{ required: true, whitespace: true, message: '請輸入名稱' }]}>
          <Input placeholder="traderie 名稱，如 Ber Rune" style={{ width: 220 }} />
        </Form.Item>
        <Form.Item name="value" rules={[{ required: true, message: '請輸入價值' }]}>
          <InputNumber placeholder="價值" min={0} step={0.01} style={{ width: 120 }} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>
          新增／更新
        </Button>
      </Form>
      <Table
        rowKey="name"
        size="small"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          { title: '名稱', dataIndex: 'name' },
          { title: '價值', dataIndex: 'value', width: 120 },
          {
            title: '操作',
            key: '_actions',
            width: 140,
            render: (_, r) => (
              <Space>
                <Button size="small" onClick={() => form.setFieldsValue(r)}>
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
