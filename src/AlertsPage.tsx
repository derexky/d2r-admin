import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, InputNumber, Popconfirm, Select, Space, Table, Typography } from 'antd'
import { api, type Condition, type NewAlert, type PriceAlert, type PropDef, type PropsLookup } from './api'

// 表單裡的一列條件；依所選屬性的類型只用到其中幾個欄位
interface ConditionRow {
  id?: number
  min?: number | null
  max?: number | null
  values?: string[]
  value?: boolean
}

interface FormValues {
  item: string
  combo: string
  max_value: number
  conditions?: ConditionRow[]
}

type Def = Pick<PropDef, 'id' | 'name' | 'type'> & Partial<PropDef>

const COMBOS = ['ladder_sc', 'nonladder_sc', 'ladder_hc', 'nonladder_hc']
const comboLabel = (a: Pick<PriceAlert, 'ladder' | 'mode'>) => `${a.ladder ? 'Ladder' : 'NL'} ${a.mode.toUpperCase()}`
const parseCombo = (c: string) => {
  const [ladder, mode] = c.split('_')
  return { ladder: ladder === 'ladder', mode: mode as PriceAlert['mode'] }
}

function toCondition(row: ConditionRow, def: Def): Condition {
  const { id, name } = def
  if (def.type === 'number') {
    return { id, name, type: 'number', ...(row.min != null && { min: row.min }), ...(row.max != null && { max: row.max }) }
  }
  return def.type === 'string' ? { id, name, type: 'string', values: row.values ?? [] } : { id, name, type: 'bool', value: !!row.value }
}

// 跟 d2r-traderie 的 alertQuery 同一套規則，只用來給人看
function queryPreview(itemId: number | undefined, combo: string, conditions: Condition[]): string {
  const { ladder, mode } = parseCombo(combo)
  const parts = [
    ...(itemId ? [`item=${itemId}`] : []),
    'prop_Platform=PC',
    `prop_Mode=${mode === 'hc' ? 'hardcore' : 'softcore'}`,
    `prop_Ladder=${ladder}`,
  ]
  for (const c of conditions) {
    if (c.type === 'number') {
      if (c.min !== undefined) parts.push(`prop_${c.id}Min=${c.min}`)
      if (c.max !== undefined) parts.push(`prop_${c.id}Max=${c.max}`)
    } else if (c.type === 'string') {
      if (c.values.length) parts.push(`prop_${c.name}=${c.values.join(',')}`)
    } else {
      parts.push(`prop_${c.name}=${c.value}`)
    }
  }
  return parts.join('&')
}

function describe(c: Condition): string {
  if (c.type === 'number') {
    if (c.min !== undefined && c.max !== undefined) return `${c.name}：${c.min}～${c.max}`
    return c.min !== undefined ? `${c.name} ≥ ${c.min}` : `${c.name} ≤ ${c.max}`
  }
  return c.type === 'string' ? `${c.name} ∈ ${c.values.join('、')}` : `${c.name} = ${c.value ? '是' : '否'}`
}

const statText = (d: Def) => {
  if (!d.stat) return '沒人填過'
  const rate = `${Math.round(d.stat.rate * 100)}% 有填`
  return d.stat.median !== undefined ? `${rate}，常見 ${d.stat.min}／${d.stat.median}／${d.stat.max}` : rate
}

