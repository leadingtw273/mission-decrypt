# Vesper Mission — Design Spec

> Star Citizen 艦隊任務加密佈達系統。本文件為 brainstorming 階段最終定稿，已整合 codex 第一輪 review 的所有採納意見與兩個關鍵決策。

## 0. Threat Model（保護什麼，不保護什麼）

| 類別 | 保護? | 說明 |
|---|---|---|
| Confidentiality（任務內容機密性） | ✅ | 加密 mission asset，未授權者看不到任何欄位內容（含 hero 圖片） |
| Integrity（單欄位竄改） | ✅ | AES-256-GCM auth tag |
| Cross-field swapping（欄位互換） | ✅ | AAD 綁定 `(version, missionId, fieldName, cipherParams)` |
| Asset-level tamper（增減 wrappedKeys / 改 metadata） | ✅ | Ed25519 簽章 + asset MAC |
| Authenticity（任務真偽） | ✅ | Ed25519 簽章；公鑰烘進 client，私鑰指揮官離線持有 |
| Membership privacy（隱藏誰在名單） | ❌ | 拿到 asset + 已知 gameId 可重算 lookupKey 確認；列為 acceptable risk |
| 防止指揮官 console history 殘留 | 部分 | Hybrid UX 用 in-page modal 收輸入，避免長字串進 console history |
| 防止部署主機被入侵 | ❌ | 假設 Vercel/CF Pages、git repo、commander 本機是 trusted |
| 防止瀏覽器惡意 extension | ❌ | 此類威脅需 OS 層 sandbox，非本系統 scope |
| 防止離線爆破 personalKey | ✅ | 16-char base32 ≈ 80 bits + PBKDF2 SHA-256 ≥600k iter，運算上不可行 |

## 1. Locked Premises (使用者已確認)

| 維度 | 決議 | 備註 |
|---|---|---|
| 專案 | React + TypeScript + Vite SPA | |
| 視覺基準 | #FFBA00 橘 / #0E1116 黑底；Orbitron + Inter；三相 Locked → Decrypting → Decrypted | |
| 隱藏使用者 | 1) 艦隊團員；2) 任務指揮官（leadi）；3) 路人觀眾；4) 未來的自己 | 鎖入設計 |
| 類比定位 | 完全自創，無現成參考 | |
| Identity | 個人/朋友自用 + 作品集門面 + 長期資產 | 程式碼品質要禁得起 portfolio 審視 |
| 動機 | 儀式感 + 真實內容防外洩 + 之後分享星際公民社群 | 加密必須做正確，不只是裝飾 |
| v1 Scope | 前端讀取頁 + 指揮官 authoring（`window.fleetOps` console 入口 + in-page modal） + Ed25519 簽章 | 無 CLI |
| 加密模型 | 對稱 AES-256-GCM + PBKDF2 per-member key wrap + Ed25519 asset 簽章 | |
| 「私鑰」UX | 16-char base32（含 1 char checksum）分組顯示 `ABCD-EFGH-JKLM-NPQR` | 機器生成、人類可貼可說 |
| Asset 部署 | Build-time bundle 至 `public/missions/<id>.json` | 指揮官手動拖檔 + git commit + push |
| Hero 圖片 | 與其他欄位同一加密管線（base64 嵌入） | 大小上限 2MB，超過 reject |
| 亂碼來源 | 真實密文 base64url 字元化呈現 | per-field ciphertext，呼應「儀式感」 |
| 解鎖記憶 | 不記憶，每次重輸 | |
| 語言 | 純英文 | 與 mockup 一致 |
| 失敗 UX | typed `ERROR(reason)`，UI 文案統一為 `DECRYPTION FAILED` 但內部分類 | |
| Mission ID | 純表面裝飾、隨機生成 `XXX-NNNNN-XXN` | URL slug 用 |
| Mission 欄位 | 與 mockup 九欄完全一致 + heroImage | 見 §3.1 |
| `window.fleetOps` 暴露 | Production 永遠暴露 + console banner；但 generate 流程強制走 modal，不直收 console input | |

