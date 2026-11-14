# kit 套組與對外介紹站 — 設計

2026-11-14。Jeff 在對話中核准（「GO」）。

## 為什麼

kit 有三十個左右，各自一個 repo。作品站的 kit 區是一個 kit 一張卡的清單，回答的是「我有什麼」。
Jeff 要的是整體的概念：更整合、更好抽來用，像 skill 包或套件。對象是外面的台灣開發者，讓人拿走用。

## 目標

- kit 上面多一層**套組**：做一件事（收費、登入…）要用的幾個 kit、接線順序、合在一起的打法。
- 一份套組定義供三個出口使用：介紹站、`kit-kit add <套組>` 指令、寫進專案的 skill 檔。
- 中文介紹站，內容在 build 時從 registry 與各 repo 產生，改 kit 後站會跟上。

## 不做

- 不新增 repo；套組只是 kit-kit 裡的一份定義。
- 不動任何 repo 的公開狀態。私有 repo 不出現在站上。
- 不做英文版、不做搜尋、不做留言或統計。
- 不重寫現有 SKILL.md 的內容（補缺的、清理對外用語是另一件事，一包一包做）。

## 會讓它失敗的事

- 站上出現私人網域、IP、金鑰、私有 repo 的內容。
- 站上的指令照抄跑不起來，或套組頁說的接線順序跟 kit 實際 API 對不上。
- 頁面底色跳來跳去、插畫鋪成段落背景、emoji 徽章（Jeff 明確不要）。

## 考慮過的做法

| 做法 | 取捨 |
|---|---|
| A. 蓋在 kit-kit repo，自己的零依賴產生器 → GitHub Pages | 樣式與 markdown 轉換要自己寫；套組定義與指令共用同一份資料，長相完全可控。**採用。** |
| B. 擴充作品站的 kit 區 | 最省工，但資料來源是 GitHub 公開資料不是 registry，網址是作品站底下一頁，不像一個能拿來用的東西。 |
| C. VitePress 之類的文件站框架 | 一天上線，但長得跟所有文件站一樣，套組與「複製給 AI」得硬塞進文件版型；幫零依賴的 kit 蓋一個依賴很重的站。 |

Jeff 選 A。

## 設計

### 套組定義 `packs.json`

```json
{ "packs": [ {
  "id": "billing", "name": "收費", "solves": "…一句話…",
  "kits": [ { "name": "paywall-kit", "role": "…在這包裡負責什麼…" } ],
  "steps": [ "…接線順序，一步一行…" ]
} ] }
```

六包：`billing` 收費、`auth` 會員與防護、`video` 影片、`growth` 成長、`upload` 上傳、`electron` Electron。
順序即首頁順序，收費帶頭。成員只列公開的 kit。

**可用**的定義：成員全部公開，且每個都有 SKILL.md。不可用的套組在首頁列為「整理中」並寫出缺哪幾個打法，
沒有自己的頁面，`add` 會拒絕並說明原因。補齊後自動變可用，不用改程式。

### 指令

- `kit-kit packs`：列出套組、成員、是否可用。
- `kit-kit add <id 或中文名> [--dir <專案>] [--no-install] [--skills-dir <路徑>]`：
  1. 抓每個成員的 SKILL.md，合成一份寫到 `<專案>/.claude/skills/<id>-pack/SKILL.md`
     （檔頭有 name/description、接線順序，後面接各成員打法）。
  2. 專案有 `package.json` 且沒加 `--no-install` → `npm i github:<owner>/<kit> …`；否則印出指令。
  3. 印接線順序。
  任何一個成員抓不到 SKILL.md 就整個中止，不寫半套。

### 介紹站

位置：`site/`，輸出 `_site/`（不進 git），發到 kit-kit 的 GitHub Pages。全站用相對連結，本機直接開也能看。

資料：registry + packs.json + GitHub（repo 是否公開、預設分支、README、SKILL.md 是否存在、logo.svg）。
抓取與產頁分開：`fetch.js` 抓、`model.js` 組資料、`render.js` 產 HTML，後兩者是純函式，測試用假資料跑。

頁面：

- **首頁**：定位 + 帶頭套組的「裝箱單」；可用套組卡片；整理中的套組；兩種拿法示範；全部 kit（依類型分組，自架服務另列）。
- **套組頁**（只有可用的）：解決什麼、裝箱單、怎麼串（接線順序）、兩種拿法（複製指令 / 複製給 AI）、成員 kit。
- **kit 頁**（所有公開 kit）：一句話、安裝指令、所屬套組、README 全文。

README 全文照登；**SKILL.md 不在站上展開**，只標「附打法」並連到 GitHub 上的檔案（我的判斷：
現有 SKILL.md 是寫給自己人的，滿是內部專案名與事故紀錄，原樣攤在對外站上不合適；
agent 透過 `add` 仍讀得到全文）。

外觀沿用 Jeff 喜歡的專案介紹站風格（同一組 token、深淺色、Noto Sans TC + IBM Plex Mono）：
整頁一個底色、段落靠留白與細線分隔、主視覺物件是裝箱單。數字標「截至」日期，不寫星數。

文案集中在 `site/copy.json`，改字不用碰程式。初版文字是平鋪直敘的草稿，等 Jeff 換成他的話。

### 安全

- 只收 `private === false` 的 repo（本機 build 帶著 gh 權杖時也一樣）。
- markdown 轉換一律先跳脫，HTML 區塊丟掉，連結只放行 http(s)、相對路徑與錨點。
- 產出後掃一遍 `_site`，出現 IPv4 位址或 `PRIVATE KEY` 就讓 build 失敗。
  私人網域由 lowkey guard 在各 kit push 時擋，站這邊不重複存一份名單（名單本身就是洩漏）。

### 部署

`.github/workflows/site.yml`：push 到 master、手動觸發、每天一次排程 → build → 測試 → 發 Pages。

### 同時要補的

- `ratelimit-kit`、`media-gate` 補 SKILL.md（依 README 與原始碼寫），「會員與防護」才湊得齊。
- registry 補上漏標的 `skill: true`。
- kit-kit 的 `.repo`、README 加上套組與站的說明；repo homepage 指向站。

## 留給實作決定

版面細節、markdown 轉換支援到哪些語法（以現有 README 用到的為準）、測試怎麼切。
