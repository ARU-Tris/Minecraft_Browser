# Native browser and Gmail login-session adapter

`main.cjs` is the Electron entrypoint. A sandboxed trusted UI at `craftside-app://app/design/index.html` and isolated WebContentsView tabs use separate persistent sessions. `preload.cjs` exposes narrow IPC only to the trusted UI, with sender/frame and URL validation. Native pages, popups, history, downloads, the shared sidebar and dual view are connected. EasyList/EasyPrivacy filters are bundled. The static HTML preview remains separate.

The Gmail adapter is attached to this app's native tabs. No real account has been accessed during verification. See [release scope](../docs/RELEASE.md) and `design/evidence/v10/` for checked behavior and the unverified login/YouTube cases.

The product flow is: open Gmail in CRAFTSIDE, sign in normally, and reuse that browser profile's session. The user does not create a Google project, OAuth client JSON, API key or grant a separate Gmail API integration.

`gmail-reader.cjs` reads the Inbox unread badge/accessibility label and, as a fallback, the Gmail Inbox title. English and Korean signals are recognized. It returns only `{ status, unread }`; it does not read mail subjects, bodies, passwords, cookies or tokens, and never clicks or marks messages as read. Counts such as `99+` remain a positive lower bound rather than an exact total. Unknown signals are not treated as zero.

`watchGmailSession(webContents, onChange)` in `gmail-session.cjs` samples the owning browser's Gmail tab in an isolated world on document/title/navigation changes and every 15 seconds. An unknown snapshot within the same mailbox preserves its last known count; account changes and logout discard that count. Destroying the view removes listeners and timers. Use the profile's ordinary session rather than a separate partition. A browser implementation must keep a Gmail view alive if unread updates are expected after its visible tab closes; this release does not create a background view after the Gmail tab is closed.

A native host must attach one watcher to the selected account's Gmail WebContents, stop the previous watcher when changing views/profiles, and relay only its normalized state to the trusted CRAFTSIDE UI. The UI already consumes this preload contract:

```js
window.craftsideNotifications = {
  getGmailUnread: async () => ({ status: 'unknown', unread: null }),
  onGmailUnread(callback) { /* subscribe to host state; return unsubscribe */ }
};
```

Use `contextBridge`/narrow IPC for the real contract, expose it only to the trusted new-tab UI, and validate the sender. Gmail and other external sites must not receive this bridge or Node access. The code above documents the interface; the native preload implements it, while the static preview has no such bridge.

The DOM parser is intentionally conservative. Google can change Gmail's markup or title format; those cases need live native-browser verification and parser updates. A successful normal Google sign-in in the eventual browser must also be verified separately. There is no claim that Electron login compatibility or a signed-in Gmail account was tested here.

Run `node tests/unread.cjs` from the project root for storage, reader fixtures, standalone script execution, and mocked WebContents lifecycle checks. Those are not live Gmail tests.

API reference checked on 2026-10-19: [Electron WebContents events and isolated-world execution](https://www.electronjs.org/docs/latest/api/web-contents).