## 2. 系統架構

```
src/
├── main.tsx              # 掛載 App + 註冊 window.fleetOps + console banner
├── App.tsx
├── crypto/               # 加解密與正規化的單一來源
│   ├── primitives.ts     #   PBKDF2 / AES-GCM / Ed25519 / HMAC 包裝
│   ├── codec.ts          #   base64url、TextEncoder、canonical JSON
│   ├── normalization.ts  #   normalizeGameId、UTF-8 NFKC
│   ├── aad.ts            #   AAD builder（綁 schema + missionId + fieldName）
│   ├── kdf.ts            #   PBKDF2 with calibrated iterations
│   ├── envelope.ts       #   master key 包裝/解包
│   ├── sign.ts           #   Ed25519 sign / verify
│   ├── personalKey.ts    #   16-char base32 + checksum 生成 / 驗證
│   └── schema.ts         #   MissionAssetV1 zod 驗證 + parse
├── authoring/            # 指揮官側
│   ├── fleetOps.ts       #   window.fleetOps 註冊 + help() + banner
│   ├── modal/            #   站內隱藏 authoring modal
│   ├── generate.ts       #   產生 mission（純函式，呼叫 crypto/）
│   └── commanderKey.ts   #   Ed25519 keypair 持久化（IndexedDB + export）
├── decryption/           # 團員側
│   ├── stateMachine.ts   #   六態 reducer
│   ├── loadAsset.ts      #   fetch + parse + verify signature
│   └── decrypt.ts        #   PBKDF2 → unwrap → field decrypt
├── components/
│   ├── LockedView.tsx
│   ├── DecryptingView.tsx
│   ├── DecryptedView.tsx
│   ├── ErrorView.tsx
│   └── shared/           # button, input, etc
├── styles/               # Tailwind v4 theme
└── publicKeys/           # build-time baked commander Ed25519 public key
    └── commanderPublicKey.ts
public/missions/          # 指揮官手動放置加密 mission JSON
```

設計原則：
- **加密邏輯只有一份**（`src/crypto/`），含 normalization / base64url / AAD builder / schema validator / signature
- 所有 authoring/decryption 都只能呼叫 `crypto/` 的 typed API，不直接拼 bytes
- **無路由器**：URL 參數靠 `URLSearchParams`
- **狀態機**：`useReducer` 實作六態
- **無後端**：純靜態託管

## 3. 密碼學設計

### 3.1 Mission Asset Schema (`MissionAssetV1`)

