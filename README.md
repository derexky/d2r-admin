# d2r-admin

d2r-service 的資料後台，可新增、修改、刪除 `d2r.sqlite` 所有資料表。

線上版在 myhost：`https://d2r-admin.derexky.com`（Cloudflare Access 只允許指定 email 登入，進去後右上角再輸入 `ADMIN_TOKEN`）。架構、部署與 DB 流程見下方「myhost」。下面的本機啟動方式仍可用於開發。

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

用 myhost 的後台改的是 NAS 上那份 DB，要先拉回 repo 再 commit（見 d2r-service README 的「myhost」）。**同一段時間只在一邊改**：本機和 NAS 各改各的，拉回或推上時會互相覆蓋。

## myhost

```
d2r-admin.derexky.com ─ Cloudflare Access
  └ cloudflared（host 網路）→ 127.0.0.1:5174
      └ d2r-admin 容器（nginx：靜態檔，/api → d2r-service:3001）
          └ d2r-service 容器（docker 網路 d2r，不對外）
              ├ DB：/share/CACHEDEV1_DATA/homes/derexky/d2r-service-data/d2r.sqlite
              └ TR 頁面 → https://traderie.derexky.com（d2r-traderie）
```

- 原始碼：`/share/homes/derexky/d2r-admin`、`/share/homes/derexky/d2r-service`（不是 git repo，`.deployed-commit` 記錄已部署的 commit）
- 映像檔在 NAS 上建置：`DOCKER_BUILDKIT=0 docker build -t d2r-admin:latest /share/homes/derexky/d2r-admin`（d2r-service 同理）
- 容器：
  ```bash
  docker run -d --name d2r-admin --network d2r --restart always -p 127.0.0.1:5174:80 d2r-admin:latest
  ```
  nginx 每次請求重新解析 `d2r-service`，所以重建 d2r-service 不用重啟 admin。

## 備註

- 欄位與型別來自 `GET /api/admin/tables`（依 d2r-service 的 TypeORM entity 自動產生），新增 entity 後後台會自動出現該表。
- 「TR 價格追蹤物品」頁不是資料表，經 d2r-service 轉發到 d2r-traderie（需設 `TRADERIE_URL`／`TRADERIE_TOKEN`），改了立即生效，不用 commit 或部署。
- 「TR 低價通知」「TR 物品價值」頁同樣經 d2r-service 轉發到 d2r-traderie，改了立即生效。
- JSON 字串欄位（如 `stats`）編輯時會展開排版，存檔時壓回單行並檢查格式。