// d2r-traderie 每 10 分鐘用這些條件向 traderie 查掛賣單，價格 ≤ 目標價就推 LINE
export default function AlertsPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const [rows, setRows] = useState<PriceAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<PriceAlert>()
  const [saving, setSaving] = useState(false)
  const [lookup, setLookup] = useState<PropsLookup>()
  const [lookingUp, setLookingUp] = useState(false)
  const watched = Form.useWatch([], form)

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

  // 屬性清單還沒載入時（例如剛按編輯），先用通知裡存的條件撐著
  const defOf = (id?: number): Def | undefined =>
    lookup?.props.find((p) => p.id === id) ?? editing?.conditions.find((c) => c.id === id)

  const rowsToConditions = (list: ConditionRow[] = []) =>
    list.flatMap((row) => {
      const def = defOf(row.id)
      return def ? [toCondition(row, def)] : []
    })

  // 沒追蹤的物品要即時到 traderie 抓，約需數秒
  const lookupProps = async (item = form.getFieldValue('item')?.trim()) => {
    if (!item) return message.warning('先輸入物品英文名稱')
    setLookingUp(true)
    try {
      setLookup(await api.alertProps(item))
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLookingUp(false)
    }
  }

  const reset = () => {
    setEditing(undefined)
    setLookup(undefined)
    form.resetFields()
  }

  const startEdit = (r: PriceAlert) => {
    setEditing(r)
    setLookup(undefined)
    form.setFieldsValue({
      item: r.item,
      combo: `${r.ladder ? 'ladder' : 'nonladder'}_${r.mode}`,
      max_value: r.max_value,
      conditions: r.conditions.map((c) =>
        c.type === 'number'
          ? { id: c.id, min: c.min, max: c.max }
          : c.type === 'string'
            ? { id: c.id, values: c.values }
            : { id: c.id, value: c.value },
      ),
    })
    lookupProps(r.item)
  }

  const submit = async (v: FormValues) => {
    const alert: NewAlert = {
      item: v.item.trim(),
      ...parseCombo(v.combo),
      max_value: v.max_value,
      conditions: rowsToConditions(v.conditions),
    }
    setSaving(true)
    try {
      // 送出時會到 traderie 確認物品，約需數秒
      if (editing) await api.updateAlert(editing.id, alert)
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

  const propOptions = (lookup?.props ?? []).map((p) => ({ value: p.id, label: `${p.name}（${statText(p)}）` }))
  const preview = queryPreview(lookup?.item_id ?? editing?.item_id, watched?.combo ?? 'ladder_sc', rowsToConditions(watched?.conditions))

  return (
    <>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        TR 低價通知
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        每 10 分鐘用下面的條件向 traderie 查掛賣中列表（由 traderie 篩選），價格 ≤ 目標價就推 LINE，同一張單只通知一次。目標價的單位同「TR
        物品價值」裡同模式的那張表。輸入物品後按「查屬性」載入它能篩選的屬性，再新增條件。
      </Typography.Paragraph>
      <Form
        form={form}
        layout="vertical"
        onFinish={submit}
        initialValues={{ combo: 'ladder_sc' }}
        style={{ marginBottom: 16, maxWidth: 900 }}
      >
        <Space wrap align="start">
          <Form.Item name="item" label="物品" rules={[{ required: true, whitespace: true, message: '請輸入英文名稱' }]}>
            <Input
              placeholder="英文名稱（traderie）"
              style={{ width: 220 }}
              onPressEnter={(e) => {
                e.preventDefault()
                lookupProps()
              }}
              onChange={(e) => {
                // 條件綁的是物品的屬性，換物品就要重選
                if (lookup && e.target.value.trim().toLowerCase() !== lookup.item.toLowerCase()) {
                  setLookup(undefined)
                  form.setFieldValue('conditions', [])
                }
              }}
            />
          </Form.Item>
          <Form.Item label=" ">
            <Button onClick={() => lookupProps()} loading={lookingUp}>
              查屬性
            </Button>
          </Form.Item>
          <Form.Item name="combo" label="模式">
            <Select style={{ width: 140 }} options={COMBOS.map((c) => ({ value: c, label: comboLabel(parseCombo(c)) }))} />
          </Form.Item>
          <Form.Item name="max_value" label="目標價 ≤" rules={[{ required: true, message: '請輸入目標價' }]}>
            <InputNumber min={0} step={0.01} style={{ width: 120 }} />
          </Form.Item>
        </Space>
        {lookup && (
          <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
            已載入 {lookup.item} 的 {lookup.props.length} 個屬性（統計來自{lookup.source === 'completed' ? '成交紀錄' : '最新掛賣單'}{' '}
            {lookup.listings} 筆，常有人填的排前面）
          </Typography.Paragraph>
        )}
        <Form.List name="conditions">
          {(fields, { add, remove }) => (
            <>
              {fields.map((f) => (
                <Space key={f.key} align="start" wrap>
                  <Form.Item name={[f.name, 'id']} rules={[{ required: true, message: '請選擇屬性' }]}>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="屬性"
                      style={{ width: 420 }}
                      options={propOptions}
                      labelRender={({ value }) => defOf(value as number)?.name ?? value}
                      // 換屬性時清掉上一個屬性的門檻
                      onChange={(id) => form.setFieldValue(['conditions', f.name], { id })}
                    />
                  </Form.Item>
                  <Form.Item noStyle shouldUpdate>
                    {() => {
                      const def = defOf(form.getFieldValue(['conditions', f.name, 'id']))
                      if (!def) return null
                      if (def.type === 'number') {
                        return (
                          <Space align="start">
                            <Form.Item
                              name={[f.name, 'min']}
                              dependencies={[['conditions', f.name, 'max']]}
                              rules={[
                                {
                                  validator: (_, min) =>
                                    min == null && form.getFieldValue(['conditions', f.name, 'max']) == null
                                      ? Promise.reject(new Error('下限或上限至少填一個'))
                                      : Promise.resolve(),
                                },
                              ]}
                              extra={statText(def)}
                            >
                              <InputNumber placeholder="下限 ≥" style={{ width: 110 }} />
                            </Form.Item>
                            <Form.Item name={[f.name, 'max']}>
                              <InputNumber placeholder="上限 ≤" style={{ width: 110 }} />
                            </Form.Item>
                          </Space>
                        )
                      }
                      if (def.type === 'string') {
                        // 賣家常填的值排前面
                        const common = (def.stat?.values ?? []).filter((v) => def.options?.includes(v))
                        const options = [...new Set([...common, ...(def.options ?? [])])]
                        return (
                          <Form.Item name={[f.name, 'values']} rules={[{ required: true, message: '至少選一個' }]}>
                            <Select
                              mode="multiple"
                              placeholder="任一符合即可"
                              style={{ width: 320 }}
                              options={options.map((v) => ({ value: v, label: v }))}
                            />
                          </Form.Item>
                        )
                      }
                      return (
                        <Form.Item name={[f.name, 'value']} rules={[{ required: true, message: '請選擇' }]}>
                          <Select
                            style={{ width: 90 }}
                            options={[
                              { value: true, label: '是' },
                              { value: false, label: '否' },
                            ]}
                          />
                        </Form.Item>
                      )
                    }}
                  </Form.Item>
                  <Button onClick={() => remove(f.name)}>刪除</Button>
                </Space>
              ))}
              <Form.Item extra={lookup ? undefined : '先按「查屬性」載入可篩選的屬性'}>
                <Button type="dashed" disabled={!lookup} onClick={() => add()}>
                  新增屬性條件
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
        <Form.Item label="送給 traderie 的查詢條件（自動產生）">
          <Typography.Text code copyable style={{ wordBreak: 'break-all' }}>
            {preview}
          </Typography.Text>
        </Form.Item>
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
          { title: '屬性條件', key: 'conditions', render: (_, r) => r.conditions.map(describe).join('；') },
          {
            title: '操作',
            key: '_actions',
            width: 140,
            render: (_, r) => (
              <Space>
                <Button size="small" onClick={() => startEdit(r)}>
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