```jsonc
{
  "schemaVersion": "1",
  "cryptoVersion": "1",
  "lookupVersion": "1",
  "normalizationVersion": "1",
  "missionId": "ADE-342S4-SE9",
  "createdAt": "2026-04-28T10:00:00Z",
  "params": {
    "kdf": "PBKDF2-HMAC-SHA256",
    "kdfIterations": 600000,        // calibrated value, may differ across missions
    "kdfHash": "SHA-256",
    "derivedKeyLength": 32,
    "saltLength": 16,
    "cipher": "AES-256-GCM",
    "ivLength": 12,
    "gcmTagLength": 16,
    "encoding": "base64url",
    "signature": "Ed25519"
  },
  "wrappedKeys": {
    // lookupKey = base64url(HMAC-SHA256(missionId, normalizeGameId(gameId)))
    // 註：此 key 僅作 namespace + 索引；不提供 membership privacy（見 §0 threat model）
    "<lookupKey>": {
      "salt": "<base64url 16 bytes random>",   // pure random, gameId 不混入
      "iv": "<base64url 12 bytes random>",
      "wrapped": "<base64url ciphertext + 16-byte tag>"
      // AAD = canonicalJSON({ schemaVersion, cryptoVersion, missionId, lookupKey, kdfParams })
    }
  },
  "fields": {
    "missionCommander":      { "iv": "...", "ciphertext": "..." },
    "communicationChannel":  { "iv": "...", "ciphertext": "..." },
    "missionTime":           { "iv": "...", "ciphertext": "..." },
    "rallyTime":             { "iv": "...", "ciphertext": "..." },
    "rallyLocation":         { "iv": "...", "ciphertext": "..." },
    "requiredGear":          { "iv": "...", "ciphertext": "..." },
    "accessPermission":      { "iv": "...", "ciphertext": "..." },
    "rewardDistribution":    { "iv": "...", "ciphertext": "..." },
    "missionBrief":          { "iv": "...", "ciphertext": "..." }
    // 每個 field AAD = canonicalJSON({ schemaVersion, cryptoVersion, missionId, fieldName, kdfParams })
  },
  "heroImage": {
    "iv": "...", "ciphertext": "...",
    "metadata": {
      "mimeType": "image/jpeg",
      "byteLength": 387412,
      "altText": "Mission rally point: Orison platform with capital ship in background"
      // metadata 全部納入 AAD: { ...fieldAAD, mimeType, byteLength, altText }
    }
  },
  "signature": {
    "alg": "Ed25519",
    "publicKeyFingerprint": "<base64url SHA-256(pubkey)[..16]>",
    "value": "<base64url Ed25519 signature over canonicalJSON(asset_without_signature)>"
  }
}
```

### 3.2 Canonical JSON 規格

為了 signature 與 AAD 的穩定性，所有納入加密 / 簽章的物件序列化必須遵守：

- 無 whitespace（`JSON.stringify(value)` 不帶 indent）
- Object key 按 codepoint 排序
- 字串：UTF-8、不轉 `\u` 序列、無 trailing newline
- 數字：JS Number → 直接 `.toString()`，不接受 NaN/Infinity
- base64url 編碼，去除 `=` padding，使用 `-` `_` 替代 `+` `/`

實作集中於 `src/crypto/codec.ts`。

### 3.3 Normalization (`normalizeGameId`)

```ts
function normalizeGameId(raw: string): string {
  // 1. trim
  // 2. NFKC（Unicode 正規化）
  // 3. 限制字元集 [A-Za-z0-9_-]，其他字元 reject
  // 4. lowercase
  // 5. length: 1–32 chars，超出 reject
}
```

- Authoring 與 decryption 必呼叫同一份 `normalizeGameId`，共用測試 vectors
- 任何違反（reject）情況回傳 `Result.err('invalid_game_id')`，不靜默 truncate

### 3.4 PersonalKey

- **格式**：base32（Crockford 字元集 [0-9A-HJKMNP-TV-Z]，去 I O U L），15 chars + 1 char Crockford checksum = 16 chars
- **顯示**：`ABCD-EFGH-JKLM-NPQR`（4 字一組，4 組）
- **熵**：15 chars × 5 bit = 75 bits（checksum 不計），仍遠超實際攻擊門檻
- **校驗**：團員輸入時可即時偵測 typo

### 3.5 AAD Builder

所有 AES-GCM 操作必帶 AAD。AAD 為 canonical JSON 序列化字串轉 UTF-8 bytes：

```ts
// 包裝 master key 時：
aadForWrap = canonicalJSON({
  schemaVersion, cryptoVersion, missionId, lookupKey, params
})

// 加密 field 時：
aadForField = canonicalJSON({
  schemaVersion, cryptoVersion, missionId, fieldName, params
})

// 加密 heroImage 時：
aadForHero = canonicalJSON({
  schemaVersion, cryptoVersion, missionId, fieldName: "heroImage",
  mimeType, byteLength, params
})
```

### 3.6 Authoring 流程（`generate()`）

