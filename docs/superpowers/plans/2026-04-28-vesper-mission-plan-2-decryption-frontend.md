# Plan 2 — Decryption Frontend

> **Execution mode**: 全部 task 由 `codex exec --skip-git-repo-check --sandbox workspace-write` 執行；Claude Code 主導 prompt 撰寫與驗證（讀 diff / 跑 typecheck+test）。

**Goal:** 建立可部署的解密前端：使用者透過 `?mission_id=<id>` 進入，看到 Locked 美術 → 輸入 game_id + personal_key → 顯示 Decrypting 動畫 → 解密成功顯示 mission 內容（含 hero 圖），失敗顯示分級錯誤。涵蓋六態狀態機、UI components、Framer Motion 動畫、a11y。

**Architecture:** 利用 Plan 1 的 `src/crypto/` library。新增 `src/decryption/`（狀態機 + 資產載入）、`src/components/`（UI）、`src/publicKeys/`（commander 公鑰 placeholder，Plan 3 補實作）。狀態機使用 `useReducer`，動畫使用 Framer Motion，元件測試使用 React Testing Library。

**Tech Stack:** Plan 1 stack + framer-motion, @testing-library/react, @testing-library/user-event, jsdom (替代 happy-dom 以更接近瀏覽器環境用於 RTL).

**Reference spec:** `docs/superpowers/specs/2026-04-28-vesper-mission-design.md` §3.7、§4、§5（部分）、§6、§7

**Reference plan:** Plan 1 已完成 `src/crypto/` 完整 library；可直接 import `decryptMission`, `MissionAssetV1`, `DecryptErrorReason` 等。

---

## File Structure

新增（all by codex）：

```
src/
├── publicKeys/
│   └── commanderPublicKey.ts             # placeholder (Plan 3 fills); export getCommanderPublicKey()
├── decryption/
│   ├── state.ts                          # State + Action types + reducer
│   ├── state.test.ts
│   ├── loadAsset.ts                      # fetch + zod parse + Ed25519 verify
│   ├── loadAsset.test.ts
│   └── useDecryptionMachine.ts           # React hook integrating reducer + side effects
├── components/
│   ├── shared/
│   │   ├── FrameBracket.tsx              # L-shape corner frame brackets
│   │   ├── Button.tsx                    # primary/secondary
│   │   ├── Input.tsx                     # 2px left accent bar
│   │   ├── ScannerSweep.tsx              # animated overlay
│   │   ├── ProgressBar.tsx               # segmented bar
│   │   └── shared.test.tsx
│   ├── LockedView.tsx                    # 第一相：lock icon + form + per-field gibberish
│   ├── DecryptingView.tsx                # 第二相：scrambling animation
│   ├── DecryptedView.tsx                 # 第三相：mission card + hero image
│   ├── ErrorView.tsx                     # ERROR(reason) → 文案 + retry
│   └── views.test.tsx
├── App.tsx                               # 取代 placeholder：URL 解析 + 狀態機路由 + view 切換
├── App.test.tsx
└── styles/
    └── animations.css                    # @keyframes for non-Framer (e.g. scanner sweep)

tests/decryption/
└── e2e-mock-asset.spec.ts                # Playwright e2e: 用內建 fixture asset 解密
public/missions/
└── _example.json                         # hand-crafted test mission asset (committed)
```

新增 deps:
- `framer-motion` ^11
- `@testing-library/react` ^16
- `@testing-library/user-event` ^14
- `@testing-library/jest-dom` ^6
- `jsdom` ^25 (或繼續用 happy-dom — codex 評估)

---

## 共用 codex 呼叫範本

每個 task 用以下命令執行（背景跑）：

```bash
codex exec --skip-git-repo-check --sandbox workspace-write \
  --cd /home/markchou/project/vesper-mission \
  "<task-specific prompt>"
```

通用 prompt 前綴（每個 task 都附加）：

