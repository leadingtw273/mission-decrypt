# Plan 3 — Authoring + Deployment

> **Execution mode**: 全部 task 由 `codex exec --skip-git-repo-check --sandbox workspace-write` 執行；Claude 主導 prompt 與驗證。codex 不 commit（sandbox .git readonly）。

**Goal:** 完成端對端系統：指揮官可在部署的網站開 DevTools，呼叫 `window.fleetOps.launchAuthoring()` 開啟 in-page modal 產生加密任務，下載 JSON，git push 部署，團員可解密。涵蓋 Ed25519 commander identity 持久化、authoring modal UI、fleetOps API、跨瀏覽器 e2e、deployment 設定。

**Architecture:** 利用 Plan 1（crypto library）與 Plan 2（decryption frontend）。新增 `src/authoring/`（identity, modal, generate logic）；註冊 `window.fleetOps` 入口；更新 `getCommanderPublicKey()` 讓它讀 IndexedDB 中的 identity public key（fallback 到 build-time placeholder）。

**Tech Stack:** Plan 1+2 stack（不新增依賴）。可能用 React Portal 渲染 modal。

**Reference spec:** `docs/superpowers/specs/2026-04-28-vesper-mission-design.md` §3.6, §3.8, §5, §6, §9

---

## File Structure

新增檔案（all by codex）：

```
src/
├── authoring/
│   ├── identity.ts              # IndexedDB wrapper: load/save/clear commander Ed25519 keypair + JWK export/import
│   ├── identity.test.ts
│   ├── pickImage.ts             # File API → { bytes: Uint8Array; mimeType: string; altText: string }
│   ├── pickImage.test.ts
│   ├── generateMission.ts       # 包 src/crypto/index.ts 的 encryptMission，加上 mission/member 結構驗證、build URL
│   ├── generateMission.test.ts
│   ├── AuthoringModal.tsx       # 表單 + 預覽 + state machine
│   ├── AuthoringModal.test.tsx
│   ├── PostGenerationView.tsx   # 顯示 links table 含 copy buttons
│   ├── PostGenerationView.test.tsx
│   ├── fleetOps.ts              # window.fleetOps API surface
│   └── fleetOps.test.ts         # 註冊與 help() 內容測試
├── publicKeys/
│   └── commanderPublicKey.ts    # 升級：identity > dev fallback > placeholder 三層 precedence
└── main.tsx                     # 更新：取代 cross-browser harness 為 fleetOps registration + banner

tests/e2e/
└── authoring-decryption.spec.ts # 端對端 Playwright：authoring → 下載 → mock /missions/<id>.json → 解密
```

修改：
- `src/main.tsx`: 新增 fleetOps 註冊；保留 cross-browser-harness 條件式
- `src/publicKeys/commanderPublicKey.ts`: 加 identity precedence
- `package.json`: 加 deploy script (optional)
- 新增 `wrangler.toml` 或 `vercel.json`（依使用者選擇平台；spec 說 Cloudflare Pages 推薦）

---

## 共用 codex prompt 範本

每個 task 執行：

```bash
codex exec --skip-git-repo-check --sandbox workspace-write \
  -C /home/markchou/project/vesper-mission \
  "<task prompt>" < /dev/null 2>&1
```

通用 prompt 前綴：

```
你是 React + TypeScript senior engineer，工作於 /home/markchou/project/vesper-mission。

## 嚴格規範
- TDD（先寫失敗測試 → 寫實作 → 確認通過）
- pnpm（不是 npm/yarn）
- TS strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess 全開
- 完成跑 pnpm typecheck && pnpm test 兩者必須清潔
- **不要 commit**（sandbox .git readonly，由 controller 處理）
- 報告格式：Status / Files changed / typecheck output / test output / Concerns

## 既有資源
- src/crypto/: 完整 crypto library（encryptMission, decryptMission, generateSigningKeypair, exportPublicKey, importPublicKey, fingerprint, etc.）
- src/decryption/: state machine + loadAsset + useDecryptionMachine
- src/components/: LockedView, DecryptingView, DecryptedView, ErrorView, shared/
- src/publicKeys/commanderPublicKey.ts: dev/prod 雙 key，需擴充為三層 precedence
- src/styles/: Tailwind v4 + design tokens
- @testing-library/react + jsdom + framer-motion + zod 已安裝

## 不要做的
- 不要動 src/crypto/、docs/、既有 task 完成的檔案除非規格指定
```

---

## Task 3.1: Identity 持久化（IndexedDB）

**Files:** `src/authoring/identity.ts` + tests

**Codex prompt:**

