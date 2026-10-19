(() => {
  'use strict';
  const $ = selector => document.querySelector(selector), model = window.CraftUnreadModel;
  const t = (source, values) => window.CraftI18n.t(source, values);
  let storage; try { storage = localStorage; } catch { storage = null; }
  const store = new model.Store(storage);
  let gmail = model.gmailState(null), gmailRevision = 0, preview = false, previewTimer;
  const nativeBridge = window.craftsideNotifications;
  function unread(kind) { return kind === 'news' ? store.newsCount > 0 : kind === 'gmail' && gmail.status === 'signed-in' && gmail.unread > 0; }
  function description(kind) {
    if (preview) return t('Enchantment preview');
    if (kind === 'news' && store.newsCount) return t('{count} unread news articles', { count: store.newsCount });
    if (kind === 'gmail') return gmail.status === 'signed-in' ? t('{count} unread emails', { count: gmail.unread }) : t('Unread mail follows your signed-in Gmail tab');
    return '';
  }
  function decorate(root = document) {
    for (const button of root.querySelectorAll('[data-notification-kind]')) {
      const kind = button.dataset.notificationKind, enabled = unread(kind) || preview;
      const image = button.querySelector('img'); if (!image) continue;
      if(button.dataset.unread!==String(unread(kind)))button.dataset.unread = String(unread(kind));if(button.dataset.unreadPreview!==String(preview))button.dataset.unreadPreview = String(preview);
      let glint = button.querySelector('.item-enchantment');
      if (enabled) {
        if (!glint) { glint = document.createElement('span'); glint.className = 'item-enchantment'; glint.setAttribute('aria-hidden', 'true'); button.append(glint); }
        const mask=`url("${image.src}")`;if(glint.style.getPropertyValue('--item-mask')!==mask)glint.style.setProperty('--item-mask',mask);
      } else glint?.remove();
      const base = button.dataset.notificationLabel;
      if (base) {const label=base+(enabled?' · '+description(kind):'');if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);}
    }
  }
  function render() {
    decorate();
    $('#unread-news-status').textContent = store.newsCount ? t('{count} unread news articles', { count: store.newsCount }) : t('No unread Minecraft News');
    const status = !nativeBridge ? 'Gmail tracking is not connected in this preview.' : gmail.status === 'signed-in' ? '{count} unread emails' : gmail.status === 'signed-out' ? 'Sign in to Gmail once to track unread mail.' : 'Open Gmail to track unread mail.';
    $('#gmail-session-status').textContent = t(status, { count: gmail.unread });
    $('#gmail-session-help').textContent = t(nativeBridge ? 'Uses your Gmail login in this browser. No separate Google setup.' : 'This screen preview cannot read Gmail tabs opened in another browser. No separate Google setup will be needed in the browser app.');
    $('#unread-save-error').hidden = !store.error;
  }
  function stopPreview() { clearTimeout(previewTimer); preview = false; $('#unread-preview-note').hidden = true; render(); }
  document.addEventListener('craftside:news-received', event => { store.receive(event.detail.articles || []); render(); });
  document.addEventListener('craftside:open-bookmark', event => {
    const kind = model.kindForURL(event.detail.url);
    if (kind === 'news') { store.readAllNews(); render(); }
    // Opening Gmail does not mark any message read. Only Gmail's actual unread count clears its glint.
    if (kind && preview) stopPreview();
  });
  $('#news-toast-link').addEventListener('click', () => {
    if ($('#news-toast').dataset.preview === 'true') return;
    store.readArticle($('#news-toast-link').href); render();
  });
  $('#preview-enchantment').addEventListener('click', () => {
    $('#settings-dialog').close(); preview = true; $('#unread-preview-note').hidden = false;
    clearTimeout(previewTimer); previewTimer = setTimeout(stopPreview, 20000); render();
  });
  $('#end-enchantment-preview').addEventListener('click', stopPreview);
  $('#open-gmail-session').addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('craftside:open-bookmark', { detail: { title: 'Gmail', url: 'https://mail.google.com/' } }));
  });
  window.addEventListener('storage', event => { if (event.key === model.key) { store.refresh(); render(); } });
  document.addEventListener('craftside:language-changed', render);
  if (nativeBridge?.onGmailUnread) nativeBridge.onGmailUnread(value => { gmailRevision++; gmail = model.gmailState(value); render(); });
  if (nativeBridge?.getGmailUnread) {
    const revision = gmailRevision;
    Promise.resolve(nativeBridge.getGmailUnread()).then(value => { if (revision === gmailRevision) { gmail = model.gmailState(value); render(); } }).catch(() => {});
  }
  window.CraftUnread = { decorate, unread, description };
  render();
})();