```
input:
  mission: { missionCommander, ..., heroImage: { bytes, mimeType } }
  members: [{ gameId }]
  commanderKeypair: Ed25519 keypair (from IndexedDB or imported)

steps:
   1. validate inputs (zod schema)
   2. for each member: gameIdNormalized = normalizeGameId(gameId)
      reject if any duplicates after normalization
   3. missionId = randomMissionId()  // pattern: [A-Z]{3}-[A-Z0-9]{5}-[A-Z]{2}[0-9]
   4. iterations = 600000  // v1 fixed; per-mission calibration (v2+) via params.kdfIterations
   5. M = randomBytes(32)
   6. for each field f in mission:
        iv_f = randomBytes(12)
        aad_f = aadForField(...)
        ct_f = AES-256-GCM(M, iv_f, plaintext_f, aad_f)
        store { iv: iv_f, ciphertext: ct_f }
        // IV uniqueness guardrail: keep Set of seen IVs, abort if collision
   7. for each member m:
        personalKey_m = generatePersonalKey()  // 16-char base32 + checksum
        salt_m = randomBytes(16)
        wrapKey_m = PBKDF2(personalKey_m, salt_m, iterations, derivedKeyLength=32)
        iv_m = randomBytes(12)
        lookupKey_m = HMAC-SHA256(missionId, gameIdNormalized_m)
        aad_m = aadForWrap(missionId, lookupKey_m, params)
        wrapped_m = AES-256-GCM(wrapKey_m, iv_m, M, aad_m)
        wrappedKeys[lookupKey_m] = { salt: salt_m, iv: iv_m, wrapped }
   8. assetWithoutSignature = { schemaVersion, cryptoVersion, ..., wrappedKeys, fields, heroImage }
   9. signature = Ed25519.sign(commanderPrivateKey, canonicalJSON(assetWithoutSignature))
  10. asset = { ...assetWithoutSignature, signature }
  11. trigger blob download mission_<missionId>.json
  12. switch authoring modal to "post-generation" view showing links table:
        for each member: { gameId, personalKey: ABCD-EFGH-JKLM-NPQR, url }
        with "Copy as JSON" / "Copy single line" / "Copy as Discord paste" buttons
        (避免使用者要回 console history 撈資料)
  13. user closes modal manually after distributing links; modal state cleared on close
```

### 3.7 Decryption 流程

```
input:
  missionId from URL
  commanderPublicKey from build (publicKeys/commanderPublicKey.ts)
  gameId, personalKey (user input)

steps (state machine drives):
  BOOTSTRAPPING:
    - check window.crypto.subtle exists → if not, ERROR(unsupported_env)
    - check Ed25519 supported → if not, ERROR(unsupported_env)
  ASSET_LOADING:
    - read missionId from URL → if missing, ERROR(missing_mission_id)
    - fetch /missions/<id>.json → if 404/500, ERROR(not_found)
    - JSON.parse → if fail, ERROR(invalid_asset)
    - zod parse to MissionAssetV1 → if fail, ERROR(invalid_asset)
    - check schemaVersion / cryptoVersion in supported list → if not, ERROR(unsupported_version)
    - verify Ed25519 signature → if fail, ERROR(forged_asset)
    - render LOCKED with per-field ciphertext as gibberish
  LOCKED → DECRYPTING:
    - normalize gameId
    - lookupKey = HMAC-SHA256(missionId, gameIdNormalized)
    - if !wrappedKeys[lookupKey] → ERROR(auth_failed)
    - validate personalKey checksum → if fail, ERROR(invalid_personal_key_format)
    - PBKDF2 to derive wrapKey
    - AES-GCM unwrap M (with AAD) → if auth tag fail, ERROR(auth_failed)
    - for each field: AES-GCM decrypt with M (with AAD)
    - decode hero image
    - DECRYPTED
  ERROR(reason):
    - UI 統一顯示 "DECRYPTION FAILED"
    - console 區分原因方便除錯
    - "Retry" 按鈕回 LOCKED
```

### 3.8 Commander Ed25519 Keypair 管理

