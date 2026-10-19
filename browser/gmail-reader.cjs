'use strict';

// Self-contained so the native host can run this read-only function in a Gmail tab.
// Only Inbox navigation labels/counts and the document title are inspected.
function readGmailUnread(document, href) {
  const unknown = { status: 'unknown', unread: null };
  let url;
  try { url = new URL(href); } catch { return unknown; }
  if (url.protocol !== 'https:' || url.hostname !== 'mail.google.com' || url.username || url.password || url.port) return unknown;
  if (!/^\/mail\/(?:u\/\d+\/?)?$/.test(url.pathname)) return unknown;
  const inboxName = /^(?:Inbox|받은편지함)(?=$|\s|\()/i;
  function count(value) {
    const text = String(value || '').trim();
    if (!/^[\d,\s\u00a0]+\+?$/.test(text)) return null;
    const number = Number(text.replace(/[,\s\u00a0+]/g, ''));
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }
  // Sidebar count wins over a stale title, and is available outside the Inbox.
  for (const link of document.querySelectorAll('a[href]')) {
    let target;
    try { target = new URL(link.getAttribute('href'), href); } catch { continue; }
    if (target.origin !== url.origin || target.pathname !== url.pathname || target.hash !== '#inbox') continue;
    const row = link.closest('.aim') || link;
    const label = link.getAttribute('aria-label') || link.textContent || '';
    if (!inboxName.test(label.trim())) continue;
    const badge = row.querySelector('.bsU');
    const badgeCount = badge ? count(badge.textContent) : null;
    if (badgeCount !== null) return { status: 'signed-in', unread: badgeCount };
    const numeric = label.trim().replace(inboxName, '').match(/^\s*(?:\()?([\d,]+\+?)\)?(?:\s+(?:unread(?:\s+messages?)?|개(?:의)?\s*(?:안 읽은 메일)?))?\s*$/i);
    if (numeric && count(numeric[1]) !== null) return { status: 'signed-in', unread: count(numeric[1]) };
    // Gmail leaves an empty .bsU in its actual Inbox navigation when it is zero.
    if (badge && !badge.textContent.trim() && !numeric) return { status: 'signed-in', unread: 0 };
  }
  const title = String(document.title || '').trim();
  // A title for Sent/Search/mail content must never clear a previously lit icon.
  const titleInbox = title.match(/^(?:Inbox|받은편지함)(?:\s*\(([\d,]+\+?)\))?\s+[-–—]\s+.+\s+[-–—]\s+Gmail$/i);
  if (!titleInbox) return unknown;
  const unread = titleInbox[1] ? count(titleInbox[1]) : 0;
  return unread === null ? unknown : { status: 'signed-in', unread };
}

module.exports = { readGmailUnread, script: `(${readGmailUnread.toString()})(document, location.href)` };
