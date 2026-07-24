# WWSRE Dashboard — 全球 K8s SLO/SLA 儀表板

一個一眼看出全球各 site Kubernetes SLO/SLA 現況的儀表板網站,並附一個獨立、輕量的後台管理頁面,用來管理「要追蹤哪些 site」以及「各自的 SLO 目標值」。

資料即時從既有的 Grafana 實例讀取,我們不自建/不重複建置指標蒐集管線——細節見下方[資料來源](#資料來源)。

## 目前狀態

功能已完整實作並可部署(見下方[部署](#部署docker-image)):Public API、Admin API、主看板前端、後台管理前端都做完,後端 38 個測試、前後台前端共 13 個元件測試全過。逐項可勾選的實作紀錄在 [plan.md](plan.md)。

## 為什麼要做這個

來源 Grafana(實際位址放在 `backend/.env`,不進版控——見下方 `GRAFANA_BASE_URL`)裡已經有原始的 SLO 資料(Postgres 裡的各 site 彙總、本地 cluster 的 Prometheus 即時 SLI),但沒有一個畫面能直接回答「現在全球哪些 site 是健康的」,得一個一個 cluster 的 dashboard 點進去看。這個專案就是要補上這個全球總覽視角,外加一個後台,讓「要追蹤哪些 site」、「SLO 目標值是多少」不用寫死在程式碼裡。

## 架構

```mermaid
flowchart LR
    Public["主看板(前台)<br/>React, Vite dev server / build"]
    Admin["管理後台<br/>React, 獨立 Vite entry,無帳號登入"]
    PublicAPI["FastAPI — Public API<br/>port 8000"]
    AdminAPI["FastAPI — Admin API<br/>port 8001"]
    SQLite[("SQLite<br/>site 登錄表 +<br/>per-site per-category SLO 設定")]
    Grafana["Grafana /api/ds/query<br/>匿名存取,唯讀"]
    Postgres[("Postgres<br/>slo, slo_target,<br/>grafana_mapping, geo")]

    Public -- Axios --> PublicAPI
    Admin -- Axios --> AdminAPI
    PublicAPI -- "httpx + cachetools TTL cache" --> Grafana
    AdminAPI --> SQLite
    Grafana --> Postgres
```

- Backend **完全不寫回** Grafana 的 Postgres——我們對那邊只有(也只想要)查詢權限,那是共用的上游基礎設施,同時也被既有的 Grafana dashboard 使用中。
- 我們自己的 SQLite 是「要追蹤哪些 site、怎麼標示它們」的權威登錄表(城市名稱、國家、經緯度這些 Grafana 資料裡沒有的展示資訊),也存每個 site 各 category 的 SLO target 與是否計入平均。即時 SLO 數字仍然每次即時向 Grafana 查詢(經過 TTL cache),**不會**複製一份存進 SQLite。
- Public API 和 Admin API 拆成兩個 port,讓沒有登入機制的後台可以在網路層(防火牆/內網限制)做存取控制,不用另外做一套帳號系統(部署成單一 image 時則改用 ingress/network policy 做同樣的事,見[部署](#部署docker-image))。

## 資料來源

所有資料都透過 Grafana 自己的查詢代理(`POST /api/ds/query`)讀取,不直接連資料庫——這座 Grafana 對 search、datasources、query 這些 API 開放匿名讀取,所以 backend 只需要知道 `GRAFANA_BASE_URL`,不需要帳密。

相關的 Postgres 資料表(datasource 名稱 `K8S-SRE-Postgres-SQL`):

| 資料表 | 用途 |
|---|---|
| `slo` | 每個 `cluster_id` × `category`(如 `K8S-Node`、`K8S-ETCD`、`K8S-API SERVER` 等)的每日/每週 `min_slo`——真正的營運歷史數據 |
| `slo_target` | 各分類的 SLO 目標值(目前全域統一 99.0%) |
| `grafana_mapping` | `cluster_id` → 該 cluster 自己的 Grafana 網址(用來做「查看即時明細」的外部連結) |
| `geo` | site 代碼、經緯度,以及一個 `SLO` 快照欄位——**這個 `SLO` 欄位實測跟 `slo` 表算出來的最新值對不上、疑似沒在維護,不要拿它當現況依據,只能當經緯度查詢用(或乾脆改用我們自己 SQLite 的登錄表)。** |

即時 Prometheus SLI(CPU、ETCD 延遲、API server 錯誤率等各元件的即時 gauge)只有這座 Grafana本地那一個 cluster 查得到——其餘 cluster 各自有獨立的 Grafana/Prometheus(透過 `grafana_mapping.url` 連結),backend 不會直接查詢它們。

實際追蹤哪些 site(代碼、城市、國家、經緯度)屬於機密資訊,**不寫在這份文件或任何進版控的檔案裡**——真實清單放在 `backend/site_registry.seed.json`(gitignored),格式範例見 `backend/site_registry.seed.example.json`。

## 技術棧

| 分層 | 技術 | 選用原因 / 用法備註 |
|---|---|---|
| Backend 語言 | Python 3.11 | |
| Backend 框架 | FastAPI | async 原生支援,搭配 `httpx.AsyncClient` 打 Grafana API 不會卡住 event loop |
| Backend 套件管理 | uv | `uv init` / `uv add` / `uv run`,鎖檔用 `uv.lock` |
| 設定與驗證 | pydantic-settings | 從 `.env` 讀 `Settings`,啟動時就做型別驗證,設定值錯誤直接啟動失敗而不是執行到一半才炸 |
| Grafana 查詢快取 | cachetools(`TTLCache`) | 依「查詢字串(SQL/PromQL)」當 cache key,避免前端輪詢時每次都直接打 Grafana;TTL 由 `CACHE_TTL_SECONDS` 設定 |
| 本地儲存 | SQLite(`aiosqlite`) | 只存 site 登錄表跟 per-site per-category SLO 設定,不存即時指標(那些永遠現查 Grafana) |
| 前端語言 | TypeScript | |
| 前端框架 | React 18+ | |
| 路由 | TanStack Router(file-based) | 用檔案系統決定路由,型別安全的路由參數(如 `/sites/$code`) |
| 樣式 | Tailwind CSS | |
| HTTP client | Axios | 前端統一透過一個 Axios instance(`lib/api.ts`)打自己的 backend,不直接打 Grafana |
| 圖示 | lucide-react | |
| 打包工具 | Vite | 前台、後台各自獨立的 Vite 專案(兩個 `package.json`) |
| 測試 | pytest + pytest-asyncio(後端)| service 層邏輯用 mock 過的 `GrafanaClient` 測,不必每次測試都真的打 Grafana |

## 資料模型(SQLite)

```sql
-- site 登錄表:我們自己維護的「要追蹤哪些 site」清單
CREATE TABLE sites (
    code            TEXT PRIMARY KEY,   -- 例如 'ABC',對應 Grafana cluster_id 前綴
    display_name    TEXT NOT NULL,      -- 城市顯示名稱,如 'Example City'
    country         TEXT NOT NULL,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    cluster_prefix  TEXT NOT NULL,      -- 對應 Grafana slo.cluster_id 的 LIKE 前綴,如 'abc'
    enabled         INTEGER NOT NULL DEFAULT 1,  -- 0/1,停用後不在主看板顯示
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- 每個 site、每個 category(K8S-Node/ETCD/ArgoCD/...)各自的 SLO 設定。
-- 一個 site 「現在的 SLO」= 該 site 底下所有 included=1 的 category 的
-- 即時數值平均;「target」= 同一組 included 分類的 target_pct 平均——
-- 兩者用同一組分類算,才有意義互相比較。
-- 沒有出現在這張表的 (site, category) 組合,視同 target_pct=99.0、included=1。
CREATE TABLE site_category_targets (
    site_code   TEXT NOT NULL REFERENCES sites(code),
    category    TEXT NOT NULL,
    target_pct  REAL NOT NULL DEFAULT 99.0,
    included    INTEGER NOT NULL DEFAULT 1,  -- 0/1,是否計入該 site 的 SLO 平均
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (site_code, category)
);
```

初始資料由 `backend/app/seed.py` 灌入,實際內容讀取自 `backend/site_registry.seed.json`(gitignored,機密——見上方[資料來源](#資料來源))。首次設定時複製 `backend/site_registry.seed.example.json` 為 `site_registry.seed.json` 並填入真實 site 清單;也可以不跑 seed script,直接在後台 `/admin` 頁面手動新增 site。

**為什麼「目前 SLO」是分類平均,不是直接抓 Grafana 現成的彙總值**:早期版本直接用 `slo` 表裡「整個 site 當週最小值」當作目前 SLO,結果曾經發生某個 category(如 ArgoCD)當週實際出問題,但因為判斷「這週資料是否完整」的邏輯只看數值是不是剛好 0,把那週的異常資料整個當成「還沒跑完」略過不採計,導致主看板卡片跟地圖燈號完全沒反映出這個真實異常。改成「取有勾選的分類做平均」之後,這個問題不會再發生,而且哪些分類要不要算進site的 SLO、各自的 target 是多少,都能在後台 `/admin` 頁面每個 site 卡片的 Edit 裡直接設定。

## 環境變數(`backend/.env`)

`.env` 不進版控,啟動前照 `backend/.env.example` 複製一份填入實際值——真實的 Grafana 位址與 datasource uid 只存在這份本機檔案裡。

| 變數 | 說明 | 範例 |
|---|---|---|
| `GRAFANA_BASE_URL` | Grafana 實例位址(機密,只在 `.env`) | `http://<internal-grafana-host>:3000` |
| `GRAFANA_POSTGRES_DATASOURCE_UID` | Postgres datasource 的 uid(機密,只在 `.env`) | `<postgres-datasource-uid>` |
| `GRAFANA_PROMETHEUS_DATASOURCE_UID` | 本地 cluster 的 Prometheus datasource uid(機密,只在 `.env`) | `<prometheus-datasource-uid>` |
| `LOCAL_CLUSTER_ID` | 這座 Grafana 能查到即時 SLI 的那個 cluster_id(機密,只在 `.env`) | `<local-cluster-id>` |
| `CACHE_TTL_SECONDS` | Grafana 查詢結果快取秒數 | `90` |
| `SQLITE_PATH` | SQLite 檔案路徑 | `./data/wwsre.db` |
| `PUBLIC_API_PORT` | Public API 監聽 port | `8000` |
| `ADMIN_API_PORT` | Admin API 監聽 port | `8001` |

## 專案目錄結構

```
backend/
  app/
    config.py                    # pydantic-settings
    cache.py                     # cachetools TTLCache 包裝 + stale-fallback
    grafana_client.py            # httpx client,包 /api/ds/query
    db.py                        # SQLite 連線與 schema 初始化
    seed.py                      # site 初始資料灌入腳本
    sql_safety.py                # 拼進 Grafana rawSql 前的識別字元驗證(防注入)
    dependencies.py               # FastAPI Depends(GrafanaClient/Settings)
    schemas.py                    # pydantic request/response models
    services/
      slo_service.py             # 整合 site 登錄表 + 即時 Grafana 資料,tier/target 計算
      slo_target_service.py      # per-site per-category SLO 設定讀寫
      site_admin_service.py      # site CRUD
      live_service.py            # 即時 Prometheus SLI(僅本地 cluster)
    routers/
      public.py                  # /api/public/*
      admin.py                   # /api/admin/*
    main_public.py                # uvicorn entrypoint,port 8000
    main_admin.py                 # uvicorn entrypoint,port 8001
  tests/
frontend/
  src/
    routes/                      # TanStack Router file-based 路由
    components/
    lib/api.ts                   # Axios instance
admin-frontend/
  src/                           # 獨立 Vite entry,卡片式 CRUD UI
deploy/
  nginx.conf, entrypoint.sh, certs/   # 單一 image 部署用(見下方「部署」)
Dockerfile                        # repo 根目錄,單一 image 三階段 build
```

## API 設計

**Public API(port 8000)**

| Method | Path | 回傳內容 |
|---|---|---|
| GET | `/api/public/sites` | 全部啟用中的 site:代碼、城市、國家、經緯度、目前 SLO(有勾選分類的平均)、target(同一組分類的 target 平均)、燈號狀態、近期歷史序列、cluster 數量 |
| GET | `/api/public/sites/{code}/clusters` | 該 site 底下各 cluster 的 SLO 明細(跟該 site 自己的 target 比較) |
| GET | `/api/public/sites/{code}/categories` | 該 site 各分類(K8S-Node/ETCD/...)最新一筆的平均與最差 SLO,各自對應該分類在後台設定的 target |
| GET | `/api/public/categories` | 全域各分類(K8S-Node/ETCD/...)的平均與最差 SLO(跨所有 site,固定用全域預設 target 99.0%) |
| GET | `/api/public/trend` | 全站週趨勢(平均值序列) |
| GET | `/api/public/clusters/{id}/live` | 即時 SLI(僅本地 cluster 有效;其餘回傳 `{"available": false, "external_url": "..."}`) |

以上每個端點的回應都會帶一個 `X-Stale-Data` header(`true`/`false`)。Grafana 打不通時,backend 會回傳上一次成功查詢的結果並標記 `true`,而不是直接讓請求失敗——前端主看板的「live/syncing」燈號在這個情況下會改顯示「stale」。

**Admin API(port 8001)**

| Method | Path | 說明 |
|---|---|---|
| GET | `/api/admin/sites` | 列出全部 site(含停用的) |
| POST | `/api/admin/sites` | 新增 site |
| PATCH | `/api/admin/sites/{code}` | 編輯 site 資訊或啟用/停用 |
| DELETE | `/api/admin/sites/{code}` | 刪除 site |
| GET | `/api/admin/sites/{code}/categories` | 該 site 每個 category 目前的 target_pct 與是否計入平均(沒設定過的 category 回傳預設值 99.0/計入) |
| PUT | `/api/admin/sites/{code}/categories` | 整批覆寫該 site 的 category 設定(送入的清單即為新的完整設定) |

目前 `/admin` 這組 API **沒有任何登入/驗證機制**,存取控制完全靠部署層的網路隔離(獨立 port,或部署成同一個 image 時靠 ingress/network policy 限制來源)——細節見下方[部署](#部署docker-image)。

## 本機開發

```bash
# Backend — Public API
cd backend
uv run uvicorn app.main_public:app --reload --port 8000

# Backend — Admin API(另開一個終端機)
cd backend
uv run uvicorn app.main_admin:app --reload --port 8001

# 前台
cd frontend
npm install
npm run dev            # 預設 http://localhost:5173

# 後台
cd admin-frontend
npm install
npm run dev            # 另一個 Vite port,如 http://localhost:5174
```

**測試**

```bash
cd backend && uv run pytest        # 38 個測試
cd frontend && npm test            # Vitest,元件測試(9 個)
cd admin-frontend && npm test      # Vitest,元件測試(4 個)
```

## 部署(Docker image)

一個 image 就能跑完整套系統:public 前端在 `/`、admin 前端在 `/admin`、兩個 FastAPI backend 各自在容器內部的 8000/8001 port,前面統一由一個 nginx 擋在對外的 8080 port,依路徑分流。完整說明(build/push/run 指令、CA 憑證放置方式)見 [deploy/README.md](deploy/README.md),重點摘要:

- `Dockerfile`(repo 根目錄)三階段 build:public 前端(base path `/`)、admin 前端(base path `/admin/`)、Python 依賴,最後組成單一 image。
- **不會把 `.env`、`site_registry.seed.json` 這類機密檔案打進 image**——`.dockerignore` 已排除,執行時改用 k8s Secret(或 `docker run --env-file`)在 runtime 注入。
- 如需讓容器信任內部 CA,依 [deploy/certs/README.md](deploy/certs/README.md) 的說明,build 前把憑證放到 `deploy/certs/internal-ca.crt`(gitignored,不進版控)。
- **`/admin` 目前沒有任何存取控制**(沒有登入頁,也沒有網路隔離)——正式對外部署前,務必在 ingress / network policy 那層限制誰能連到這個路徑,不要直接曝露這個 port。
- 真正的 registry 位址與專案路徑屬於內部資訊,不寫在這裡或任何進版控的檔案——build/push 指令用你自己環境的實際值執行,格式參考 `deploy/README.md` 裡的 `<your-registry>/<your-project>` 佔位符。

## 開發路線圖

逐項可勾選清單見 [plan.md](plan.md);以下是各階段的重點:

1. **地基**——repo 骨架(uv + Vite)、設定檔、SQLite schema 與 site 清單的 seed script
2. **Backend 唯讀資料層**——`GrafanaClient`、TTL cache、整合登錄表與即時 SLO 的 `slo_service`
3. **Public API**——`/api/public/sites`、`/sites/{code}/clusters`、`/categories`、`/trend`、`/clusters/{id}/live`
4. **Admin API**——site 的 CRUD、per-site per-category SLO 設定讀寫,port 8001
5. **主看板前端**——世界地圖(`d3-geo` + 真實 topojson,動態投影與版面配置)、KPI 列、趨勢圖、site 卡片網格(右側固定張數 + 下方其餘,地圖與選點連線互動)
6. **後台管理前端**——卡片式 CRUD、每個 site 可展開設定 9 個 category 各自的 target 與是否計入平均、無登入機制、獨立打包
7. **打磨**——Grafana 連不上時的優雅降級(回傳最後一次快取資料並標記 `stale`)、響應式與無障礙檢查、測試
8. **部署**——單一 Docker image(public `/` + admin `/admin` + 兩個 backend,見上方[部署](#部署docker-image))

## 待確認事項

- `geo.SLO` 資料過時的問題(見[資料來源](#資料來源))要決定:完全忽略,還是去查是哪支排程在寫入、為什麼會跟 `slo` 對不上。
- 「異常·無影響」跟「異常·有影響」的分類門檻,上游沒有明確定義;目前用的是預設門檻(≥target 正常、95–target 無影響、<95 有影響),需要確認是否合理。
- `/admin` 目前完全沒有存取控制,正式對外部署前要決定用什麼方式限制(見[部署](#部署docker-image)裡的提醒)。