- **首次使用**：`fleetOps.launchAuthoring()` 偵測無 keypair → 引導點 `Generate Commander Identity`
  - `crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])`
  - 持久化到 IndexedDB（key 不可 export 到 console，但可透過 `fleetOps.exportIdentity()` 下載 JWK 備份）
- **匯入**：`fleetOps.importIdentity(jwkJson)` 從本地 JSON 還原
- **公鑰嵌入流程**：
  - 首次生成後，UI 顯示「請更新 `src/publicKeys/commanderPublicKey.ts` 並重新部署」
  - 顯示複製按鈕直接貼進 source
  - 之後每次 generate 都會驗證 IndexedDB 私鑰對應的公鑰 fingerprint == build 內公鑰 fingerprint，不匹配則拒絕

## 4. 前端狀態機（六態）

```
                     ┌──────────────────────┐
                     │   BOOTSTRAPPING      │
                     └──────────┬───────────┘
                                │ env check pass
                                ▼
                     ┌──────────────────────┐
                     │   ASSET_LOADING      │
                     └──────────┬───────────┘
                                │ fetch + parse + sigverify pass
                                ▼
                     ┌──────────────────────┐
                ┌───▶│      LOCKED          │
                │    └──────────┬───────────┘
                │               │ submit (game_id + personal_key)
                │               ▼
                │    ┌──────────────────────┐
                │    │   DECRYPTING         │
                │    └──────┬───────────┬───┘
                │           │           │
                │      success      auth fail
                │           ▼           │
                │    ┌──────────┐      ▼
                │    │DECRYPTED │  ┌────────────────────┐
                │    └──────────┘  │  ERROR(typed)      │
                │                  │  reasons:          │
                │                  │  - missing_id      │
                │                  │  - not_found       │
                │                  │  - invalid_asset   │
                │                  │  - unsupported_*   │
                │                  │  - forged_asset    │
                │                  │  - auth_failed     │
                └── retry* ────────┤  (* recoverable    │
                                   │   reasons only)    │
                                   └────────────────────┘
        retry* available only for: auth_failed,
        invalid_personal_key_format, not_found, cipher_corrupt
```

UI 文案：

| reason | UI 顯示 | Retry 可用 | 理由 |
|---|---|---|---|
| `missing_mission_id` | "NO MISSION SPECIFIED" | ❌ | 終態，需要新 URL |
| `not_found` | "MISSION NOT FOUND" | ✅（手動 reload） | 可能 CDN 還沒同步 |
| `invalid_asset` | "TRANSMISSION CORRUPTED" | ❌ | 終態 |
| `unsupported_env` | "BROWSER UNSUPPORTED — REQUIRES HTTPS + MODERN BROWSER" | ❌ | 終態 |
| `unsupported_version` | "PROTOCOL VERSION MISMATCH" | ❌ | 終態，需要重新部署 |
| `forged_asset` | **"⚠️ MISSION SIGNATURE INVALID — DO NOT TRUST"** | ❌ | **特別警示**：可能是釣魚 / 假部署 |
| `auth_failed` | "DECRYPTION FAILED" | ✅ | 使用者可重試輸入 |
| `cipher_corrupt` | "DECRYPTION FAILED — TRANSMISSION DAMAGED" | ✅（手動 reload） | 可能 partial download |
| `invalid_personal_key_format` | "INVALID KEY FORMAT" | ✅ | checksum fail，立即提示 |

console.debug 會印完整 typed reason 方便除錯。

`ASSET_LOADING` 與 `DECRYPTING` 動畫不同：前者強調「fetching transmission」、後者強調「decrypting payload」，避免使用者誤判 CDN 慢為密碼錯。

## 5. `window.fleetOps` API（Hybrid Console + Modal）