```
[通用前綴]

任務：建立 commander Ed25519 keypair 的 IndexedDB 持久化。

API:
- export async function loadIdentity(): Promise<CommanderIdentity | null>  // 從 IndexedDB 取
- export async function saveIdentity(keypair: CryptoKeyPair): Promise<void>  // 寫入 IndexedDB（CryptoKey extractable=true，存 jwk）
- export async function clearIdentity(): Promise<void>
- export async function exportIdentityJwk(): Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey } | null>  // 給 backup 用
- export async function importIdentityJwk(input: { publicKey: JsonWebKey; privateKey: JsonWebKey }): Promise<void>  // 從備份還原
- export async function getCommanderPublicKeyFingerprint(): Promise<string | null>  // 用 src/crypto/sign.ts 的 fingerprint

interface CommanderIdentity { publicKey: CryptoKey; privateKey: CryptoKey }

實作：
- IndexedDB DB name: 'vesper-mission'
- Object store: 'commander-identity'
- Single record key: 'self'
- Stored value: { publicKeyJwk, privateKeyJwk, createdAt, fingerprint }（jwk 已 extractable，可 re-import）

測試（用 fake-indexeddb 或 happy-dom 內建 IndexedDB；如果 jsdom 不支援 IDB 則 mock 整個介面）：
- save/load 來回正確
- 沒 identity 時 loadIdentity 回 null
- clear 後 loadIdentity 回 null
- exportIdentityJwk 後 importIdentityJwk 回原始（fingerprint 不變）
- getCommanderPublicKeyFingerprint 在無 identity 時回 null

注意：如果 jsdom 沒 IndexedDB，可以 import 'fake-indexeddb/auto' in test setup（pnpm add -D fake-indexeddb）。先試是否需要。

完成後跑 pnpm typecheck && pnpm test 全清潔。
```

---

## Task 3.2: pickImage + generateMission helpers

**Files:** `src/authoring/pickImage.ts` + `src/authoring/generateMission.ts` + tests

**Codex prompt:**

```
[通用前綴]

任務：建立 authoring 用的兩個 pure helpers。

### pickImage.ts
```ts
export interface PickedImage {
  bytes: Uint8Array;
  mimeType: string;
  altText: string;
}

/**
 * 觸發 <input type=file accept="image/*"> 並回傳選擇的圖片 bytes。
 * altText 由呼叫方提供（modal 表單欄位）。
 * 無使用者選擇則 reject。
 */
export async function pickImage(altText: string): Promise<PickedImage>;

/**
 * 同上但接受 File 物件（測試用 / 自帶 file 來源）。
 */
export async function fileToPickedImage(file: File, altText: string): Promise<PickedImage>;
```

實作 pickImage：建立 hidden <input type=file>，dispatch click，listen 'change'。改用 fileToPickedImage(file, altText) 完成。

測試：fileToPickedImage with new File([bytes], 'test.jpg', { type: 'image/jpeg' })，驗證 bytes/mimeType/altText 正確。

### generateMission.ts
```ts
import type { MissionPlaintext, MemberInput, MemberLink, MissionAssetV1 } from '../crypto';

export interface GenerateMissionInput {
  mission: MissionPlaintext;
  heroImage: PickedImage;
  members: MemberInput[];
  identity: { privateKey: CryptoKey };  // from authoring/identity.ts
  baseUrl?: string;  // override location.origin for tests
}

export interface GenerateMissionResult {
  missionId: string;
  asset: MissionAssetV1;
  links: MemberLink[];  // 含 url 已用 baseUrl + missionId
}

export async function generateMission(input: GenerateMissionInput): Promise<GenerateMissionResult>;
```

實作：呼叫 src/crypto 的 encryptMission，把 baseUrl 替換進每個 link 的 url（如果 input 有給）。

測試：用 src/crypto/sign 產 keypair，呼叫 generateMission，驗證：
- asset 結構完整
- links 數量等於 members
- baseUrl 有套用到 url
- decryptMission(asset, ...) 用 link[0].personalKey 可成功

完成 typecheck + test 清潔。
```

---

## Task 3.3: AuthoringModal UI shell

**Files:** `src/authoring/AuthoringModal.tsx` + test

**Codex prompt:**

```
[通用前綴]

任務：建立 AuthoringModal 元件。React Portal 渲染到 document.body。

API:
```ts
export interface AuthoringModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (input: GenerateMissionInput) => Promise<GenerateMissionResult>;
  identity: CommanderIdentity | null;
  onGenerateIdentity: () => Promise<CommanderIdentity>;
}

