# Agent Guidelines — DH Studio Pro

Before making any code changes in this repository, read [CLAUDE.md](CLAUDE.md) in full. It defines the project architecture, DHbox ecosystem bridge v1 rules, and development/test commands.

## Mandatory Parallel Bilingual Synchronization (`vi` <-> `en`)

DH Studio Pro supports switching UI language between Vietnamese (`vi`) and English (`en`) in Settings. **Every agent updating UI, notifications, user-facing errors, Tray menus, release notes, or configuration MUST implement both languages in parallel at the time of the change.** Never ship Vietnamese-only UI or leave English translations for later.

### 1. React Components (`.tsx`)
- Always import `{ useTranslation }` (plus `getLocaleCode`, `localizeBackendMessage` when needed) from `@/core/lib/i18n`.
- Wrap **every** user-visible string — headings, buttons, tooltips (`title`), `placeholder`, `aria-label`, badges, status labels, validation errors, `alert()`/`confirm()`, and Toast messages — using `t("key")` or `tr(vi, en)`.
- Format dates, times, and locale-sensitive numbers with `getLocaleCode(lang)` (`"vi-VN"` vs `"en-US"`).
- Wrap messages coming from Rust commands or native events in `localizeBackendMessage(message, lang)`.
- Add `lang` to `useMemo` / `useCallback` / `useEffect` dependency arrays whenever the memoized value or side effect produces localized strings.

### 2. Imperative TypeScript Services, Hooks & Stores (`.ts`)
- For user-facing errors, progress updates, notifications, or labels generated outside React components, import `{ trText, translate, getCurrentLanguage, getLocaleCode }` using a **relative `.ts` path** (e.g., `../../../core/lib/i18n.ts`).
  - Why relative `.ts`: Node unit tests run directly with `node --experimental-strip-types --test`, which does not resolve Vite `@/` aliases or extensionless imports cleanly across all modules.
- Wrap user-facing messages with `trText(vi, en)` or `translate(key)`.
- Keep `defaultSettings.language === "vi"` in `src/core/stores/useSettingsStore.ts` when `localStorage` is unavailable (Node/test compatibility).

### 3. Central Dictionaries, Registries & Release Notes
- **`src/core/lib/i18n.ts`**: Keep `translations.vi` and `translations.en` 100% key-synchronized (enforced at TypeScript compile time and in `tests/i18n/i18n-sync.test.ts`). Never leave Vietnamese copy inside `translations.en`.
- **`src/core/data/versionHistory.ts`**: Every new release entry MUST populate both `title` + `titleEn` and `items` + `itemsEn` across all sections.
- **`src/registry.ts` & `src/core/services/aiSettingsService.ts`**: Keep module metadata and `getAvailableGeminiModels(lang)` up to date for both `vi` and `en`.

### 4. Multi-Window & Native Tray Synchronization
- Any change to native Tray menu items or Rust backend user messages must update both:
  - `src-tauri/src/tray.rs` (`build_tray_menu`, `update_tray_language`)
  - `src/core/lib/i18n.ts` (`localizeBackendMessage`)
- Preserve the cross-window sync listeners (`app-language-changed` and `tray-panel-shown` calling `syncLanguage()`) in `src/modules/tray-panel/TrayControlPanel.tsx`.

### 5. Domain Data Tokens — DO NOT Translate
Some Vietnamese strings are **data matching tokens** rather than UI copy and **must stay exact** so Google Sheet integration and folder heuristics do not break:
- Google Sheet status values, default tab names & column aliases: `"Chưa lọc"`, `"Đã lọc"`, `"Đang lọc"`, `"Chờ lọc"`, `"Chưa chụp"`, `"Đang xử lý"`, `"Chưa sửa"`, `"DS Khách"`, `KNOWN_SEMANTIC_ALIASES` (`src/modules/contact-the-sheet/services/sheetDiscoveryService.ts`), `codeHeaderKeywords` (`sheetExtractorService.ts`), and `STANDARD_19_STUDIO_MAPPINGS` (`useContactSheetStore.ts`).
- Studio folder heuristics: `"màu final"`, `"ảnh gốc"`, `"file gốc"`, `"chưa sửa"`, `"đã sửa"`, `"trả ảnh"`, `"cọ"`, `"giáo trình"`, `"tài liệu"`, and day/month folder regexes in `usePhotoCounterStore.ts` / `folderParserService`.
- Machine-readable error code prefixes (`INVALID_SHEET_URL: `, `GOOGLE_TOKEN_EXPIRED: `, `SHEET_ACCESS_DENIED: `, `SHEET_NOT_FOUND: `, `GOOGLE_NETWORK_ERROR: `, `EXPIRED: `, `GOOGLE_NOT_CONNECTED: `, `GOOGLE_REFRESH_TOKEN_NOT_FOUND: `, `STALE_ROW_CONFLICT: `).
- DHbox <-> DH Studio Pro bridge v1 action names and payload schemas (`contactSheetBridge.ts`, `src-tauri/src/bridge.rs`).

### 6. Mandatory Pre-Completion Verification
Before concluding any task that touches UI, user messages, Tray, or release notes:
1. Run `node --experimental-strip-types --test tests/i18n/i18n-sync.test.ts` — must pass with **0 unwrapped Vietnamese UI strings** in `src/**/*.tsx`. (Only add genuinely non-UI Sheet/folder matching literals to `DOMAIN_DATA_TOKENS` if needed after verifying usage.)
2. Run `npm run build` (`tsc && vite build`) — must pass cleanly.
3. Run `cargo test --manifest-path src-tauri/Cargo.toml` and relevant Node unit tests under `tests/`.
