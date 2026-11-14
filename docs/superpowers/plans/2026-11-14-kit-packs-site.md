# kit 套組與對外介紹站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** kit 上面加一層「套組」，一份定義同時供 CLI（`packs` / `add`）與中文介紹站（GitHub Pages）使用。

**Architecture:** `packs.json` 是唯一的套組定義；`packs.js` 放純邏輯（查找、可用判定、合成 skill、安裝指令、給 AI 的提示）。介紹站在 `site/`：`fetch.js` 抓 GitHub、`model.js` 組資料、`md.js` 轉 markdown、`render.js` 產 HTML，後三者是純函式。`site/build.js` 串起來寫到 `_site/`。

**Tech Stack:** Node 22 內建模組（`fs`、`path`、`child_process`、全域 `fetch`、`node:test`）。零依賴。GitHub Actions + Pages。

**Spec:** `docs/superpowers/specs/2026-11-14-kit-packs-site-design.md`

## Global Constraints

- 零依賴，CommonJS，沿用 repo 現有寫法。
- 只收 `private === false` 的 repo；私有 repo 的名字與內容都不進站。
- markdown 一律先跳脫；HTML 區塊丟掉；連結只放行 `http(s)`、相對路徑、`#錨點`。
- 全站相對連結（Pages 在 `/kit-kit/` 底下，本機直接開也要能看）。
- 整頁一個底色；不用 emoji 徽章；數字標「截至」日期，不寫星數。
- 站上文字全部來自 `site/copy.json`、`packs.json`、registry、各 repo README。
- 套組 id：`billing` `auth` `video` `growth` `upload` `electron`，此順序即首頁順序。
- 「可用」＝成員全部公開且都有 SKILL.md。

## Review Focus

1. README 裡有原始 HTML 或 `<script>` → 不得原樣輸出（Task 3 測試）。
2. 連結是 `javascript:` → 不產生 `href`（Task 3 測試）。
3. 本機 build 帶 gh 權杖時抓到私有 repo → 仍不得進站（Task 4 測試：`public:false` 的 kit 不在 model 裡）。
4. `add` 時有成員抓不到 SKILL.md → 不寫任何檔案（Task 2 測試）。
5. `add` 給了不存在或整理中的套組 → 明確錯誤、不安裝（Task 2 測試）。

---

### Task 1: 套組定義與純邏輯

**Files:** Create `packs.json`, `packs.js`, `test/packs.test.js`. Modify `registry.json`（三個私有 kit 加 `"private": true`；有 SKILL.md 卻漏標的補 `"skill": true`）。

**Produces:**
- `loadPacks(packsPath?) -> Pack[]`，`Pack = { id, name, solves, kits: [{ name, role }], steps: string[] }`
- `findPack(packs, query) -> Pack | null`（id 或中文名，不分大小寫）
- `registryKitInfo(reg) -> { [name]: { public: boolean, skill: boolean } }`
- `packStatus(pack, kitInfo) -> { ready: boolean, missing: [{ name, reason: 'unknown' | 'private' | 'no-skill' }] }`
- `installCommand(pack, kits, owner) -> string | null`（只含 type 為 kit / component 或未標 type 的成員）
- `aiPrompt(pack, owner) -> string`
- `composePackSkill(pack, skills, owner) -> string`（`skills = { [kitName]: markdown }`；去掉各成員的 frontmatter；缺任何一個就 throw）

- [ ] 測試：`findPack` 用 `billing`、`收費`、`BILLING` 都找得到，`nope` 回 null。
- [ ] 測試：`packStatus` 成員全公開且有 skill → `ready: true`；缺 skill → `missing[0].reason === 'no-skill'`；registry 沒有 → `'unknown'`；私有 → `'private'`。
- [ ] 測試：`composePackSkill` 輸出以 `---\nname: billing-pack` 開頭、含每個 step、含各成員正文、不含成員的 frontmatter 行；缺一個成員 → throw 且訊息含該 kit 名。
- [ ] 測試：`installCommand` 對 billing 回 `npm i github:Jeffrey0117/newebpay-kit github:Jeffrey0117/paywall-kit`（依 packs.json 的成員順序）；成員全是 service → null。
- [ ] 測試：真的 `packs.json` 六包 id 與順序符合 Global Constraints，每個成員都在 registry 裡。
- [ ] 跑測試確認失敗 → 實作 → 通過 → commit。