export function AuthoringModal(props: AuthoringModalProps): JSX.Element | null;
```

UI:
- 全屏 overlay (backdrop click + ESC 關閉，但若有 unsaved input 先 confirm)
- 三個階段（內部 state）：
  1. 'identity-setup': 若 identity null，顯示 'Generate Commander Identity' 按鈕；點了呼叫 onGenerateIdentity
  2. 'authoring': 顯示表單
     - 9 個 mission 欄位 textarea/input
     - hero 圖選擇（用 pickImage）+ altText 欄位
     - members list (可 add/remove)
     - 'Generate Mission' button
  3. 'post-generation': 顯示 GenerateMissionResult — links table 在 PostGenerationView (Task 3.5)
- 樣式：橘黑 sci-fi，frame brackets，與 LockedView 一致風格
- a11y: role='dialog' aria-modal='true' focus trap

測試：
- not open 時不渲染
- identity null 時顯示 setup 按鈕
- identity 存在時顯示表單
- form submit 呼叫 onGenerate（mock）
- ESC 關閉觸發 onClose
- backdrop click 關閉觸發 onClose
- focus trap 工作（tab 在 modal 內循環）

完成 typecheck + test 清潔。
```

---

## Task 3.4: PostGenerationView (links table + copy)

**Files:** `src/authoring/PostGenerationView.tsx` + test

**Codex prompt:**

```
[通用前綴]

任務：建立 PostGenerationView — 顯示 generateMission 結果。

```tsx
interface Props {
  result: GenerateMissionResult;
  onClose: () => void;
}
```

UI:
- 顯示 missionId + 'Mission generated successfully'
- 觸發瀏覽器下載 mission_<missionId>.json（使用 useEffect + Blob + URL.createObjectURL + anchor click + revoke）只在初次掛載時下載一次
- 表格：每位 member 一列
  - gameId
  - personalKey（formatted ABCD-EFGH-JKMN-PQR0）
  - URL
  - 三個按鈕：'Copy URL' / 'Copy line' / 'Copy as Discord paste'
- Discord paste 格式：`@${gameId} Mission ID: ${missionId}\nURL: ${url}\nKey: ${personalKey}`
- 用 navigator.clipboard.writeText
- 'Done' button 觸發 onClose

測試：
- renders all members
- Copy URL button 呼叫 navigator.clipboard.writeText with URL
- Copy line / Discord 格式正確
- 自動下載 JSON（mock URL.createObjectURL + check anchor.click 被呼叫一次，避免 unmount 重複下載）

完成 typecheck + test 清潔。
```

---

## Task 3.5: window.fleetOps API + main.tsx 整合

**Files:** `src/authoring/fleetOps.ts` + tests + 修改 `src/main.tsx`

**Codex prompt:**

```
[通用前綴]

任務：建立 window.fleetOps API + console banner，wire 進 main.tsx。

### src/authoring/fleetOps.ts

```ts
export interface FleetOpsApi {
  help(): void;
  launchAuthoring(): void;
  exportIdentity(): Promise<void>;          // 觸發下載 identity-backup.json
  importIdentity(jwk: object): Promise<{ publicKeyFingerprint: string }>;
  whoAmI(): Promise<{ publicKeyFingerprint: string } | null>;
}

export interface FleetOpsContext {
  /** 由 main.tsx 注入：開啟 modal 的 trigger */
  openAuthoringModal: () => void;
  /** identity 操作 (來自 src/authoring/identity.ts) */
  loadIdentity: () => Promise<CommanderIdentity | null>;
  exportIdentityJwk: () => Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey } | null>;
  importIdentityJwk: (jwk: { publicKey: JsonWebKey; privateKey: JsonWebKey }) => Promise<void>;
  getCommanderPublicKeyFingerprint: () => Promise<string | null>;
}

export function createFleetOps(ctx: FleetOpsContext): FleetOpsApi;

export function registerFleetOpsOnWindow(api: FleetOpsApi): void;

