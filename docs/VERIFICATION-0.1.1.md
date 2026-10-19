# 0.1.1 navigation repair — 2026-10-19

## Confirmed cause

The delegated click handler used `target.closest('[data-scene=home]')`.
Every inventory page itself has `data-scene="home"`, so clicking an inventory
bookmark, search button or tool also issued a second navigation to the
inventory. That cancelled page loads and immediately closed opened dialogs.
The user's installed `native-workspace.js` was verified byte-for-byte identical
to this faulty 0.1.0 source. The fix matches only the intended command-choice
button: `button.command-choice[data-scene="home"]`.

The previous tests called host navigation commands directly; they missed the
DOM click → delegated handlers → IPC path. A new regression suite sends real
mouse/key input through the app's UI. Before the fix, its compass-click check
fails because the address dialog immediately closes. After the fix it passes.
The input helper emits Enter's character event as well as keydown/keyup; the
earlier incomplete simulated Enter is recorded separately in `ui-network/`.

## Verified results

- 140 JavaScript logic checks and 4 Python news tests pass.
- The packaged 0.1.1 executable passes 14 input/navigation checks: compass,
  bookmark library, ad options, crafting-table editor, empty-slot editor,
  GitHub bookmark, address dialog, HTTPS address + Enter, inventory restoration,
  Google search-button results, Google search + Enter, NAVER bookmark, inventory
  background click and absence of app-UI errors.
- Actual external pages loaded: GitHub, example.com, Google results for
  `Minecraft redstone` and `Minecraft resource packs`, and NAVER. The Google
  result container is present and no traffic challenge is detected.
- The same packaged executable passes the 18 existing native integration checks.
- NSIS installer 0.1.1 builds successfully. Bundled UI matches the fixed source,
  and the bundled default pack matches the original supplied ZIP's SHA-256.
- The Windows installer is unsigned. The original 0.1.0 installer is preserved.

Evidence: `design/evidence/v11/before-fix/`, `packaged-ui/result.json`,
`packaged-core/result.json`, their PNGs/logs, and `release-integrity.json`.
Website PNGs are exports of the browser's native page view, not composited
desktop captures. These checks do not validate Google account login, Gmail
delivery, DRM or YouTube ad blocking.

The existing user installation and its `%APPDATA%\MinecraftBrowser` profile
were not overwritten during these tests. Verification used isolated test
profiles. Install 0.1.1 over 0.1.0 to use the repair; the app ID, profile path,
storage keys and resource-pack database remain unchanged.

Installer: `release/Minecraft-Browser-Setup-0.1.1-x64.exe`, 168,772,816 bytes.
SHA-256: `5bfde266712de2cecd56e6c431744e5ac47ac23891548ffa2adc5f0d378c970b`.