```
你是在 /home/markchou/project/vesper-mission 工作的資深 React + TypeScript 工程師。
專案是 Vesper Mission（Star Citizen 艦隊任務加密佈達 SPA）。

## 嚴格規範
- 嚴格 TDD：先寫失敗測試 → 跑驗證失敗 → 寫最少實作 → 跑驗證通過 → commit
- TS strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess 全開
- 用 pnpm（不是 npm/yarn）
- Git commit 用：`git -c user.email=lialialialia1211@gmail.com -c user.name=leadingtw commit -m "..."`
- 完成後跑 `pnpm typecheck && pnpm test`，**兩者都必須清潔通過**才能視為完成
- 報告格式（最後輸出）：
  Status: DONE | DONE_WITH_CONCERNS | BLOCKED
  Files changed: <list>
  Commit SHA: <sha>
  pnpm typecheck output: <last 5 lines>
  pnpm test output: <last 6 lines>
  Concerns: <if any>

## 既有資源（可直接 import）
- src/crypto/index.ts: encryptMission, decryptMission, MissionAssetV1, MissionPlaintext, MemberLink, DecryptErrorReason, generatePersonalKey, validatePersonalKey, normalizeGameId
- src/crypto/sign.ts: importPublicKey, exportPublicKey, fingerprint
- src/crypto/codec.ts: toBase64Url, fromBase64Url
- src/styles/index.css: theme tokens (--color-primary 等)、.font-display、.font-label、.font-body utility classes
- public/fonts/: Orbitron + Inter woff2

## 設計參考
- docs/superpowers/specs/2026-04-28-vesper-mission-design.md（§4 狀態機、§7 視覺）
- 視覺風格：橘 #FFBA00 / 黑 #0E1116 / Orbitron 字體 / L 形 frame brackets / 軍工風

## 不要做的
- 不要動 src/crypto/ 的內容
- 不要動 docs/
- 不要修改 package.json 以外的既有檔案，除非任務明確指定
- 不要補上「未來會用到」的程式碼（YAGNI）
```

---

## Phase 0 — Setup

### Task 2.1: 安裝新 deps + 公鑰 placeholder

**Files:**
- Modify: `package.json` (add framer-motion, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, jsdom)
- Update: `vitest.config.ts` (switch environment to `jsdom`，加 setupFiles for @testing-library/jest-dom)
- Create: `src/publicKeys/commanderPublicKey.ts`
- Create: `src/test/setup.ts` (jest-dom matchers)

**Codex prompt:**

```
[通用前綴]

任務：安裝 Plan 2 需要的 deps 並建立 commander 公鑰 placeholder。

1. 修改 package.json 的 devDependencies / dependencies：
   - dependencies: 加 "framer-motion": "^11.0.0"
   - devDependencies 加：
     - "@testing-library/react": "^16.0.0"
     - "@testing-library/user-event": "^14.5.0"
     - "@testing-library/jest-dom": "^6.5.0"
     - "jsdom": "^25.0.0"

2. 跑 `pnpm install` 確認成功安裝。

3. 修改 vitest.config.ts：把 environment 從 'happy-dom' 改成 'jsdom'，並加 setupFiles: ['./src/test/setup.ts']。
   保留 mergeConfig 模式不變。

4. 建立 src/test/setup.ts：
   ```ts
   import '@testing-library/jest-dom/vitest';
   ```

5. 建立 src/publicKeys/commanderPublicKey.ts：
   ```ts
   import { importPublicKey } from '../crypto/sign';
   import { fromBase64Url } from '../crypto/codec';

   /**
    * Commander Ed25519 公鑰 (raw bytes，base64url-encoded)。
    * Plan 3 會在指揮官首次 generate keypair 後填入這個值。
    * v1 placeholder：32 bytes 全零。Production 必須替換。
    */
   const COMMANDER_PUBLIC_KEY_B64URL = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

   let cached: CryptoKey | null = null;

   export async function getCommanderPublicKey(): Promise<CryptoKey> {
     if (cached) return cached;
     const raw = fromBase64Url(COMMANDER_PUBLIC_KEY_B64URL);
     if (raw.length !== 32) {
       throw new Error('commander public key must be 32 bytes');
     }
     cached = await importPublicKey(raw);
     return cached;
   }

   export const COMMANDER_PUBLIC_KEY_PLACEHOLDER = COMMANDER_PUBLIC_KEY_B64URL;
   ```

6. 跑 `pnpm typecheck` 確認 0 錯誤。
7. 跑 `pnpm test` 確認既有 73 tests 仍通過。
8. Commit：`chore(plan-2): install RTL/framer-motion + commander public key placeholder`
```

### Task 2.2: 簡單健全測試 (jsdom 切換沒打壞既有)

**Codex prompt:**

