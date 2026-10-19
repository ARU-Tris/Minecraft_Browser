# 0.1.0 verification — 2026-10-19

The initial audit passed 130 existing checks. It also found that the project
was still a web interaction prototype: external links opened the host browser,
the address bar selected demonstration pages, and there was no native app or
installer configuration. The release adds the Electron host and a separate
native workspace, retaining the existing preview and its data.

The native integration fixes overlay ordering (dialogs above page views,
advancements in a separate owned popup), refreshes detached inventory pages
before reuse, preserves the left page when closing dual view, and imports the
provided resource pack only for an untouched profile. A deliberately disabled
pack is not re-enabled on restart. The original ZIP is bundled byte-for-byte.

## Results

- `npm test`: 140 checks pass, covering inventory, languages/player, ambience,
  unread state/controller, ZIP/pack storage and browser state/URL validation.
- `python tests/news-server.py`: 4 checks pass. Total automated logic checks: 144.
- Native development integration: 18 checks pass.
- NSIS installer build: succeeds, Windows x64, version 0.1.0.
- Silent installation to an isolated project directory: exit 0.
- That installed executable, using a separate fresh test profile: 18 checks
  pass; English inventory, real WebContentsView navigation/history, sandbox/no
  app bridge on external pages, two visible nonoverlapping panes, left-pane
  priority, owned advancement popup, filter enable/disable, Korean switch,
  exact supplied pack, reload persistence and disabled-pack preservation.
- Runtime renderer errors: none recorded in the native checks.
- Temporary test installation uninstalled successfully; test profile and
  release installer remain. No existing installation was replaced.
- Production dependency audit: 0 reported vulnerabilities at verification time.
- Installer signature: NotSigned. A successful build does not imply signing.

The browser-engine integration uses a local HTTP fixture. It does not prove
Google login, receiving mail, YouTube playback/ad blocking, DRM or every remote
site. No real account or mail was accessed. Downloads are connected but the
interactive save dialog and media/device permission flows were not exercised.
Custom-image ad replacement and shutdown tab restoration are not implemented.

## Evidence

See `design/evidence/v10/installed/result.json`, its runtime log and PNGs,
`install.json`, `uninstall.json`, `release-integrity.json` and `cleanup.json`.
`02-dual-ui.png` captures the UI renderer only; external views are exported
separately as `04-real-web-engine.png`. It is not a composited desktop capture.

The installer is `release/Minecraft-Browser-Setup-0.1.0-x64.exe` (168,770,800
bytes). SHA-256: `834975178eff6ac48eb55f61f20e9cb4f1eade66a28d4015eca649e6d9bea702`.
Its archive excludes references, evidence, test packs and test profiles.
The original four reference files remain in `ref/`. The localhost preview
server and its browser storage are preserved; the installer uses a separate
profile at `%APPDATA%\MinecraftBrowser`.