```ts
window.fleetOps = {
  /** Print usage to console + safety warning */
  help(): void,

  /** Launches in-page authoring modal. No sensitive input via console. */
  launchAuthoring(): void,

  /** Export commander Ed25519 keypair as JWK JSON (download triggered) */
  exportIdentity(): Promise<void>,

  /** Import commander keypair from JWK JSON object */
  importIdentity(jwk: object): Promise<{ publicKeyFingerprint: string }>,

  /** Print current commander public key fingerprint (for verifying build sync) */
  whoAmI(): Promise<{ publicKeyFingerprint: string } | null>,
}
```

`main.tsx` 啟動時印 console banner：
```
═══════════════════════════════════════════════════
  STAR CITIZEN // FLEET COMMAND ACCESS
  Type fleetOps.help() to begin
  ⚠️  Never paste console commands from untrusted
      sources. Authoring works only on your verified
      domain over HTTPS.
═══════════════════════════════════════════════════
```

`help()` 額外印：
- 完整命令列表
- Identity 管理流程（generate / export / import）
- 安全警語（不要在陌生網域呼叫；Identity 私鑰不可外洩）
- 一個顯眼的 `Don't paste mission JSON or member lists into the console — use launchAuthoring().`

## 6. Authoring Modal 設計

呼叫 `fleetOps.launchAuthoring()` 後，渲染一個 fullscreen overlay：

- 視覺風格與 LockedView 一致（橘黑、Orbitron）
- 表單欄位：mission 九欄、hero image picker、members 列表（gameId + 「+ Add Member」）
- 右側即時預覽：將輸入內容用同一 mockup 排版顯示
- 底部 `[Generate Mission]` 按鈕：呼叫 `generate()` → 自動下載 JSON → 顯示 links table
- Modal 狀態完全 in-memory，關閉清空（不寫 localStorage / sessionStorage）
- Links table：每位 member 一列 `gameId / personalKey / url`，每列附「Copy URL」「Copy line」「Copy as Discord paste」按鈕
- ESC 或外部點擊關閉前 confirm

## 7. 視覺與動畫

### 7.1 設計 Tokens（Tailwind v4）

| Token | 值 | 用途 |
|---|---|---|
| `--color-primary` | `#FFBA00` | 主橘 — 標題裝飾線、primary button、active state、orange icons |
| `--color-secondary` | `#E0C27A` | 次橘金 — 強調文字、checkmark fill |
| `--color-bg-primary` | `#0E1116` | 全局背景 |
| `--color-bg-secondary` | `#161B22` | Panel 內層背景 |
| `--color-border` | `#2A313C` | 邊框 / divider |
| `--color-text` | `#A3ADB8` | 主要正文 |
| `--color-danger` | `#E5484D` | 失敗紅 — `forged_asset` / `auth_failed` UI 警示（本色不在原 style guide 標籤中，視為功能性必要新增） |
| `--font-display` | `Orbitron` | 標題、狀態文字、UI 標註、Mission ID |
| `--font-body` | `Inter` | 正文、欄位 value |
| `--tracking-display` | `0.18em` | Orbitron 標題字距（廣播 HUD 感） |
| `--tracking-label` | `0.12em` | Orbitron 小標、UI label |

### 7.2 標誌性視覺元素

- **L 形取景框 (Frame Brackets)**：Panel 四角、Lock icon 包圍框、Hero 圖區四角都帶 L 型細線（1.5px、長 16-24px）。Tailwind 透過自訂 `frame-bracket` utility 或單獨 React 元件實作（內含 4 個絕對定位 SVG `<path>`）
- **裝飾分隔線**：虛線中央帶點 (`──•──`)，而非實線
- **Stencil-cut Icons**：所有 line icon 線條粗細 1.5–2px，轉角銳利且部分轉角故意留 1-2px 斷點（鋼印質感）
- **Input 左側 2px 垂直 accent bar**：active 時變橘、disabled 時保持深灰
- **亂碼字符集**：限制在 `% $ @ ! # ^ & * ( ) _ + [ ] { } ; ' \" < > ? / ~` 範圍內（避免字母混入導致誤讀為英文），保留視覺一致性