```
[通用前綴]

任務：驗證從 happy-dom 切換到 jsdom 後既有 73 tests 仍通過。

1. 跑 `pnpm test`，記錄輸出。
2. 若有任何測試失敗，**不要修改**測試或實作，回報 BLOCKED 並貼上失敗訊息。
3. 若 73 tests 全通過，跑 `pnpm typecheck` 確認無新錯誤。
4. 不需 commit（純驗證）。
5. 在 final report 中只回 Status / pnpm test output / pnpm typecheck output。
```

---

## Phase 1 — State Machine + Asset Loading

### Task 2.3: 六態狀態機 + tests

**Files:**
- Create: `src/decryption/state.ts`
- Create: `src/decryption/state.test.ts`

**State 設計**:

```ts
export type State =
  | { kind: 'BOOTSTRAPPING' }
  | { kind: 'ASSET_LOADING'; missionId: string }
  | { kind: 'LOCKED'; missionId: string; asset: MissionAssetV1 }
  | { kind: 'DECRYPTING'; missionId: string; asset: MissionAssetV1; gameId: string; personalKey: string }
  | { kind: 'DECRYPTED'; mission: MissionPlaintext; heroImage: { mimeType: string; bytes: Uint8Array; altText: string } }
  | { kind: 'ERROR'; reason: DecryptErrorReason; retryable: boolean };

export type Action =
  | { type: 'ENV_OK'; missionId: string }
  | { type: 'ENV_FAIL' }
  | { type: 'ASSET_LOADED'; asset: MissionAssetV1 }
  | { type: 'ASSET_FAILED'; reason: 'not_found' | 'invalid_asset' | 'forged_asset' | 'unsupported_version' }
  | { type: 'SUBMIT'; gameId: string; personalKey: string }
  | { type: 'DECRYPT_OK'; mission: MissionPlaintext; heroImage: ... }
  | { type: 'DECRYPT_FAIL'; reason: 'auth_failed' | 'cipher_corrupt' | 'invalid_personal_key_format' }
  | { type: 'RETRY' };
```

**Codex prompt:**

```
[通用前綴]

任務：建立六態狀態機（spec §4）。先寫測試，再寫 reducer。

1. 建立 src/decryption/state.test.ts，包含至少 12 個測試覆蓋：
   - BOOTSTRAPPING + ENV_OK → ASSET_LOADING
   - BOOTSTRAPPING + ENV_FAIL → ERROR(unsupported_env, retryable=false)
   - ASSET_LOADING + ASSET_LOADED → LOCKED
   - ASSET_LOADING + ASSET_FAILED('not_found') → ERROR(not_found, retryable=true)
   - ASSET_LOADING + ASSET_FAILED('invalid_asset') → ERROR(invalid_asset, retryable=false)
   - ASSET_LOADING + ASSET_FAILED('forged_asset') → ERROR(forged_asset, retryable=false)
   - ASSET_LOADING + ASSET_FAILED('unsupported_version') → ERROR(unsupported_version, retryable=false)
   - LOCKED + SUBMIT → DECRYPTING（保留 asset, missionId, gameId, personalKey）
   - DECRYPTING + DECRYPT_OK → DECRYPTED
   - DECRYPTING + DECRYPT_FAIL('auth_failed') → ERROR(auth_failed, retryable=true) **保留 asset 在外部 stash 中**（見下）
   - ERROR(retryable=true) + RETRY → 回到合適前態：auth_failed → LOCKED（需要外部提供 asset），其他可以回 BOOTSTRAPPING
   - 不合法 transition (e.g. DECRYPTED + SUBMIT) 應 throw 或回傳當前 state 不變

   **設計細節**：
   - reducer 為純函式 `reducer(state, action) => state`
   - 因為 ERROR state 結構簡單，retry 後要回 LOCKED 需要外部存 asset。建議方案：
     - ERROR 多帶一個 optional `lastAsset?: MissionAssetV1` 欄位（auth_failed 時保留）
     - RETRY 時若 lastAsset 存在 → 回 LOCKED；否則 → 回 BOOTSTRAPPING
   - DecryptErrorReason 來自 src/crypto/index.ts 的 export。

2. 在 state.test.ts 中先寫所有測試，跑 vitest 確認失敗（module not found）。

3. 建立 src/decryption/state.ts：
   - 定義 State / Action discriminated unions（見上方範本）
   - export `initialState: State = { kind: 'BOOTSTRAPPING' }`
   - export `reducer(state: State, action: Action): State`
   - 不合法 transition 用 `console.warn` 並回傳當前 state（不 throw，避免 crash UI）

4. 跑 `pnpm test src/decryption/state.test.ts` 確認 12 個全 pass。
5. 跑 `pnpm typecheck` 全清潔。
6. Commit：`feat(decryption): six-state reducer with typed errors`
```

