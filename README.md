# d2r-admin

d2r-service 的本機資料後台，可新增、修改、刪除 `d2r.sqlite` 所有資料表。

## 啟動

```bash
# 1. 後端（本機才開放 /api/admin；Cloud Functions 上一律 404）
cd ../d2r-service
ADMIN_TOKEN=自訂一組密碼 npm run start:dev

# 2. 後台（http://localhost:5174，/api 由 Vite 轉發到 :3001）
cd ../d2r-admin
npm install
npm run dev
```

開啟後在右上角輸入同一組 `ADMIN_TOKEN`。

## 上線流程

正式環境的 DB 是部署時打包的 `d2r.sqlite` 唯讀副本，所以在後台改完後要 commit `d2r-service/d2r.sqlite` 並重新部署才會生效。

## 備註

- 欄位與型別來自 `GET /api/admin/tables`（依 d2r-service 的 TypeORM entity 自動產生），新增 entity 後後台會自動出現該表。
- JSON 字串欄位（如 `stats`）編輯時會展開排版，存檔時壓回單行並檢查格式。
