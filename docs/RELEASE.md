# MINECRAFT? 0.2.0

0.2.0 adds Settings → Inventory size (75–225%, default 150%), eliminates
duplicate tab redraws and caches player face textures. Imported Chrome
passwords, cookies and bookmarks are managed under Settings → Import from
Chrome. Existing inventory, skin, resource packs and language settings persist.

Passwords use Chrome's CSV export and are stored using Windows-backed
encryption in `imported-data.enc`. Open a site, choose Saved passwords in the
sidebar and choose Fill login for a matching origin. Filling is explicit,
does not submit forms and does not expose passwords through the metadata UI.
The import keeps existing entries for the same origin and username. The
original CSV remains a plaintext export; remove it yourself after importing.

For cookies and bookmarks, use Open helper folder, load that folder in
Chrome's chrome://extensions page with Developer mode, start a transfer in
this app, then open the helper from Chrome's extensions menu. Paste the code
and choose Transfer now. The helper reads Chrome data only on that click and
sends it directly to an ephemeral authenticated loopback receiver. Codes
expire after 10 minutes and work once. Existing app cookies are kept unless
the replace option is selected. Chrome's source data is not changed.

Chrome bookmarks are kept in their own searchable library; importing does
not overwrite inventory slots. This is a one-time migration, not ongoing sync.
Some sites require a new login. Partitioned cookies, device-bound session
keys, passkeys, payment cards, history and extensions are not imported. A
personal signed-in Chrome profile was not used during development testing.
See `design/evidence/v12/` for synthetic-data, native UI and performance checks.

0.1.1 fixes an inventory click handler that incorrectly treated clicks on
bookmarks, the search button and inventory tools as a request to open a new
tab. The fix scopes that action to its actual address-menu button. Regression
checks now use mouse/keyboard input through the UI and load live HTTPS pages
and Google results. Evidence is recorded under `design/evidence/v11/`.

Windows x64 personal browser. The window and UI are named MINECRAFT?. The
installer and executable use the filesystem-safe name Minecraft Browser.

The supplied `VanillaTweaks_r106307_MC26.3.x.zip` is bundled unchanged and
activated on the first launch of a new profile. Its SHA-256 is
`0d01358f39e174fe1af6570fd608a2602e4c1dbe506c3e6d63bf86e26599deaf`.
Subsequent pack changes, bookmarks, skin, sound and language settings persist.
English is the default; Settings → Language offers Korean.

Use Ctrl+L for an address or Google search, Ctrl+T for a new tab, Ctrl+W to
close a tab, and Ctrl+B to toggle the shared sidebar. Drag a sidebar tab to
either half of the page to open dual view. Toggling dual view off keeps the
left page; closing a pane explicitly keeps the chosen page.

The app runs without Python, Node or a development server installed. Website
visits and Minecraft News need an Internet connection. The profile is stored
at `%APPDATA%\MinecraftBrowser`; uninstalling keeps this profile. The localhost
web preview is a different profile and is not migrated or modified by this
installer. Tabs are not restored after closing the app. Downloads use the
native save dialog; the download list currently lasts for the running session.

EasyList and EasyPrivacy filters are bundled for network and cosmetic ad
blocking. The sidebar allows blocking to be disabled; reload sites after
changing this setting. This version does not replace ads with custom images.
YouTube playback/ad-block compatibility, DRM streaming and Google sign-in
have not been verified. Google may restrict sign-in from embedded browsers.
No OAuth project or API key is required. Optional cookie migration uses the
user-operated Chrome helper described above; it does not bypass site sign-in.

Gmail unread tracking reads only the Inbox badge/title from a signed-in Gmail
tab owned by this browser, while that tab remains open (also when another tab
is selected). It does not read mail contents or mark emails read. Gmail markup
changes may require a parser update. A real signed-in Gmail account was not
used during verification.

Minecraft News is polled while the app is open; there is no OS background
notification service. Resource-pack support is described in README.md.

The installer is unsigned. The original 0.1.0 checks are recorded under
`design/evidence/v10/`; they did not cover the actual click path and missed
this regression. The 0.1.1 checks are under `design/evidence/v11/`; the 0.2.0
package, UI, synthetic migration and performance checks are under
`design/evidence/v12/`.

Implementation references: [Electron WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view),
[Electron security](https://www.electronjs.org/docs/latest/tutorial/security),
[Ghostery Electron blocker](https://github.com/ghostery/adblocker/tree/master/packages/adblocker-electron).
Filter source URLs and licenses are preserved with the bundled lists.