### Task 2.4: 資產載入函式 + tests

**Files:**
- Create: `src/decryption/loadAsset.ts`
- Create: `src/decryption/loadAsset.test.ts`

**Codex prompt:**

```
[通用前綴]

任務：建立資產載入函式 — fetch /missions/<id>.json，zod parse，Ed25519 簽章驗證。

1. 先寫 src/decryption/loadAsset.test.ts (使用 vi.spyOn(globalThis, 'fetch') mock):
   - it('returns ASSET_LOADED for a valid signed asset')
   - it('returns not_found on 404')
   - it('returns not_found on network error')
   - it('returns invalid_asset on malformed JSON')
   - it('returns invalid_asset on schema mismatch')
   - it('returns forged_asset on signature verify fail')
   - it('returns unsupported_version on schemaVersion 99')
   
   產生測試用 valid asset：使用 src/crypto/encryptMission 產一個（測試 setup helper）。
   產生 forged asset：用 fake commander key 簽，測試用 real public key 驗證（用真實 Ed25519 fake/real keypairs）。

2. 先寫測試 → 失敗確認 → 寫實作。

3. src/decryption/loadAsset.ts：
   ```ts
   import { decryptMission } from '../crypto';
   import { fromBase64Url } from '../crypto/codec';
   import { verify, importPublicKey } from '../crypto/sign';
   import { canonicalJSON, utf8Encode } from '../crypto/codec';
   import { parseMissionAsset, type MissionAssetV1 } from '../crypto/schema';

   export type LoadResult =
     | { ok: true; asset: MissionAssetV1 }
     | { ok: false; reason: 'not_found' | 'invalid_asset' | 'forged_asset' | 'unsupported_version' };

   export async function loadAsset(
     missionId: string,
     commanderPublicKey: CryptoKey,
   ): Promise<LoadResult> {
     // 1. fetch /missions/<id>.json?v=<schemaVersion> for cache busting
     // 2. handle non-200 → not_found
     // 3. parse JSON → catch → invalid_asset
     // 4. parseMissionAsset (zod) → fail → invalid_asset
     // 5. check schemaVersion in known set ('1') → unsupported_version
     // 6. verify Ed25519 signature on canonicalJSON(asset_without_signature) → fail → forged_asset
     // 7. return { ok: true, asset }
   }
   ```

4. 跑 `pnpm test src/decryption/loadAsset.test.ts` 確認 7 個全 pass。
5. 跑 `pnpm typecheck` 全清潔。
6. Commit：`feat(decryption): loadAsset with schema parse + signature verify`
```

### Task 2.5: useDecryptionMachine hook

**Files:**
- Create: `src/decryption/useDecryptionMachine.ts`
- Create: `src/decryption/useDecryptionMachine.test.tsx` (用 RTL 測 hook)

**Codex prompt:**

```
[通用前綴]

任務：整合狀態機 + 資產載入 + 解密函式為 React hook。

src/decryption/useDecryptionMachine.ts:
```ts
import { useEffect, useReducer } from 'react';
import { decryptMission } from '../crypto';
import { getCommanderPublicKey } from '../publicKeys/commanderPublicKey';
import { loadAsset } from './loadAsset';
import { initialState, reducer, type State } from './state';