### 7.3 字體載入

self-host Orbitron + Inter，避免 Google Fonts 連線拖慢且離線可用。Variable woff2 各取一份。

### 7.4 動畫（Framer Motion）

| 階段 | 動畫 |
|---|---|
| `BOOTSTRAPPING` → `ASSET_LOADING` | 橘色 scanner sweep（橫向發光線從頂部往下 800ms loop） |
| `ASSET_LOADING` 期間 | scanner sweep 持續循環；Panel 內顯示 `LOADING TRANSMISSION...` |
| `ASSET_LOADING` → `LOCKED` | 密文 gibberish per field 逐字浮現（每字符 ~10ms） |
| `LOCKED` → `DECRYPTING` | Lock icon 旋轉 360°、密文 scramble 加速、scanner sweep 切換為 cyan 變體（仍用 primary 橘但加 box-shadow glow） |
| `DECRYPTING` 期間 | per-field 文字快速 character randomizer（500ms 內滾動切換為 plaintext） |
| `DECRYPTING` → `DECRYPTED` | typewriter 收尾，每欄位逐字定格；Lock icon 變為 checkmark + L 形框 pulse 一次 |
| `DECRYPTED` | 靜止狀態，無持續動畫 |
| `ERROR` | 紅色 (`--color-danger`) horizontal shake 300ms + 字體輕微 RGB split chromatic aberration（enhancement，可後期加） |

進度指示用 **Segmented Progress Bar**（10 個小矩形組成，逐個填滿，呼應 mockup 細節），而非平滑漸變。

### 7.5 a11y

- 所有動畫尊重 `prefers-reduced-motion: reduce`（CSS 媒體查詢直接降為 instant；scanner sweep / scramble / shake 全停）
- 失敗訊息為 ARIA live region (`role="alert" aria-live="assertive"`)
- 鍵盤可完整操作（modal focus trap、tab order 合理、Escape 關閉 modal）
- 主要操作元素 (`Submit`、`Generate`、`Retry`) `aria-label` 完整
- hero image：`heroImage.metadata.altText` 解密後填入 `<img alt={altText}>`，未填預設 "Mission rally point"
- 對比度檢查：所有橘色文字在黑底達 WCAG AA（`#FFBA00` on `#0E1116` 對比度 ≈ 11.4:1，遠超 AA 4.5:1）
- 紅色錯誤文字 `#E5484D` on `#0E1116` 對比度 ≈ 5.3:1，達 AA

## 8. 測試策略

| 層級 | 工具 | 涵蓋 |
|---|---|---|
| Unit | Vitest | crypto round-trip（encrypt → decrypt 對得上 byte） |
| Unit | Vitest | 失敗路徑（錯 personalKey、錯 gameId、tampered ciphertext、wrong AAD、forged signature） |
| Unit | Vitest | normalization vectors（大小寫、NFKC、空白、Unicode lookalike、空字串、超長、非法字元） |
| Unit | Vitest | personalKey checksum（合法、改一字元應 fail） |
| Unit | Vitest | canonical JSON 穩定性（key ordering、whitespace、UTF-8） |
| Property | fast-check | asset parser fuzzing（亂序 keys、unknown fields、損壞 base64、邊界長度） |
| Cross-browser | Playwright | golden vectors 在 Chromium/Firefox/WebKit 必須 byte-identical |
| AAD binding | Vitest | 改動 fieldName / missionId / params / lookupKey 後解密必 fail |
| State machine | Vitest | 六態 reducer 完整覆蓋 + 所有 ERROR reason 路徑 |
| E2E | Playwright | 完整解密流程（含 hero image 顯示） |
| E2E | Playwright | authoring modal 流程（產 mission → 下載 → 重新解密自驗） |
| a11y | axe-core via Playwright | 無 violations |
| Visual regression | Playwright screenshots | 三相主視覺穩定性 |