### Task 2: CLI `packs` 與 `add`

**Files:** Modify `packs.js`（加 `addPack`）、`cli.js`、`index.js`（export packs 函式）。Test `test/packs-add.test.js`。

**Produces:** `addPack(pack, { dir, owner, kits, kitInfo, fetchSkill, run, install = true, skillsDir = '.claude/skills' }) -> { skillPath, command, installed }`
- 整理中的套組 → throw（訊息列出缺什麼）。
- 先抓齊所有 SKILL.md 才寫檔；任一個抓不到 → throw，`dir` 下不留檔。
- `install` 為真且 `dir/package.json` 存在且 `command` 非 null → `run(command, dir)`，`installed: true`。

- [ ] 測試（用暫存目錄與假的 `fetchSkill` / `run`）：成功時檔案寫在 `<dir>/.claude/skills/billing-pack/SKILL.md`；沒有 package.json → `run` 沒被呼叫、`installed: false`；`install: false` → 不呼叫。
- [ ] 測試：一個成員 `fetchSkill` 回 null → throw，暫存目錄下沒有 `.claude`。
- [ ] 測試：整理中的套組 → throw，`run` 沒被呼叫。
- [ ] `cli.js`：`packs`（列出每包：可用 / 整理中 + 缺什麼）、`add <query> [--dir] [--no-install] [--skills-dir]`；找不到套組時列出可用的 id；help 文字補上。
- [ ] 實跑 `node cli.js packs`、`node cli.js add billing --dir <暫存> --no-install`，檢查輸出與檔案 → commit。

### Task 3: markdown 轉換

**Files:** Create `site/md.js`, `test/site-md.test.js`.

**Produces:** `escapeHtml(s)`, `renderMarkdown(md, { repoUrl, rawUrl }) -> string`
支援：`#`–`####` 標題、段落、圍欄程式碼、行內 code、粗體、連結、圖片、有序 / 無序清單、表格、引用、分隔線。
HTML 區塊（以 `<` 開頭的行到下一個空行）丟掉。相對連結 → `repoUrl/blob/<branch>/…`，相對圖片 → `rawUrl/…`。

- [ ] 測試：`<script>alert(1)</script>` 與 `<p align="center"><img …></p>` 不出現在輸出；段落裡的 `<b>` 被跳脫成 `&lt;b&gt;`。
- [ ] 測試：`[x](javascript:alert(1))` 輸出不含 `href="javascript`；`[x](https://a.b)` 有 href；`[x](docs/a.md)` 指向 repoUrl。
- [ ] 測試：圍欄程式碼內的 `**a**` 與 `<` 原樣跳脫不轉換；表格產生 `<table>` 且欄數正確；清單項內的行內 code 有轉換。
- [ ] 失敗 → 實作 → 通過 → commit。

### Task 4: 資料模型

**Files:** Create `site/model.js`, `test/site-model.test.js`.

**Consumes:** `packs.js` 的 `packStatus`、`installCommand`、`aiPrompt`。
**Produces:** `buildModel({ registry, packs, repos, asOf }) -> { owner, asOf, kits, packs, stats }`
- `repos = { [name]: { public, branch, readme, hasSkill, logo } }`（抓不到的 repo 不在物件裡）
- `kits`：只含 `repos[name].public === true` 的；每個 `{ name, slug, covers, type, repo, install, hasSkill, readme, branch, logo, packs: [packId] }`
- `packs`：每個 `{ ...Pack, ready, missing, members: [kit | { name, absent: true }], command, prompt }`
- `stats = { kits, readyPacks, withSkill }`

