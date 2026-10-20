export type ColumnKind = 'number' | 'boolean' | 'text' | 'string'

export interface ColumnMeta {
  name: string
  kind: ColumnKind
  nullable: boolean
  generated: boolean
}

export interface TableMeta {
  table: string
  primary: string
  columns: ColumnMeta[]
}

export type Row = Record<string, unknown>

const TOKEN_KEY = 'd2r-admin-token'

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // 無痕模式等情況存不了，只影響重新整理後要再輸入一次
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-admin-token': getToken() },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401) throw new Error('Admin Token 錯誤或未設定')
    throw new Error(data?.message ?? `HTTP ${res.status}`)
  }
  return data as T
}

export interface TrackedItem {
  name: string
  zh: string
  category: string
}

// 一個屬性條件；id／name／type 取自 GET /alerts/props。數字用 id 篩、文字和布林用名稱篩
export type Condition =
  | { id: number; name: string; type: 'number'; min?: number; max?: number }
  | { id: number; name: string; type: 'string'; values: string[] }
  | { id: number; name: string; type: 'bool'; value: boolean }

export interface PriceAlert {
  id: number
  item: string
  // traderie 物品 id，由後端依名稱查出
  item_id: number
  ladder: boolean
  mode: 'sc' | 'hc'
  max_value: number
  conditions: Condition[]
}

export type NewAlert = Omit<PriceAlert, 'id' | 'item_id'>

// traderie 可篩選的屬性，附上賣家實際填寫的統計（沒人填過就沒有 stat）
export interface PropDef {
  id: number
  name: string
  type: 'number' | 'string' | 'bool'
  options?: string[]
  stat?: { rate: number; min?: number; median?: number; max?: number; values?: string[] }
}

export interface PropsLookup {
  item: string
  item_id: number
  // completed：追蹤物品的成交紀錄；selling：即時抓的最新一頁掛賣單
  source: 'completed' | 'selling'
  listings: number
  props: PropDef[]
}

export interface PriceValue {
  combo: string
  name: string
  value: number
}

const enc = encodeURIComponent

export const api = {
  tables: () => request<TableMeta[]>('GET', '/tables'),
  list: (table: string, params: Record<string, string>) =>
    request<{ data: Row[]; total: number }>('GET', `/${enc(table)}?${new URLSearchParams(params)}`),
  create: (table: string, row: Row) => request<Row>('POST', `/${enc(table)}`, row),
  update: (table: string, id: unknown, row: Row) =>
    request<Row>('PATCH', `/${enc(table)}/${enc(String(id))}`, row),
  remove: (table: string, id: unknown) => request<Row>('DELETE', `/${enc(table)}/${enc(String(id))}`),
  tracked: () => request<TrackedItem[]>('GET', '/tracked'),
  addTracked: (item: TrackedItem) => request<TrackedItem & { synced: boolean }>('POST', '/tracked', item),
  updateTracked: (name: string, item: Pick<TrackedItem, 'zh' | 'category'>) =>
    request<TrackedItem>('PATCH', `/tracked/${enc(name)}`, item),
  removeTracked: (name: string) => request<{ name: string }>('DELETE', `/tracked/${enc(name)}`),
  alerts: () => request<PriceAlert[]>('GET', '/alerts'),
  addAlert: (a: NewAlert) => request<PriceAlert>('POST', '/alerts', a),
  updateAlert: (id: number, a: NewAlert) => request<PriceAlert>('PATCH', `/alerts/${id}`, a),
  removeAlert: (id: number) => request<{ id: number }>('DELETE', `/alerts/${id}`),
  alertProps: (item: string) => request<PropsLookup>('GET', `/alerts/props?${new URLSearchParams({ item })}`),
  checkAlerts: () => request<{ message: string }>('POST', '/alerts/check'),
  values: () => request<PriceValue[]>('GET', '/values'),
  setValue: (v: PriceValue) => request<PriceValue>('PUT', `/values/${enc(v.combo)}/${enc(v.name)}`, { value: v.value }),
  removeValue: (combo: string, name: string) =>
    request<{ combo: string; name: string }>('DELETE', `/values/${enc(combo)}/${enc(name)}`),
}