export function useDecryptionMachine(missionId: string | null): {
  state: State;
  submit: (gameId: string, personalKey: string) => void;
  retry: () => void;
} {
  const [state, dispatch] = useReducer(reducer, initialState);

  // 1. Bootstrap: 確認 SubtleCrypto 可用 + Ed25519 supported
  useEffect(() => {
    if (state.kind !== 'BOOTSTRAPPING') return;
    if (!missionId) {
      dispatch({ type: 'ENV_FAIL' });
      // 註：missing_mission_id 與 unsupported_env 是不同 reason；
      // 這個 hook 簡化為一律 ENV_FAIL → 由 App.tsx 額外決定 missionId 缺失要顯示什麼
      return;
    }
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      dispatch({ type: 'ENV_FAIL' });
      return;
    }
    dispatch({ type: 'ENV_OK', missionId });
  }, [state.kind, missionId]);

  // 2. Asset loading
  useEffect(() => {
    if (state.kind !== 'ASSET_LOADING') return;
    let cancelled = false;
    (async () => {
      const pubKey = await getCommanderPublicKey();
      const result = await loadAsset(state.missionId, pubKey);
      if (cancelled) return;
      if (result.ok) {
        dispatch({ type: 'ASSET_LOADED', asset: result.asset });
      } else {
        dispatch({ type: 'ASSET_FAILED', reason: result.reason });
      }
    })();
    return () => { cancelled = true; };
  }, [state.kind, state.kind === 'ASSET_LOADING' ? state.missionId : null]);

  // 3. Decrypting
  useEffect(() => {
    if (state.kind !== 'DECRYPTING') return;
    let cancelled = false;
    (async () => {
      const pubKey = await getCommanderPublicKey();
      const result = await decryptMission({
        asset: state.asset,
        commanderPublicKey: pubKey,
        gameId: state.gameId,
        personalKey: state.personalKey,
      });
      if (cancelled) return;
      if (result.ok) {
        dispatch({ type: 'DECRYPT_OK', mission: result.mission, heroImage: result.heroImage });
      } else {
        dispatch({ type: 'DECRYPT_FAIL', reason: result.reason });
      }
    })();
    return () => { cancelled = true; };
  }, [state.kind]);

  return {
    state,
    submit: (gameId, personalKey) => dispatch({ type: 'SUBMIT', gameId, personalKey }),
    retry: () => dispatch({ type: 'RETRY' }),
  };
}
```

寫對應測試（RTL renderHook + mock fetch + mock getCommanderPublicKey）至少 4 個整合 case：
- 完整 happy path: BOOTSTRAPPING → ASSET_LOADING → LOCKED → DECRYPTING → DECRYPTED
- not_found 從 fetch 拋出後到達 ERROR(not_found, retryable=true)
- auth_failed 後 retry → 回 LOCKED
- forged_asset 後不可 retry

實作 hook 時注意 `useEffect` deps 對 discriminated union 的處理（用條件式 select missionId 等）。

跑 `pnpm test src/decryption` 確認 hook 測試通過。typecheck 清潔。
Commit：`feat(decryption): useDecryptionMachine hook orchestrating state + crypto`
```

---

## Phase 2 — UI Components

### Task 2.6: Shared primitives (FrameBracket, Button, Input, ProgressBar, ScannerSweep)

**Codex prompt:**