- [ ] 測試：`public: false` 的 kit、`repos` 裡沒有的 kit 都不在 `model.kits`，名字也不出現在 `JSON.stringify(model)`（成員列表裡以 `absent` 表示且不帶 covers）。
- [ ] 測試：成員全公開有 skill → `ready`；`stats` 數字正確；kit 的 `packs` 反查正確。
- [ ] 失敗 → 實作 → 通過 → commit。

### Task 5: 頁面

**Files:** Create `site/render.js`, `site/style.css`, `site/app.js`, `site/copy.json`, `test/site-render.test.js`.

**Produces:** `renderSite(model, copy) -> [{ path, content }]`
路徑：`index.html`、`packs/<id>/index.html`（只有 ready 的）、`kits/<slug>/index.html`、`assets/style.css`、`assets/app.js`、`assets/logos/<slug>.svg`。

- [ ] 測試：ready 的套組有頁面、整理中的沒有；每個公開 kit 有頁面。
- [ ] 測試：所有 HTML 裡的站內 `href` / `src` 都是相對路徑，且指向 `renderSite` 回傳清單裡存在的檔案（斷連結檢查）。
- [ ] 測試：套組頁含安裝指令與 `aiPrompt` 全文（跳脫後）；kit 的 covers 含 `<` 時被跳脫。
- [ ] 版面照 spec：topbar、hero + 裝箱單、套組卡、整理中、兩種拿法、全部 kit（依類型分組）。複製鈕由 `app.js` 處理（`data-copy`）。
- [ ] 失敗 → 實作 → 通過 → commit。

### Task 6: 抓取與 build

**Files:** Create `site/fetch.js`, `site/build.js`, `test/site-build.test.js`. Modify `package.json`（`"site": "node site/build.js"`）、`.gitignore`（`_site/`）。

**Produces:**
- `fetchRepos(owner, names, { fetchImpl, token }) -> repos`：`GET /users/<owner>/repos`（分頁）取公開狀態與預設分支，只對 `private === false` 的抓 raw `README.md`、`SKILL.md`（只記有無）、`logo.svg`。
- `scanLeaks(files) -> [{ path, match }]`：IPv4 位址（排除 `127.0.0.1`、`0.0.0.0`）與 `PRIVATE KEY`。
- `build.js`：抓 → model → render → scanLeaks 有東西就 exit 1 → 寫 `_site/`。

- [ ] 測試（假 `fetchImpl`）：私有 repo 完全沒有對 raw 的請求；README 404 → `readme: ''` 不 throw。
- [ ] 測試：`scanLeaks` 抓到 `10.1.2.3` 與 `BEGIN PRIVATE KEY`，放過 `127.0.0.1` 與版本號 `1.2.3`。
- [ ] `npm run site` 實跑，開 `_site/index.html` 看版面（深淺色、手機寬度），修到滿意 → commit。

### Task 7: 補兩份 SKILL.md

**Files（別的 repo）:** `ratelimit-kit/SKILL.md`、`media-gate/SKILL.md`。依各自 README 與 `index.js` 寫，照 kit-kit scaffold 的格式（何時觸發 / 接線 / 模式 / 地雷）。只寫程式碼驗證得到的事。

- [ ] clone 兩個 repo → 寫 → commit → push → `kit-kit audit` 各跑一次。
- [ ] registry 兩個都補 `"skill": true` → commit。

### Task 8: 上線

**Files:** Create `.github/workflows/site.yml`. Modify `.repo`、`README.md`。

- [ ] workflow：push master / `workflow_dispatch` / 每日排程 → `npm test` → `npm run site` → 發 Pages。
- [ ] `.repo` 加 `packs`、`add`、站的 offers；README 加套組一節。
- [ ] push → 啟用 Pages（build_type workflow）→ 等 workflow 綠 → 打開線上網址確認首頁、一個套組頁、一個 kit 頁 → `gh repo edit --homepage`。
