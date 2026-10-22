import { useEffect, useState } from 'react'
import { App, Table, Typography } from 'antd'
import { api, type LineContact } from './api'

const TYPE_LABELS: Record<LineContact['type'], string> = { user: '好友', group: '群組', room: '聊天室' }

// d2r-linebot 收到訊息、加好友、被拉進群組時自動記錄，ID 可填到低價通知的收件人
export default function ContactsPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<LineContact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .contacts()
      .then(setRows, (e) => message.error((e as Error).message))
      .finally(() => setLoading(false))
  }, [message])

  return (
    <>
      <Typography.Title level={4} style={{ marginTop: 0 }}>LINE 好友／群組</Typography.Title>
      <Typography.Paragraph type="secondary">
        跟 bot 互動過才會出現；舊好友要再傳一次訊息給 bot。
      </Typography.Paragraph>
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          { title: '名稱', dataIndex: 'name', render: (v: string | null) => v ?? '（無名稱）' },
          { title: '類型', dataIndex: 'type', width: 80, render: (v: LineContact['type']) => TYPE_LABELS[v] },
          { title: 'ID', dataIndex: 'id', render: (v: string) => <Typography.Text copyable code>{v}</Typography.Text> },
          { title: '最後互動（UTC）', dataIndex: 'seen_at', width: 180 },
        ]}
      />
    </>
  )
}