```
[通用前綴]

任務：建立 shared UI primitives（呼應 spec §7.2, §7.4）。先寫測試 → 寫實作。

1. src/components/shared/FrameBracket.tsx
   - 接受 `size`, `color`, `className` props
   - 渲染一個 div，內含 4 個 SVG L 形角（左上/右上/左下/右下），每個 16-24px、1.5px stroke
   - 角為 children 包裹的容器，children 在中間
   ```tsx
   <FrameBracket size={20} color="primary"><img src=...></FrameBracket>
   ```

2. src/components/shared/Button.tsx
   - props: `variant: 'primary' | 'secondary'`, `disabled?`, `onClick`, `children`, `aria-label?`
   - primary: bg-primary text-bg-primary, hover 暗化
   - secondary: 1px primary 邊框，hover 10% primary 填色 + glow box-shadow
   - disabled state with low opacity

3. src/components/shared/Input.tsx
   - props: `value`, `onChange`, `placeholder`, `disabled?`, `aria-label`, `id`
   - 左側 2px 垂直 accent bar（active 時 primary 色，否則 border 色）
   - 半透明深色背景

4. src/components/shared/ProgressBar.tsx
   - props: `progress: 0..1` 或 `indeterminate?: boolean`
   - segmented bar：10 個小矩形，依 progress 比例填滿
   - indeterminate 模式跑 loading 動畫

5. src/components/shared/ScannerSweep.tsx
   - 全寬橘色發光線，由上至下 800ms 循環，無限播放
   - 用純 CSS @keyframes（寫進 src/styles/animations.css）
   - 自動尊重 prefers-reduced-motion (CSS 媒體已 set animation-duration: 0.001ms)

6. shared.test.tsx 至少 6 個測試：
   - FrameBracket 渲染 4 個角
   - Button primary 與 secondary 不同 className
   - Button disabled 不觸發 onClick
   - Input change 事件
   - ProgressBar 渲染對應 segments
   - ScannerSweep 渲染（基本存在性）

7. 用 Tailwind utility classes（從 .font-display, .font-body 等以及 bg-primary, text-text 等 — 但這些是 design tokens，需要靠 Tailwind v4 自動產生 utility class，請確認 Tailwind v4 的 @theme 確實會生成 bg-* / text-* utility）

   **如果 bg-primary 等 utility 不存在**（Tailwind v4 預設只生成 `--color-primary` CSS var，不自動成 bg-primary class），有兩條路：
   a) 用 CSS var 直接寫 inline style 或自訂 utility class
   b) 在 src/styles/index.css 新增 `@utility` 區塊定義所需的 utility
   
   選擇 b)：在 index.css 加：
   ```css
   @utility bg-primary { background-color: var(--color-primary); }
   @utility bg-bg-primary { background-color: var(--color-bg-primary); }
   @utility bg-bg-secondary { background-color: var(--color-bg-secondary); }
   @utility text-primary { color: var(--color-primary); }
   @utility text-text { color: var(--color-text); }
   @utility text-danger { color: var(--color-danger); }
   @utility border-border { border-color: var(--color-border); }
   @utility border-primary { border-color: var(--color-primary); }
   ```
   
   若 codex 對 Tailwind v4 utility 生成機制有疑問，可改成全用 inline style（var()）。

8. 跑 `pnpm test src/components/shared/shared.test.tsx` 全 pass，typecheck 清潔。
9. Commit：`feat(ui): shared primitives — FrameBracket/Button/Input/ProgressBar/ScannerSweep`
```

### Task 2.7: LockedView component

**Codex prompt:**

```
[通用前綴]

任務：建立 LockedView — 第一相 UI（spec §4 LOCKED state）。

src/components/LockedView.tsx
- props: 
  - asset: MissionAssetV1（從 state 拿）
  - onSubmit: (gameId: string, personalKey: string) => void
  - submitting: boolean（按鈕禁用）

行為：
- 左半：FrameBracket 包 lock icon (line style SVG)，下方游標閃爍式 "ACCESS LOCKED" 文案
- 中央：表單 — Game ID input + Private Key input（personalKey）+ START DECRYPTION button
- 右半：mission 9 個欄位的 label + value，value 為對應 asset.fields[fieldName].ciphertext 截取顯示成 ASCII 符號流（spec §7.2 規定限制字符集 "% $ @ ! # ^ & * ( ) _ + [ ] { } ; ' \" < > ? / ~"）

  - 把 ciphertext base64url 字串 → 取前 N 字元（N 為呼應該欄位「正常文字長度」的視覺估計，例如 16-50 字元）
  - 將 base64 字元 (A-Z,a-z,0-9,_-) 透過固定映射轉為符號集合中的字元（每個 base64 字元對應一個固定符號，保持決定論）
  - 寫個 helper `function toGibberish(b64url: string, length: number): string`

- 整體用 monospace 或 Orbitron Inter 混排
- a11y：表單有 label，提交按鈕有 aria-label，icon SVG 有 aria-hidden

views.test.tsx 中為 LockedView 寫至少 4 個測試：
- renders mission field labels + gibberish (不是真實內容)
- form submit 觸發 onSubmit with correct args
- submitting=true 時 button 禁用
- gibberish 是決定論的（同一 ciphertext 多次渲染相同符號）

Commit：`feat(ui): LockedView with form + per-field ciphertext gibberish`
```

### Task 2.8: DecryptingView component

**Codex prompt:**

```
[通用前綴]

任務：建立 DecryptingView — 第二相 UI。

src/components/DecryptingView.tsx
- props: 無（純展示性）

視覺：
- 中央 圓形 spinner with checkmark (orange ring rotating)
- 文字 "DECRYPTING..."（typewriter 浮現）
- 底部 ProgressBar indeterminate 模式 (10 segments 跑 loading 動畫)
- 整體 ScannerSweep 全屏 overlay

用 Framer Motion：
- 圓形 spinner: animate rotate 0→360deg loop
- 文字 typewriter: 一個字一個字浮現

a11y:
- role="status" aria-live="polite"
- 文字 "Decrypting transmission, please wait"

views.test.tsx 補 2 tests:
- renders DECRYPTING text
- has role=status aria-live=polite

Commit：`feat(ui): DecryptingView with spinner + scanner sweep`
```

