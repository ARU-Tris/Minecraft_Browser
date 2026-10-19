(() => {
  'use strict';
  const bridge = window.craftsideBrowser; if (!bridge) return;
  const $ = selector => document.querySelector(selector), $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const t = (source, values) => window.CraftI18n.t(source, values), HOME = 'craftside://inventory';
  document.documentElement.classList.add('native'); document.title = 'MINECRAFT?';
  const titlebar = document.createElement('header'); titlebar.className = 'native-titlebar'; titlebar.innerHTML = '<img src="../assets/craftside-mark.svg" alt=""><span>MINECRAFT?</span>'; document.body.prepend(titlebar);
  const shell = $('#browser-shell'), viewport = $('#web-viewport'), template = $('#site-home').cloneNode(true), pages = new Map();
  $$('.site', viewport).forEach(page => page.remove());
  let state, layout = 'pinned', dragging = null, frame = 0, toastTimer, returnSettings = false, theme = 'stone', lastLayout = '',lastState='';
  try { const saved = JSON.parse(localStorage.getItem('craftside:native-ui:v1')); if (['stone','deepslate'].includes(saved?.theme)) theme = saved.theme; } catch { /* Keep default UI. */ }
  shell.dataset.theme = theme; $('#settings-theme').value = theme;
  const dialogs = $$('dialog');
  const svg = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = t(message); $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500); }
  async function command(action, data) {
    try { const result = await bridge.command(action, data); if (result?.tabs) receive(result); }
    catch (error) { toast(error.message); }
  }
  function setLayout(next) {
    if (!['pinned','peek','closed'].includes(next)) return;
    layout = next; shell.dataset.layout = next; $('#sidebar').inert = next === 'closed'; $('#sidebar').setAttribute('aria-hidden', String(next === 'closed'));
    $('#pin-sidebar').setAttribute('aria-pressed', String(next === 'pinned')); $('#edge-handle').setAttribute('aria-expanded', String(next !== 'closed'));
    syncBounds();
  }
  function open(dialog) { dialogs.forEach(item => { if (item !== dialog && item.open) item.close(); }); if (!dialog.open) dialog.showModal(); syncBounds(); window.CraftPlayer?.refresh(); }
  function address() { if (!state) return; const tab = state.tabs.find(tab => tab.id === state.panes[state.focus]); open($('#address-dialog')); $('#command-input').value = tab?.url === HOME ? '' : tab?.url || ''; $('#command-input').focus(); $('#command-input').select(); }
  function navigate(url) { dialogs.forEach(dialog => { if (dialog.open) dialog.close(); }); closeShield(); command('navigate', { url }); }
  function closeShield() { $('#shield-popover').hidden = true; $('#shield-button').setAttribute('aria-expanded','false'); syncBounds(); }
  function shield() { $('#shield-popover').hidden = !$('#shield-popover').hidden; $('#shield-button').setAttribute('aria-expanded', String(!$('#shield-popover').hidden)); syncBounds(); }
  for (const side of ['left','right']) {
    const pane = document.createElement('section'); pane.className = 'browser-pane'; pane.id = 'pane-' + side; pane.dataset.pane = side;
    pane.innerHTML = `<header class="pane-caption" draggable="true"><button data-focus-pane="${side}" class="pane-title"></button><button class="pane-only" data-only-pane="${side}" title="Show only this pane">${svg('close')}</button></header><div class="pane-body"></div>`; viewport.append(pane);
  }
  $('#pane-left').insertAdjacentHTML('afterend','<div class="pane-divider" id="pane-divider" role="separator" tabindex="0" aria-label="Resize pages" aria-orientation="vertical" aria-valuemin="28" aria-valuemax="72" aria-valuenow="50"><span></span></div>');
  function title(tab) { return tab.url === HOME ? t('My inventory') : tab.title || tab.url; }
  function tabButton(action, id, icon, label) { const button = document.createElement('button'); button.dataset[action] = id; button.className = action === 'selectTab' ? 'tab-select' : action === 'splitTab' ? 'tab-split' : 'tab-close'; button.innerHTML = svg(icon); button.title = label; button.setAttribute('aria-label',label); return button; }
  function home(tab) {
    if (!pages.has(tab.id)) {
      const page = template.cloneNode(true); page.id = 'site-tab-' + tab.id + '-home'; page.hidden = false; page.dataset.scene = 'home'; page.dataset.tabId = tab.id;
      $$('[id]',page).forEach(node => { node.dataset.role = node.id; node.removeAttribute('id'); });
      window.CraftI18n.apply(page); pages.set(tab.id,page);
    }
    return pages.get(tab.id);
  }
  function downloads() {
    const content = $('#storage-content'); content.replaceChildren();
    const folder = document.createElement('button'); folder.className = 'minecraft-button'; folder.textContent = t('Open downloads folder'); folder.onclick = () => command('downloadFolder'); content.append(folder);
    if (!state.downloads.length) { const empty = document.createElement('p'); empty.className = 'storage-empty'; empty.textContent = t('No downloads yet.'); content.append(empty); }
    for (const item of state.downloads) {
      const row = document.createElement('div'); row.className = 'download-row'; const text = document.createElement('div'), name = document.createElement('strong'), info = document.createElement('small');
      name.textContent = item.name; info.textContent = t(item.state) + (item.total ? ` · ${Math.round(item.received/item.total*100)}%` : ''); text.append(name,info); row.append(text);
      if (item.state === 'completed') { const show = document.createElement('button'); show.textContent = t('Show in folder'); show.onclick = () => command('downloadShow',{id:item.id}); row.append(show); } content.append(row);
    }
  }
  function receive(next,force=false) {
    const signature=JSON.stringify(next);if(!force&&signature===lastState)return;lastState=signature;let refreshPlayer=false;
    state = next; const split = Boolean(state.panes.right), activeId = state.panes[state.focus], active = state.tabs.find(tab => tab.id === activeId);
    viewport.dataset.split = String(split); viewport.dataset.focus = state.focus; viewport.style.setProperty('--split-ratio', state.ratio + '%');
    $('#pane-right').hidden = !split; $('#pane-divider').hidden = !split; $('#pane-divider').setAttribute('aria-valuenow',state.ratio);
    $('#split-toggle').setAttribute('aria-pressed',String(split)); $('#pane-status').textContent = split ? t('{side} selected',{side:t(state.focus === 'left' ? 'Left' : 'Right')}) : t('Single page');
    $('#tab-count').textContent = state.tabs.length; $('#current-address').textContent = active?.url || HOME;
    $('#back-button').disabled = !active?.back; $('#forward-button').disabled = !active?.forward;
    const list = $('#tab-list'); list.replaceChildren();
    for (const tab of state.tabs) {
      const row = document.createElement('div'); row.className = 'tab-item' + (tab.id === activeId ? ' active' : '') + (tab.loading ? ' is-loading' : ''); row.draggable = true; row.dataset.tabId = tab.id;
      const select = tabButton('selectTab',tab.id,'globe',title(tab)), text = document.createElement('span'); text.textContent = title(tab); text.dataset.userContent = ''; select.append(text); if (tab.id === activeId) select.setAttribute('aria-current','page');
      if (split && [state.panes.left,state.panes.right].includes(tab.id)) { const marker = document.createElement('small'); marker.className = 'pane-tab-marker'; marker.textContent = state.panes.left === tab.id ? 'L' : 'R'; select.append(marker); }
      row.append(select,tabButton('splitTab',tab.id,'split',t('Open beside')),tabButton('closeTab',tab.id,'close',t('Close tab'))); list.append(row);
    }
    for (const side of ['left','right']) {
      const tab = state.tabs.find(tab => tab.id === state.panes[side]), pane = $('#pane-' + side), body = pane.querySelector('.pane-body'); pane.dataset.active = String(state.focus === side);
      pane.querySelector('.pane-title').textContent = tab ? t(side === 'left' ? 'Left' : 'Right') + ' · ' + title(tab) : '';
      if (!tab) { body.replaceChildren(); continue; }
      if (tab.url === HOME) { const page = home(tab); if (body.firstElementChild !== page) { window.CraftInventory.mount(page); window.CraftI18n.apply(page); body.replaceChildren(page);refreshPlayer=true; } }
      else if (body.dataset.tabId !== String(tab.id) || body.dataset.error !== tab.error || body.querySelector('.site')) {
        const placeholder = document.createElement('div'); placeholder.className = 'native-placeholder'; const message = document.createElement('p'), url = document.createElement('small');
        message.textContent = tab.error ? t('Could not open this page.') : ''; url.textContent = tab.error ? tab.error : ''; placeholder.append(message,url);
        if (tab.error) { const reload = document.createElement('button'); reload.className = 'minecraft-button'; reload.textContent = t('Reload'); reload.onclick = () => command('reload'); placeholder.append(reload); } body.replaceChildren(placeholder);
      }
      body.dataset.tabId = tab.id; body.dataset.error = tab.error;
    }
    for (const [id] of pages) if (!state.tabs.some(tab => tab.id === id)) pages.delete(id);
    $('#shield-summary').textContent = t(state.blocking ? 'Ad and tracker filters enabled' : 'Ads allowed'); $('.on-light').textContent = state.blocking ? 'ON' : 'OFF';
    $$('[data-ad]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.ad === state.adMode)));
    if ($('#storage-dialog').open && $('#storage-dialog').dataset.panel === 'downloads') downloads();
    syncBounds(); if(refreshPlayer)window.CraftPlayer?.refresh();
  }
  function syncBounds() {
    if (frame) return; frame = requestAnimationFrame(() => {
      frame = 0; const overlay = dialogs.some(dialog => dialog.open) || !$('#shield-popover').hidden || layout === 'peek' || dragging !== null;
      const data = { overlay };
      for (const side of ['left','right']) { const rect = $('#pane-' + side + ' .pane-body').getBoundingClientRect(); data[side] = { x:rect.x,y:rect.y,width:rect.width,height:rect.height }; }
      const signature = JSON.stringify(data); if (signature !== lastLayout) { lastLayout = signature; bridge.layout(data); }
      if (!overlay) $$('.native-snapshot').forEach(image => image.remove());
    });
  }
  bridge.onPreview(({id,image}) => {
    for (const side of ['left','right']) if (state?.panes[side] === id) { const body = $('#pane-' + side + ' .pane-body'); if (body.querySelector('.site')) continue; let img = body.querySelector('.native-snapshot'); if (!img) { img = document.createElement('img'); img.className = 'native-snapshot'; img.alt = ''; body.append(img); } img.src = image; }
  });
  bridge.onState(receive); bridge.onShortcut(key => { if (key === 'l') address(); if (key === 'b') setLayout(layout === 'closed' ? 'pinned' : 'closed'); if (key === 'resize') syncBounds(); });
  bridge.onToastAction(action => {
    const toast = $('#news-toast');
    if (action === 'open') $('#news-toast-link').click();
    if (action === 'close' || action === 'open') $('#dismiss-news').click();
    if (action === 'enter' || action === 'leave') toast.dispatchEvent(new PointerEvent(action === 'enter' ? 'pointerenter' : 'pointerleave'));
  });
  document.addEventListener('craftside:advancement', event => {
    if (event.detail.hide) { bridge.command('advancement',{hide:true}); return; }
    bridge.command('advancement',{title:$('#news-toast-title').textContent,heading:$('#news-toast-heading').textContent,background:getComputedStyle($('#news-toast')).backgroundImage,icon:$('#news-toast-link img').src});
  });
  document.addEventListener('click', event => {
    const target = event.target;
    const select = target.closest('[data-select-tab]'); if (select) command('select',{id:Number(select.dataset.selectTab)});
    const close = target.closest('[data-close-tab]'); if (close) command('close',{id:Number(close.dataset.closeTab)});
    const split = target.closest('[data-split-tab]'); if (split) command('split',{id:Number(split.dataset.splitTab),side:state.focus === 'left' ? 'right' : 'left'});
    const only = target.closest('[data-only-pane]'); if (only) command('only',{side:only.dataset.onlyPane});
    const focus = target.closest('[data-focus-pane]'); if (focus) command('focus',{side:focus.dataset.focusPane});
    const action = target.closest('[data-action]')?.dataset.action;
    if (action === 'address') address(); if (action === 'settings') open($('#settings-dialog')); if (action === 'split') command('toggleSplit'); if (action === 'shield') shield();
    const panel = target.closest('button[data-panel]'); if (panel) { const name = panel.dataset.panel; $('#storage-dialog').dataset.panel = name; $('#storage-title').textContent = t(name === 'downloads' ? 'Downloads' : 'Bookmarks'); if (name === 'downloads') downloads(); else window.CraftInventory.renderLibrary($('#storage-content')); open($('#storage-dialog')); }
    if (target.closest('[data-close-popover]')) closeShield();
    const ad = target.closest('[data-ad]'); if (ad && ad.dataset.ad !== 'replace') { command('ad',{mode:ad.dataset.ad}); toast('Reload open pages to apply this change.'); }
    if (target.closest('button.command-choice[data-scene="home"]')) navigate(HOME);
  });
  document.addEventListener('submit', event => { if (event.target.matches('[data-role=home-search]')) { event.preventDefault(); navigate(event.target.querySelector('input').value); } });
  $('#address-form').addEventListener('submit', event => { event.preventDefault(); navigate($('#command-input').value); });
  $('#open-address').onclick = address; $('#address-slot').onclick = address; $('#new-tab').onclick = () => command('new'); $('#split-toggle').onclick = () => command('toggleSplit');
  $('#collapse-sidebar').onclick = () => setLayout('closed'); $('#edge-handle').onclick = () => setLayout('peek'); $('#sidebar-scrim').onclick = () => setLayout('closed'); $('#pin-sidebar').onclick = () => setLayout(layout === 'pinned' ? 'peek' : 'pinned');
  for (const action of ['back','forward','reload']) $('#' + action + '-button').onclick = () => command(action);
  $('#shield-button').onclick = shield; $('#settings-button').onclick = () => open($('#settings-dialog'));
  for (const name of ['address','storage','skin','settings']) $('#close-' + name).onclick = () => $('#' + name + '-dialog').close();
  $('#settings-skin').onclick = () => { returnSettings = true; open($('#skin-dialog')); };
  $('#skin-dialog').addEventListener('close', () => { if (returnSettings) { returnSettings = false; if (!dialogs.some(dialog => dialog.open)) open($('#settings-dialog')); } });
  $('#settings-theme').onchange = event => { theme = event.target.value; shell.dataset.theme = theme; try { localStorage.setItem('craftside:native-ui:v1',JSON.stringify({theme})); } catch { toast('Could not save the theme.'); } };
  document.addEventListener('craftside:open-bookmark', event => { if (/^https?:\/\//i.test(event.detail.url)) navigate(event.detail.url); });
  document.addEventListener('pointerdown', event => { const side = event.target.closest('.browser-pane')?.dataset.pane; if (side && state?.focus !== side) command('focus',{side}); });
  dialogs.forEach(dialog => { dialog.addEventListener('close',syncBounds); });
  new MutationObserver(syncBounds).observe(shell,{subtree:true,attributes:true,attributeFilter:['open','hidden','data-layout']});
  new ResizeObserver(syncBounds).observe(viewport);
  document.addEventListener('craftside:language-changed', () => { bridge.command('language',{language:window.CraftI18n.language}); if (state) receive(state,true); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { if (!$('#shield-popover').hidden) closeShield(); else if (layout === 'peek') setLayout('closed'); } });
  document.addEventListener('dragstart', event => {
    const row = event.target.closest('.tab-item'), caption = event.target.closest('.pane-caption'); if (!row && !caption) return;
    dragging = row ? Number(row.dataset.tabId) : state.panes[caption.closest('.browser-pane').dataset.pane]; event.dataTransfer.setData('application/x-craftside-tab',String(dragging)); event.dataTransfer.effectAllowed = 'move'; $('#split-drop-overlay').hidden = false; syncBounds();
  });
  const endDrag = () => { dragging = null; $('#split-drop-overlay').hidden = true; syncBounds(); };
  shell.addEventListener('dragover', event => { if (!dragging) return; event.preventDefault(); const rect = viewport.getBoundingClientRect(), side = event.clientX < rect.x+rect.width/2 ? 'left' : 'right'; $$('[data-drop-side]').forEach(zone => zone.classList.toggle('drop-active',zone.dataset.dropSide === side)); });
  shell.addEventListener('drop', event => { if (!dragging) return; event.preventDefault(); const rect = viewport.getBoundingClientRect(), id = dragging; endDrag(); if (event.clientX >= rect.x && event.clientY >= rect.y) command('split',{id,side:event.clientX < rect.x+rect.width/2 ? 'left' : 'right'}); });
  document.addEventListener('dragend',endDrag);
  const divider = $('#pane-divider');
  function ratio(value) { command('ratio',{value}); }
  function dragDivider(event) { const rect = viewport.getBoundingClientRect(); ratio((event.clientX-rect.x)/rect.width*100); }
  divider.addEventListener('pointerdown', event => { event.preventDefault(); divider.setPointerCapture(event.pointerId); dragDivider(event); });
  divider.addEventListener('pointermove', event => { if (divider.hasPointerCapture(event.pointerId)) dragDivider(event); });
  divider.addEventListener('pointerup', event => { if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId); });
  divider.addEventListener('dblclick', () => ratio(50));
  divider.addEventListener('keydown', event => { const values = {ArrowLeft:state.ratio-5,ArrowRight:state.ratio+5,Home:28,End:72}; if (event.key in values) { event.preventDefault(); ratio(values[event.key]); } });
  for (const button of $$('[data-ad]')) {
    if (button.dataset.ad === 'collapse') button.querySelector('span').textContent = t('Block ads and trackers');
    if (button.dataset.ad === 'original') button.querySelector('span').textContent = t('Allow ads');
  }
  $('#shield-popover > p').textContent = t('Reload open pages after changing this setting.');
  $('#reload-button').title = t('Reload'); shell.setAttribute('aria-label','MINECRAFT?');
  bridge.command('language',{language:window.CraftI18n.language}); command('state'); setLayout('pinned');
})();