export const CONSOLE_BANNER = `
═══════════════════════════════════════════════════
  STAR CITIZEN // FLEET COMMAND ACCESS
  Type fleetOps.help() to begin
  ⚠️  Never paste console commands from untrusted
      sources. Authoring works only on your verified
      domain over HTTPS.
═══════════════════════════════════════════════════
`;
```

help() 內容：
- 列出所有命令簽名與用途
- 安全警語（不要在陌生網域、不要貼別人的 console 指令、launchAuthoring() 是 in-page form 不會把資料留在 console history）

exportIdentity(): 下載 identity-backup.json（{ publicKey: jwk, privateKey: jwk, createdAt }）。
importIdentity(jwk): zod 驗證、寫入 IndexedDB、回傳 fingerprint。

### src/main.tsx 更新

保留 cross-browser-harness 區塊。在 `createRoot.render(...)` 之前加：
- 印 CONSOLE_BANNER 到 console
- 建立 React state hub 讓 fleetOps.launchAuthoring 可以觸發 modal 開啟（可用 module-level event emitter 或 React state lifted to root）
- 註冊 window.fleetOps

具體 wire：可在 main.tsx 用 useState + 一個 module-level setter；fleetOps.launchAuthoring 呼叫 setter 設 open=true，App.tsx 讀 state 並渲染 AuthoringModal。

或更簡單：用 EventTarget 模式 — fleetOps dispatch 一個 'fleetops:open-authoring' CustomEvent，App.tsx useEffect 監聽。

### 測試
- createFleetOps 回傳的 api 各 method 簽名正確
- help() 印出包含 'launchAuthoring' 的字串（spy console.log）
- launchAuthoring 呼叫 ctx.openAuthoringModal
- importIdentity 拒絕無效 jwk

完成 typecheck + test 清潔。
```

---

## Task 3.6: getCommanderPublicKey 三層 precedence

**Files:** 修改 `src/publicKeys/commanderPublicKey.ts` + 更新 test

**Codex prompt:**

```
[通用前綴]

任務：升級 getCommanderPublicKey 讓它優先讀 identity（IndexedDB），fallback 到既有 dev/prod 邏輯。

precedence:
1. 若 IndexedDB 有 commander identity → 用其 publicKey
2. import.meta.env.DEV 時用 DEV_TEST_COMMANDER_PUBLIC_KEY_B64URL
3. 否則用 COMMANDER_PUBLIC_KEY_B64URL (placeholder)

也 export getCommanderPublicKeyFingerprint() — 直接呼叫 identity.ts 的同名函式（如果 identity 有用 identity 的，否則計算 placeholder/dev key 的 fingerprint）。

更新測試：
- 既有 test：placeholder import 仍 work（無 identity 時）
- 新 test：有 identity 時優先用 identity public key（mock loadIdentity）

完成 typecheck + test 清潔。
```

---

## Task 3.7: AuthoringModal wire-up to App + fleetOps event flow

**Files:** 修改 `src/App.tsx` + 修改 `src/main.tsx` + 補測試

**Codex prompt:**

```
[通用前綴]

任務：把 fleetOps 與 AuthoringModal 串起來。

1. main.tsx：
   - boot 時印 CONSOLE_BANNER
   - 建立 fleetOps（注入 identity 函式 + dispatch 'fleetops:open-authoring' CustomEvent）
   - registerFleetOpsOnWindow(fleetOps)

2. App.tsx：
   - 加 useState<boolean> for authoringModalOpen
   - 加 useEffect 監聽 'fleetops:open-authoring' → setAuthoringModalOpen(true)
   - 加 useState<CommanderIdentity | null> for identity；boot 時 loadIdentity 設定
   - 渲染 AuthoringModal 在末尾（與 main view 並列）
   - 提供 onGenerateIdentity 函式：generateSigningKeypair → saveIdentity → setIdentity
   - 提供 onGenerate 函式：呼叫 generateMission，把結果傳給 PostGenerationView（modal 內部 state 處理）
   - 注意：authoring 完後使用 identity.publicKey 的 fingerprint 顯示給使用者，提示要更新 build-time public key

3. App.test.tsx 補：
   - 'fleetops:open-authoring' event 觸發 modal 開啟
   - identity 為 null 時 modal 顯示 setup
   - 模擬 generate identity → modal 切換到 authoring

完成 typecheck + test 清潔。
```

---

## Task 3.8: Cross-browser e2e（Playwright）— 完整 authoring → decryption

**Files:** `tests/e2e/authoring-decryption.spec.ts` + 可能更新 `playwright.config.ts`

**Codex prompt:**