### Task 2.9: DecryptedView component

**Codex prompt:**

```
[通用前綴]

任務：DecryptedView — 第三相，顯示真實 mission。

src/components/DecryptedView.tsx
- props:
  - mission: MissionPlaintext
  - heroImage: { mimeType: string; bytes: Uint8Array; altText: string }

視覺：
- 左上：FrameBracket 包 hero 圖片（用 URL.createObjectURL(new Blob([bytes], { type: mimeType }))）
- 右側：mission 9 欄位 label + value（真實值），label 用 .font-label，value 用 .font-body
- 解密成功後顯示 checkmark icon 在右上角

加 useEffect + cleanup：URL.createObjectURL 需要對應 URL.revokeObjectURL on unmount。

views.test.tsx 補 2 tests:
- renders all 9 mission fields with real values
- creates and revokes object URL for hero image

Commit：`feat(ui): DecryptedView with mission card + hero image`
```

### Task 2.10: ErrorView component

**Codex prompt:**

```
[通用前綴]

任務：ErrorView — ERROR(reason) UI 文案 + retry 按鈕。

src/components/ErrorView.tsx
- props:
  - reason: DecryptErrorReason
  - retryable: boolean
  - onRetry?: () => void

對應 spec §4 UI 文案表：
- missing_mission_id → "NO MISSION SPECIFIED"
- not_found → "MISSION NOT FOUND" (retryable)
- invalid_asset → "TRANSMISSION CORRUPTED"
- unsupported_env → "BROWSER UNSUPPORTED — REQUIRES HTTPS + MODERN BROWSER"
- unsupported_version → "PROTOCOL VERSION MISMATCH"
- forged_asset → "⚠️ MISSION SIGNATURE INVALID — DO NOT TRUST" (紅色強調)
- auth_failed → "DECRYPTION FAILED" (retryable)
- cipher_corrupt → "DECRYPTION FAILED — TRANSMISSION DAMAGED" (retryable)
- invalid_personal_key_format → "INVALID KEY FORMAT" (retryable)

視覺：
- 紅色 #E5484D border + danger icon
- 文案居中
- forged_asset 額外 pulse warning indicator
- retryable 顯示 RETRY button，否則只顯示說明文字

ARIA: role="alert" aria-live="assertive"

views.test.tsx 補 4 tests:
- forged_asset 顯示警示文字 + 紅色
- not_found 顯示 retry button
- unsupported_env 沒有 retry button
- click retry triggers onRetry

Commit：`feat(ui): ErrorView with reason→message dispatch + retry`
```

### Task 2.11: App.tsx — URL 解析 + view 路由

**Codex prompt:**

```
[通用前綴]

任務：取代 placeholder App.tsx，整合所有 view 與 hook。

src/App.tsx:
```tsx
import { useDecryptionMachine } from './decryption/useDecryptionMachine';
import { LockedView } from './components/LockedView';
import { DecryptingView } from './components/DecryptingView';
import { DecryptedView } from './components/DecryptedView';
import { ErrorView } from './components/ErrorView';

export function App() {
  const missionId = new URLSearchParams(location.search).get('mission_id');
  const { state, submit, retry } = useDecryptionMachine(missionId);

  return (
    <main className="min-h-screen bg-bg-primary text-text font-body">
      <header className="border-b border-border p-4">
        <h1 className="font-display text-primary">STAR CITIZEN // FLEET COMMAND</h1>
        <p className="font-label text-text/70">SECURE COMMUNICATION PROTOCOL</p>
      </header>
      <section>
        {state.kind === 'BOOTSTRAPPING' && <BootingView />}
        {state.kind === 'ASSET_LOADING' && <BootingView />}
        {state.kind === 'LOCKED' && (
          <LockedView
            asset={state.asset}
            onSubmit={submit}
            submitting={false}
          />
        )}
        {state.kind === 'DECRYPTING' && <DecryptingView />}
        {state.kind === 'DECRYPTED' && (
          <DecryptedView mission={state.mission} heroImage={state.heroImage} />
        )}
        {state.kind === 'ERROR' && (
          <ErrorView
            reason={state.reason}
            retryable={state.retryable}
            onRetry={state.retryable ? retry : undefined}
          />
        )}
      </section>
      <footer className="border-t border-border p-4 mt-8">
        <span className="font-label text-text/70">FLEET COMMAND // VERSION 1.0.0</span>
      </footer>
    </main>
  );
}