不在 v1：Storybook（可後期加）、benchmark suite（PBKDF2 校準在 dev 工具列）。

## 9. 部署

- **平台**：Cloudflare Pages（推薦，免費額度大、edge fast）或 Vercel
- **新任務流程**：
  1. 部署網站開 DevTools，呼叫 `fleetOps.launchAuthoring()`
  2. 填表 → 產 mission asset JSON 自動下載
  3. 拖進 `public/missions/`
  4. `git add . && git commit -m "ops: <missionId>" && git push`
  5. 平台自動 build & deploy
  6. 連結與 personalKey 透過 Discord 私訊送出（每個團員一份）
- **Cache busting**：
  - schema 升版 (`schemaVersion` / `cryptoVersion`) 時，舊 client 看到不認識的 version → fail-closed `ERROR(unsupported_version)`
  - 部署時 service worker 更新（若加 PWA）；無 SW 時靠瀏覽器原生 cache + Cloudflare cache TTL
  - Mission asset 加 `?v=<schemaVersion>` query string fetch，避免 stale cache
- **Identity 部署**：
  - 首次：`fleetOps.launchAuthoring()` → 系統提示生成 → 複製公鑰 → 貼到 `src/publicKeys/commanderPublicKey.ts` → commit + push
  - 換機：`fleetOps.exportIdentity()` 下載 JWK，新機 `fleetOps.importIdentity(...)`
  - 換 keypair：同 schema 升版，公鑰更新會讓舊 mission 簽章驗章失敗（acceptable，等同 deprecate 舊任務）

## 10. 已採納 codex Review 對照表

| 項次 | codex 建議 | 處理 |
|---|---|---|
| §3 AAD 綁定 | ✅ 採納（§3.5） |
| §3 salt 不混 gameId | ✅ 採納（§3.6 step 7） |
| §3 normalizeGameId | ✅ 採納（§3.3） |
| §3 IV uniqueness guardrail | ✅ 採納（§3.6 step 6） |
| §3 PBKDF2 iterations 寫入 asset | ✅ 採納（§3.1 params.kdfIterations） |
| §3 personalKey 16-char + checksum | ✅ 採納（§3.4） |
| §3 base64url | ✅ 採納（§3.2） |
| §3 heroImage metadata | ✅ 採納（§3.1） |
| §3 schemaVersion / cryptoVersion 拆分 | ✅ 採納（§3.1） |
| §3 Argon2id | ❌ 拒絕（依賴 WASM；personalKey 已高熵） |
| §3 整包 AEAD | ❌ 拒絕（破壞 per-field gibberish UX） |
| §4 六態 state machine | ✅ 採納（§4） |
| §4 unsupported_env / not_found / forged_asset typed reasons | ✅ 採納（§3.7、§4） |
| §5 Ed25519 簽章 | ✅ 採納（§3.1、§3.6 step 9、§3.7、§3.8） |
| §5 Hybrid console + modal | ✅ 採納（§5、§6） |
| §5 console history 警語 | ✅ 採納（§5 banner + help()） |
| §5 robots.txt | ❌ 拒絕（無效） |
| §6 Test 補強 | ✅ 全採納（§8） |
| §7 a11y prefers-reduced-motion / ARIA / focus | ✅ 採納（§7） |
| §10 Threat model 寫入 spec | ✅ 採納（§0） |
| §10 Canonical JSON 規格 | ✅ 採納（§3.2） |
| §10 Strict schema validation | ✅ 採納（§2 `crypto/schema.ts` zod） |
| §10 Cache busting | ✅ 採納（§9） |

## 11. v2+ 預留位（明確不在 v1）

- 多任務 dashboard / commander 任務管理頁
- 多 commander 支援（多公鑰）
- 任務過期 / 撤銷機制
- 任務歷史紀錄與審計
- i18n（中文版）
- self-hostable 模板（讓他人部署自己的 fleet ops 站）
- PWA / offline support
- Storybook 元件展示頁