```
[通用前綴]

任務：寫端對端 Playwright 測試。

流程：
1. 開瀏覽器 → http://localhost:5173 (Vite dev server，由 playwright.config webServer 啟動)
2. 觸發 fleetOps.launchAuthoring() via page.evaluate
3. 確認 modal 開啟（identity setup 階段）
4. 點 'Generate Commander Identity'
5. 確認 modal 進入 authoring 階段
6. 填表單：mission 9 個欄位
7. 用 page.setInputFiles 模擬選圖片（用 fixture 圖片：tests/e2e/fixtures/hero.jpg）
8. 加兩個 members
9. 點 Generate
10. 等下載觸發（page.waitForEvent('download')）
11. 確認 PostGenerationView 顯示 2 個 member rows
12. 抓出第一個 member 的 personalKey 與 URL
13. 把下載的 mission JSON 內容讀出（download.path() 或 createReadStream）
14. mock /missions/<id>.json route → 回傳該 JSON
15. navigate 到 URL（含 ?mission_id=<id>）
16. 確認 LockedView 出現
17. 填入 gameId + personalKey
18. 點 START DECRYPTION
19. 等 DecryptedView 出現
20. 確認所有 mission 欄位顯示為原始輸入

設定：
- 需要 tests/e2e/fixtures/hero.jpg（小張，可從 public/fonts/ 拿任何 woff 改名為 .jpg 不行；用一個簡單 1x1 JPEG 或 codex 生 base64 寫成檔）
- 確認 playwright.config.ts 的 webServer 已設定 npm run dev

3 個 browsers (chromium/firefox/webkit) 各跑一次。

完成 pnpm typecheck 清潔；pnpm test 仍清潔（unit）。
**不需要實際跑 pnpm test:e2e** — WSL 缺 system libs。E2E 測試檔本身正確即可，後續使用者自己 sudo install playwright deps 後跑。

報告中說明 e2e 測試檔已產生，但未實際執行（環境限制）。
```

---

## Task 3.9: Deployment 設定 + README

**Files:** `wrangler.toml` (Cloudflare Pages config) + `README.md` (專案說明)

**Codex prompt:**

```
[通用前綴]

任務：補 deployment 設定 + 寫 README。

### wrangler.toml (Cloudflare Pages)

```toml
name = "vesper-mission"
compatibility_date = "2026-04-28"
pages_build_output_dir = "dist"
```

或如果使用者偏好 vercel.json，由 codex 評估或詢問（預設用 Cloudflare）。

### README.md

涵蓋：
- 專案簡介（Star Citizen 艦隊任務加密佈達）
- Tech stack（React + TS + Vite + Tailwind v4 + Web Crypto + Ed25519）
- 安全模型重點（threat model 摘要）
- 開發環境 setup（pnpm install, pnpm dev, pnpm test, pnpm build）
- 指揮官 workflow:
  1. 部署網站
  2. 開 DevTools console
  3. 看到 banner
  4. 呼叫 fleetOps.help()
  5. fleetOps.launchAuthoring() → 填表 → 下載 JSON
  6. 把 JSON 拖進 public/missions/
  7. git push → Cloudflare Pages auto-deploy
  8. 把每位 member 的連結+key 透過 Discord 私訊送
- 團員 workflow:
  1. 收到連結
  2. 點開
  3. 輸入 game_id + private_key
  4. 看到任務內容
- 部署：Cloudflare Pages 連 GitHub repo，無需 wrangler CLI
- 局限：v1 placeholder commander key，第一次使用後需把 fleetOps.whoAmI() 回傳的 fingerprint 對應的公鑰更新 src/publicKeys/commanderPublicKey.ts COMMANDER_PUBLIC_KEY_B64URL 並重新 deploy（這是 Plan 3 完整完成後的步驟）

完成 typecheck + test 仍清潔（README 不影響）。
```

---

## Task 3.10: Final sanity check

**Codex prompt:**

```
[通用前綴]

任務：最後驗收。

跑：
1. pnpm typecheck — 必須清潔
2. pnpm test — 全部 unit + RTL test 通過
3. pnpm build — 必須產出 dist 無錯誤
4. 不需 commit
5. 最後 report：typecheck output / test count / build size / git log --oneline | head 30
```

---

## Acceptance Criteria for Plan 3

- ✅ window.fleetOps 在 production 與 dev 都可用，console banner 顯示
- ✅ 指揮官可呼叫 fleetOps.launchAuthoring() 開 in-page modal
- ✅ 首次使用：可生成 Ed25519 keypair（IndexedDB 持久化）
- ✅ 填表 + pickImage + members → generateMission → 自動下載 JSON + 顯示 links table
- ✅ Identity export/import 可用（JWK 備份）
- ✅ getCommanderPublicKey 三層 precedence (identity > dev > placeholder)
- ✅ Cross-browser e2e 測試檔完備（實際 run 需 sudo install playwright deps）
- ✅ Deployment 設定 + README
- ✅ pnpm typecheck / test / build 全清潔

**Out of scope:**
- 實際 deploy 到 Cloudflare Pages（使用者操作）
- 多 commander 支援
- 任務過期 / 撤銷
- i18n
- PWA