function BootingView() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="font-display text-primary">LOADING TRANSMISSION...</p>
    </div>
  );
}
```

App.test.tsx 至少 3 tests：
- renders header + footer
- BOOTSTRAPPING shows "LOADING TRANSMISSION"
- mock missionId → confirms hook invoked (用 vi.mock）

Commit：`feat(ui): App composition with state machine view dispatch`
```

---

## Phase 3 — Polish

### Task 2.12: 動畫整合（typewriter / scramble / shake）

**Codex prompt:**

```
[通用前綴]

任務：用 Framer Motion 強化動畫，提升儀式感。

1. LockedView 的密文 gibberish：每個欄位的字符以 50ms 間隔逐字浮現（typewriter）
2. DecryptingView 的 spinner：rotate loop + scale pulse
3. DecryptingView → DecryptedView 過渡：每欄位密文以 character randomizer 滾動 500ms 後定格成 plaintext（用 framer-motion useAnimate 或 useEffect + setTimeout）
4. ErrorView shake：水平震動 300ms，紅色 flash

所有動畫尊重 prefers-reduced-motion（CSS 已全域 set，但 Framer Motion 也應用 useReducedMotion hook）

views.test.tsx 補 1 test：
- prefers-reduced-motion 啟用時，動畫被 skip（用 jsdom matchMedia mock）

跑 `pnpm test`、`pnpm typecheck` 全清潔。
Commit：`feat(ui): framer-motion animations + reduced-motion respect`
```

### Task 2.13: 手刻 fixture mission asset

**Codex prompt:**

```
[通用前綴]

任務：產生一個 _example.json fixture，可被部署網站解密用。

由於 commanderPublicKey 是 placeholder（全零），此 fixture 必須**先用全零私鑰簽**才能與當前 placeholder 對得上。但全零不是 valid Ed25519 private key。

替代方案：
1. 暫時把 commanderPublicKey.ts 的 placeholder 改成「測試用 well-known keypair」的公鑰（例：DEV_TEST_PUBLIC_KEY）
2. 用對應私鑰產 _example.json
3. 在 commanderPublicKey.ts 加一個 dev-mode flag，只在 import.meta.env.DEV 時用 dev key

實作建議：
- 把 commanderPublicKey.ts 改成 dual-key（dev + prod placeholder）
- 寫個 dev script `scripts/generate-example-mission.ts` 用 dev keypair 產 _example.json
- 跑該 script 產出 public/missions/_example.json
- 寫測試確認 _example.json 在 dev mode 可被 loadAsset 成功 verify

Commit：`feat(decryption): example mission fixture for dev mode`
```

### Task 2.14: Final sanity + manual smoke

**Codex prompt:**

```
[通用前綴]

任務：最後驗收。

1. 跑 `pnpm typecheck` — 必須清潔
2. 跑 `pnpm test` — 全部通過（73 + 新增的）
3. 跑 `pnpm build` — 必須產出 dist/ 無錯誤
4. （無法跑 dev server smoke 因為 agent 環境限制）— 跳過

5. 不需 commit (純驗證)。
6. Final report 包含：
   - typecheck output
   - test output (test count)
   - build output (bundle size)
```

---

## Acceptance Criteria for Plan 2

- ✅ `pnpm typecheck` 清潔
- ✅ 所有 unit + RTL component tests 通過（預估 ~100+）
- ✅ `pnpm build` 成功，dist/ 含 mission HTML + bundled JS + Orbitron/Inter
- ✅ `src/App.tsx` 整合所有 view + 狀態機 + URL 解析
- ✅ 手刻 fixture mission 在 dev mode 可被解密（_example.json）
- ✅ 視覺基本符合 mockup（橘黑、Orbitron、frame brackets、segmented progress）
- ✅ a11y：prefers-reduced-motion / role=status / aria-live=alert / focus

**Out of scope (Plan 3):** fleetOps API、authoring modal、commander identity 持久化、實際部署、cross-browser e2e 實際 run。
