'use strict';
const { script } = require('./gmail-reader.cjs');
const { gmailState } = require('../design/unread-model.js');

// Attach to the Gmail WebContents owned by the future browser's normal profile.
// No cookies, tokens, passwords, mail contents or remote API calls are read.
function watchGmailSession(contents, onChange, options = {}) {
  const every = options.setInterval || setInterval, cancel = options.clearInterval || clearInterval;
  let stopped = false, revision = 0, last = '', pending = false, again = false, mailbox = null, known = null;
  function publish(value) {
    if (stopped) return;
    const state = gmailState(value), signature = JSON.stringify(state);
    if (signature !== last) { last = signature; onChange(state); }
  }
  async function sample() {
    if (stopped || contents.isDestroyed()) return;
    if (pending) { again = true; return; }
    const current = ++revision, href = contents.getURL();
    let url; try { url = new URL(href); } catch { publish({ status: 'unknown' }); return; }
    if (url.protocol !== 'https:' || url.hostname !== 'mail.google.com' || url.username || url.password || url.port) {
      mailbox = null; known = null;
      publish({ status: url.protocol === 'https:' && url.hostname === 'accounts.google.com' ? 'signed-out' : 'unavailable' }); return;
    }
    const account = url.pathname + '?' + (url.searchParams.get('authuser') || '');
    if (mailbox !== account) { mailbox = account; known = null; publish({ status: 'unknown' }); }
    pending = true;
    try {
      // Isolated world has DOM access without exposing any privileged API to Gmail.
      const value = await contents.executeJavaScriptInIsolatedWorld(1101, [{ code: script }]);
      if (current === revision && !stopped && !contents.isDestroyed() && contents.getURL() === href) {
        const state = gmailState(value);
        if (state.status === 'signed-in') known = state;
        // A collapsed sidebar or a Sent title cannot clear an unread indicator.
        publish(state.status === 'unknown' && known ? known : state);
      }
    } catch { if (current === revision) publish({ status: 'unknown' }); }
    finally { pending = false; if (again) { again = false; sample(); } }
  }
  function navigate(_event, _url, isInPlace, isMainFrame) {
    if (!isMainFrame || isInPlace) return;
    revision++; publish({ status: 'unknown' });
  }
  const events = { 'dom-ready': sample, 'page-title-updated': sample, 'did-navigate-in-page': sample, 'did-navigate': sample, 'did-start-navigation': navigate, 'destroyed': stop };
  function stop() {
    if (stopped) return;
    publish({ status: 'unavailable' }); stopped = true; revision++;
    cancel(timer); for (const [event, listener] of Object.entries(events)) contents.removeListener(event, listener);
  }
  for (const [event, listener] of Object.entries(events)) contents.on(event, listener);
  const timer = every(sample, options.intervalMs || 15000); timer.unref?.();
  sample();
  return { sample, stop };
}
module.exports = { watchGmailSession };
