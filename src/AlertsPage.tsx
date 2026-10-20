import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, InputNumber, Popconfirm, Select, Space, Table, Typography } from 'antd'
import { api, type PriceAlert, type PropRule } from './api'

interface FormValues {
  item: string
  combo: string
  max_value: number
  props?: { name: string; rule: string }[]
}

// 表單裡屬性門檻都是文字：數字當下限，true／false 當布林，其餘當字串
function parseRule(s: string): PropRule {
  const t = s.trim()
  if (t === 'true' || t === 'false') return t === 'true'
  return t !== '' && !isNaN(Number(t)) ? Number(t) : t
}

const comboLabel = (a: Pick<PriceAlert, 'ladder' | 'mode'>) => `${a.ladder ? 'Ladder' : 'NL'} ${a.mode.toUpperCase()}`

// d2r-traderie 每 10 分鐘檢查掛賣中列表，符合條件且價格 ≤ 目標價就推 LINE
export default function AlertsPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const [rows, setRows] = useState<PriceAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<number>()
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await api.alerts())
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    load()
  }, [load])

  const reset = () => {
    setEditing(undefined)
    form.resetFields()
  }

  const submit = async (v: FormValues) => {
    const [ladder, mode] = v.combo.split('_')
    const alert = {
      item: v.item.trim(),
      ladder: ladder === 'ladder',
      mode: mode as PriceAlert['mode'],
      max_value: v.max_value,
      props: Object.fromEntries((v.props ?? []).map((p) => [p.name.trim(), parseRule(p.rule)])),
    }
    setSaving(true)
    try {
      // 送出時會到 traderie 查名稱，約需數秒
      if (editing) await api.updateAlert(editing, alert)
      else await api.addAlert(alert)
      message.success('已儲存')
      reset()
      load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    try {
      await api.removeAlert(id)
      message.success('已移除')
      load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const check = async () => {
    try {
      await api.checkAlerts()
      message.success('已開始檢查，有符合的會推 LINE')
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  return (
    <>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        TR 低價通知
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        每 10 分鐘檢查 traderie 掛賣中列表，符合屬性門檻且價格 ≤ 目標價就推 LINE，同一張單只通知一次。目標價的單位同「TR
        物品價值」裡同模式的那張表。屬性名稱要跟 traderie 一樣（如 <code>{'+{{value}}% Enhanced Defense'}</code>
        ）；門檻填數字為下限，true／false 或文字須相等。
      </Typography.Paragraph>
      <Form
        form={form}
        layout="vertical"
        onFinish={submit}
        initialValues={{ combo: 'ladder_sc' }}
        style={{ marginBottom: 16, maxWidth: 640 }}
      >
        <Space wrap align="start">
          <Form.Item name="item" label="物品" rules={[{ required: true, whitespace: true, message: '請輸入英文名稱' }]}>
            <Input placeholder="英文名稱（traderie）" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="combo" label="模式">
            <Select
              style={{ width: 140 }}
              options={['ladder_sc', 'nonladder_sc', 'ladder_hc', 'nonladder_hc'].map((c) => {
                const [l, m] = c.split('_')
                return { value: c, label: comboLabel({ ladder: l === 'ladder', mode: m as PriceAlert['mode'] }) }
              })}
            />
          </Form.Item>
          <Form.Item name="max_value" label="目標價 ≤" rules={[{ required: true, message: '請輸入目標價' }]}>
            <InputNumber min={0} step={0.01} style={{ width: 120 }} />
          </Form.Item>
        </Space>
        <Form.List name="props">
          {(fields, { add, remove }) => (
            <>
              {fields.map((f) => (
                <Space key={f.key} align="start">
                  <Form.Item name={[f.name, 'name']} rules={[{ required: true, whitespace: true, message: '請輸入屬性名稱' }]}>
                    <Input placeholder="屬性名稱" style={{ width: 300 }} />
                  </Form.Item>
                  <Form.Item name={[f.name, 'rule']} rules={[{ required: true, whitespace: true, message: '請輸入門檻' }]}>
                    <Input placeholder="門檻" style={{ width: 120 }} />
                  </Form.Item>
                  <Button onClick={() => remove(f.name)}>刪除</Button>
                </Space>
              ))}
              <Form.Item>
                <Button type="dashed" onClick={() => add()}>
                  新增屬性條件
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>
            {editing ? '儲存' : '新增'}
          </Button>
          {editing && <Button onClick={reset}>取消</Button>}
          <Button onClick={check}>立即檢查</Button>
        </Space>
      </Form>
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          { title: '物品', dataIndex: 'item' },
          { title: '模式', key: 'combo', width: 110, render: (_, r) => comboLabel(r) },
          { title: '目標價 ≤', dataIndex: 'max_value', width: 100 },
          {
            title: '屬性條件',
            key: 'props',
            render: (_, r) =>
              Object.entries(r.props)
                .map(([k, v]) => `${k} ${typeof v === 'number' ? '≥' : '='} ${v}`)
                .join('；'),
          },
          {
            title: '操作',
            key: '_actions',
            width: 140,
            render: (_, r) => (
              <Space>
                <Button
                  size="small"
                  onClick={() => {
                    setEditing(r.id)
                    form.setFieldsValue({
                      item: r.item,
                      combo: `${r.ladder ? 'ladder' : 'nonladder'}_${r.mode}`,
                      max_value: r.max_value,
                      props: Object.entries(r.props).map(([name, rule]) => ({ name, rule: String(rule) })),
                    })
                  }}
                >
                  編輯
                </Button>
                <Popconfirm title={`確定移除 ${r.item} 的通知？`} onConfirm={() => remove(r.id)}>
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
