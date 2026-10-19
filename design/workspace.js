(() => {
  'use strict';
  if (window.craftsideBrowser) return;
  const $ = selector => document.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const t = (source, values) => window.CraftI18n.t(source, values);
  const shell = $('#browser-shell'), viewport = $('#web-viewport');
  const dialogs = [$('#address-dialog'), $('#storage-dialog'), $('#skin-dialog'), $('#settings-dialog'), $('#resource-packs-dialog'), $('#bookmark-dialog'), $('#icon-dialog')];
  const scenes = {
    home: { title: '내 인벤토리', address: 'craftside://inventory', icon: 'globe' },
    notes: { title: '브라우저 아이디어', address: 'notes.example/workspace', icon: 'note' },
    reading: { title: '읽는 시간', address: 'fieldnotes.example/essay', icon: 'book' }
  };
  const templates = {};
  const sceneTitle = scene => t(scenes[scene].title);
  $$('.site', viewport).forEach(site => { templates[site.id.replace('site-', '')] = site.cloneNode(true); site.remove(); });
  const state = { layout: 'pinned', theme: 'stone', ad: 'collapse', tabs: [], nextTab: 1, panes: { left: null, right: null }, focus: 'left', ratio: 50, artUrl: null };
  let toastTimer, draggingTab = null, returnToSettings = false;
  const isSplit = () => state.panes.right !== null;
  const tabById = id => state.tabs.find(tab => tab.id === Number(id));
  const activeTab = () => tabById(state.panes[state.focus]);
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const item = name => `<svg aria-hidden="true"><use href="#item-${name}"/></svg>`;
  viewport.insertAdjacentHTML('beforeend', ['left', 'right'].map(side => `<section class="browser-pane" id="pane-${side}" data-pane="${side}" aria-label="${side === 'left' ? '왼쪽' : '오른쪽'} 페이지"><header class="pane-caption" draggable="true"><button data-focus-pane="${side}" class="pane-title"></button><button class="pane-only" data-only-pane="${side}" title="이 화면만 보기" aria-label="${side === 'left' ? '왼쪽' : '오른쪽'} 화면만 보기">${icon('close')}</button></header><div class="pane-body"></div></section>`).join(''));
  $('#pane-left').insertAdjacentHTML('afterend', '<div class="pane-divider" id="pane-divider" role="separator" tabindex="0" aria-label="두 페이지 너비 조절" aria-orientation="vertical" aria-valuemin="28" aria-valuemax="72" aria-valuenow="50"><span></span></div>');
  function toast(message) {
    clearTimeout(toastTimer); $('#toast').textContent = t(message); $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3300);
  }
  function closePopovers() { $('#shield-popover').hidden = true; $('#shield-button').setAttribute('aria-expanded', 'false'); }
  function setLayout(layout, focus = false) {
    if (!['pinned', 'peek', 'closed'].includes(layout)) return;
    const sidebar = $('#sidebar'), previousFocus = sidebar.contains(document.activeElement);
    state.layout = layout; shell.dataset.layout = layout; sidebar.inert = layout === 'closed';
    sidebar.setAttribute('aria-hidden', String(layout === 'closed'));
    $$('.review-controls [data-layout]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.layout === layout)));
    $('#pin-sidebar').setAttribute('aria-pressed', String(layout === 'pinned'));
    $('#pin-sidebar').setAttribute('aria-label', layout === 'pinned' ? '사이드바 고정 해제' : '사이드바 고정');
    $('#edge-handle').setAttribute('aria-expanded', String(layout !== 'closed'));
    $('#layout-readout').textContent = { pinned: '공통 사이드바 하나 · 두 페이지도 함께 관리', peek: '잠깐 열기 · 두 페이지 너비 유지', closed: '사이드바 접기 · 두 페이지 모두 넓게' }[layout];
    closePopovers();
    if (layout === 'closed' && previousFocus) $('#edge-handle').focus({ preventScroll: true });
    else if (focus && layout !== 'closed') $('#collapse-sidebar').focus({ preventScroll: true });
  }
  function fillInventory(root) {
    window.CraftInventory.mount(root);
  }
  function newTab(scene = 'home') {
    const tab = { id: state.nextTab++, scene, history: [scene], historyIndex: 0, pages: new Map() };
    state.tabs.push(tab); return tab;
  }
  function pageFor(tab) {
    if (!tab.pages.has(tab.scene)) {
      const page = templates[tab.scene].cloneNode(true);
      page.id = `site-tab-${tab.id}-${tab.scene}`; page.dataset.scene = tab.scene; page.dataset.tabId = String(tab.id); page.hidden = false;
      $$('[id]', page).forEach(element => { element.dataset.role = element.id; element.removeAttribute('id'); });
      if (tab.scene === 'home') fillInventory(page);
      tab.pages.set(tab.scene, page);
    }
    const page = tab.pages.get(tab.scene); page.dataset.adMode = state.ad;
    if (tab.scene === 'home') fillInventory(page);
    const image = page.querySelector('[data-role="replacement-image"]');
    if (image && image.dataset.selectedArt !== (state.artUrl || '')) { image.src = state.artUrl || '../assets/pixel-landscape.svg'; image.dataset.selectedArt = state.artUrl || ''; }
    window.CraftI18n.apply(page); return page;
  }
  function syncChrome() {
    const active = activeTab(); if (!active) return;
    viewport.dataset.focus = state.focus;
    $('#current-address').textContent = scenes[active.scene].address; $('#scene-select').value = active.scene;
    $('#back-button').disabled = active.historyIndex === 0; $('#forward-button').disabled = active.historyIndex === active.history.length - 1;
    $('#tab-count').textContent = String(state.tabs.length);
    $('#pane-status').textContent = isSplit() ? t('{side} selected', { side: t(state.focus === 'left' ? 'Left' : 'Right') }) : t('Single page');
    $('#split-toggle').setAttribute('aria-pressed', String(isSplit()));
    $('#preview-dual').innerHTML = icon('split') + (isSplit() ? '한 화면으로' : '듀얼 뷰 보기');
    $('#tab-list').innerHTML = state.tabs.map(tab => {
      const side = state.panes.left === tab.id ? 'L' : state.panes.right === tab.id ? 'R' : '';
      const title = sceneTitle(tab.scene);
      return `<div class="tab-item${tab.id === active.id ? ' active' : ''}" data-tab-id="${tab.id}" draggable="true" title="${t('Drag to open two pages side by side')}"><button class="tab-select" data-select-tab="${tab.id}" ${tab.id === active.id ? 'aria-current="page"' : ''}>${icon(scenes[tab.scene].icon)}<span>${title}</span>${isSplit() && side ? `<small class="pane-tab-marker">${side}</small>` : ''}</button><button class="tab-split" data-split-tab="${tab.id}" aria-label="${t('Open {title} beside this page', { title })}" title="${t('Open beside')}">${icon('split')}</button><button class="tab-close" data-close-tab="${tab.id}" aria-label="${t('Close {title} tab', { title })}">${icon('close')}</button></div>`;
    }).join('');
    ['left', 'right'].forEach(side => {
      const tab = tabById(state.panes[side]), pane = $(`#pane-${side}`);
      pane.dataset.active = String(state.focus === side);
      pane.querySelector('.pane-title').textContent = tab ? `${t(side === 'left' ? 'Left' : 'Right')} · ${sceneTitle(tab.scene)}` : '';
    });
  }
  function renderViews() {
    viewport.dataset.split = String(isSplit()); $('#pane-right').hidden = !isSplit(); $('#pane-divider').hidden = !isSplit();
    ['left', 'right'].forEach(side => {
      const body = $(`#pane-${side} .pane-body`), tab = tabById(state.panes[side]);
      if (!tab) { body.replaceChildren(); return; }
      const page = pageFor(tab);
      if (body.firstElementChild !== page) {
        const previous = body.firstElementChild; if (previous) previous.dataset.savedScroll = String(previous.scrollTop);
        body.replaceChildren(page); page.scrollTop = Number(page.dataset.savedScroll || 0);
      }
    });
    syncChrome(); window.CraftPlayer?.refresh();
  }
  function focusPane(side) { if (state.panes[side] && state.focus !== side) { state.focus = side; syncChrome(); } }
  function selectTab(id) {
    const tab = tabById(id); if (!tab) return;
    if (state.panes.left === tab.id) state.focus = 'left'; else if (state.panes.right === tab.id) state.focus = 'right'; else state.panes[state.focus] = tab.id;
    renderViews();
  }
  function navigate(scene, addHistory = true) {
    if (!scenes[scene]) return;
    const tab = activeTab(); tab.scene = scene;
    if (addHistory && tab.history[tab.historyIndex] !== scene) { tab.history = tab.history.slice(0, tab.historyIndex + 1); tab.history.push(scene); tab.historyIndex = tab.history.length - 1; }
    renderViews();
  }
  function selectScene(scene) {
    if (!scenes[scene]) return;
    const existing = state.tabs.find(tab => tab.scene === scene); if (existing) selectTab(existing.id); else navigate(scene);
    dialogs.forEach(dialog => { if (dialog.open) dialog.close(); });
  }
  function splitTab(id, side = 'right') {
    const tab = tabById(id); if (!tab) return;
    const otherSide = side === 'right' ? 'left' : 'right', previous = state.panes[otherSide];
    if (previous === tab.id) state.panes[otherSide] = (tabById(state.panes[side]) || state.tabs.find(item => item.id !== tab.id) || newTab()).id;
    else if (!previous) state.panes[otherSide] = (state.tabs.find(item => item.id !== tab.id) || newTab()).id;
    state.panes[side] = tab.id; state.focus = side; renderViews();
  }
  function onlyPane(side = 'left') {
    const tab = tabById(state.panes[side]); if (!tab) return;
    state.panes = { left: tab.id, right: null }; state.focus = 'left'; renderViews();
  }
  function toggleSplit() { if (isSplit()) onlyPane(); else splitTab((state.tabs.find(tab => tab.id !== activeTab().id) || newTab()).id); }
  function closeTab(id) {
    const tab = tabById(id); if (!tab) return;
    const side = state.panes.left === tab.id ? 'left' : state.panes.right === tab.id ? 'right' : null;
    state.tabs.splice(state.tabs.indexOf(tab), 1);
    if (!state.tabs.length) state.panes = { left: newTab().id, right: null };
    else if (side && isSplit()) state.panes = { left: state.panes[side === 'left' ? 'right' : 'left'], right: null };
    else if (side) state.panes.left = state.tabs[0].id;
    if (!state.panes.right) state.focus = 'left'; renderViews();
  }
  function setRatio(value) { state.ratio = Math.max(28, Math.min(72, Math.round(value))); viewport.style.setProperty('--split-ratio', `${state.ratio}%`); $('#pane-divider').setAttribute('aria-valuenow', String(state.ratio)); }
  function setAd(mode, showReading = false) {
    if (!['collapse', 'replace', 'original'].includes(mode)) return;
    state.ad = mode; $$('[data-ad]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ad === mode)));
    $('#shield-summary').textContent = { collapse: '광고 자리 접기', replace: '내 그림으로 바꾸기', original: '원본 비교 중' }[mode];
    $('.on-light').textContent = mode === 'original' ? 'DEMO' : 'ON';
    if (showReading && activeTab().scene !== 'reading') selectScene('reading'); renderViews();
  }
  function openDialog(dialog) { dialogs.forEach(item => { if (item !== dialog && item.open) item.close(); }); if (!dialog.open) dialog.showModal(); window.CraftPlayer?.refresh(); }
  function openAddress() { openDialog($('#address-dialog')); $('#command-input').value = activeTab().scene === 'home' ? '' : scenes[activeTab().scene].address; $('#command-input').focus(); $('#command-input').select(); }
  function submitAddress(value) {
    const query = value.trim().toLowerCase();
    if (!query || /newtab|home|inventory|새.?탭/.test(query)) navigate('home');
    else if (/fieldnotes|reading|글|읽기|광고/.test(query)) navigate('reading');
    else if (/note|작업|문서/.test(query)) navigate('notes');
    else toast('화면 설계 시안입니다. 실제 검색·웹 탐색은 구현 단계에서 연결합니다.');
    $('#address-dialog').close();
  }
  function showStorage(panel) {
    $('#storage-dialog').dataset.panel = panel;
    $('#storage-title').textContent = panel === 'downloads' ? '다운로드' : '즐겨찾기';
    if (panel === 'bookmarks') window.CraftInventory.renderLibrary($('#storage-content'));
    else $('#storage-content').innerHTML = '<p class="storage-empty">아직 내려받은 파일이 없습니다.<br>이 시안에서는 실제 다운로드를 시작하지 않습니다.</p>';
    openDialog($('#storage-dialog'));
  }
  function showShield() { $('#shield-popover').hidden = !$('#shield-popover').hidden; $('#shield-button').setAttribute('aria-expanded', String(!$('#shield-popover').hidden)); }
  document.addEventListener('pointerdown', event => { const pane = event.target.closest('.browser-pane'); if (pane) focusPane(pane.dataset.pane); });
  document.addEventListener('focusin', event => { const pane = event.target.closest('.browser-pane'); if (pane) focusPane(pane.dataset.pane); });
  document.addEventListener('click', event => {
    const layout = event.target.closest('.review-controls [data-layout]'); if (layout) setLayout(layout.dataset.layout);
    const scene = event.target.closest('[data-scene]'); if (scene && scene.tagName === 'BUTTON') selectScene(scene.dataset.scene);
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'settings') openDialog($('#settings-dialog')); if (action === 'address') openAddress(); if (action === 'split') toggleSplit(); if (action === 'shield') showShield();
    const ad = event.target.closest('[data-ad]'); if (ad) setAd(ad.dataset.ad, true);
    const tab = event.target.closest('[data-select-tab]'); if (tab) selectTab(tab.dataset.selectTab);
    const split = event.target.closest('[data-split-tab]'); if (split) splitTab(split.dataset.splitTab, state.focus === 'left' ? 'right' : 'left');
    const close = event.target.closest('[data-close-tab]'); if (close) closeTab(close.dataset.closeTab);
    const panel = event.target.closest('button[data-panel]'); if (panel) showStorage(panel.dataset.panel);
    const only = event.target.closest('[data-only-pane]'); if (only) onlyPane(only.dataset.onlyPane);
    const focus = event.target.closest('[data-focus-pane]'); if (focus) focusPane(focus.dataset.focusPane);
    if (event.target.closest('[data-close-popover]')) closePopovers();
  });
  document.addEventListener('submit', event => { if (event.target.matches('[data-role="home-search"]')) { event.preventDefault(); submitAddress(event.target.querySelector('input').value); } });
  $('#collapse-sidebar').addEventListener('click', () => setLayout('closed'));
  $('#edge-handle').addEventListener('click', () => setLayout('peek', true)); $('#sidebar-scrim').addEventListener('click', () => setLayout('closed'));
  $('#pin-sidebar').addEventListener('click', () => setLayout(state.layout === 'pinned' ? 'peek' : 'pinned'));
  $('#scene-select').addEventListener('change', event => selectScene(event.target.value));
  $('#theme-select').addEventListener('change', event => { state.theme = event.target.value; shell.dataset.theme = state.theme; $('#settings-theme').value = state.theme; });
  $('#new-tab').addEventListener('click', () => { selectTab(newTab().id); if (state.layout === 'closed') setLayout('peek'); });
  $('#split-toggle').addEventListener('click', toggleSplit);
  $('#preview-dual').addEventListener('click', () => {
    if (isSplit()) { onlyPane(); return; }
    const notes = state.tabs.find(tab => tab.scene === 'notes') || newTab('notes'), reading = state.tabs.find(tab => tab.scene === 'reading') || newTab('reading');
    state.panes = { left: notes.id, right: reading.id }; state.focus = 'left'; setRatio(50); renderViews();
  });
  $('#open-address').addEventListener('click', openAddress); $('#address-slot').addEventListener('click', openAddress);
  $('#close-address').addEventListener('click', () => $('#address-dialog').close());
  $('#address-form').addEventListener('submit', event => { event.preventDefault(); submitAddress($('#command-input').value); });
  $('#close-storage').addEventListener('click', () => $('#storage-dialog').close()); $('#close-skin').addEventListener('click', () => $('#skin-dialog').close());
  $('#reload-button').addEventListener('click', () => { pageFor(activeTab()).scrollTop = 0; toast('선택한 화면의 처음으로 돌아왔습니다.'); });
  $('#back-button').addEventListener('click', () => { const tab = activeTab(); if (tab.historyIndex > 0) navigate(tab.history[--tab.historyIndex], false); });
  $('#forward-button').addEventListener('click', () => { const tab = activeTab(); if (tab.historyIndex < tab.history.length - 1) navigate(tab.history[++tab.historyIndex], false); });
  $('#shield-button').addEventListener('click', showShield);
  $('#settings-button').addEventListener('click', () => openDialog($('#settings-dialog')));
  $('#close-settings').addEventListener('click', () => $('#settings-dialog').close());
  $('#settings-skin').addEventListener('click', () => { returnToSettings = true; openDialog($('#skin-dialog')); });
  $('#skin-dialog').addEventListener('close', () => { if (returnToSettings) { returnToSettings = false; if (!dialogs.some(dialog => dialog.open)) openDialog($('#settings-dialog')); } });
  $('#settings-theme').addEventListener('change', event => { $('#theme-select').value = event.target.value; $('#theme-select').dispatchEvent(new Event('change')); });
  document.addEventListener('craftside:language-changed', () => {
    Object.values(templates).forEach(page => window.CraftI18n.apply(page));
    syncChrome();
  });
  document.addEventListener('craftside:open-bookmark', event => {
    const url = event.detail.url;
    if (url === 'craftside://notes') selectScene('notes');
    else if (url === 'craftside://reading') selectScene('reading');
    else if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
  });
  $('#art-input').addEventListener('change', event => {
    const file = event.target.files[0]; if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { toast('PNG, JPEG, WebP, GIF 이미지를 골라주세요.'); return; }
    if (state.artUrl) URL.revokeObjectURL(state.artUrl); state.artUrl = URL.createObjectURL(file); setAd('replace', true); toast('이미지는 미리보기 안에서만 표시합니다. 서버로 보내지 않습니다.');
  });
  document.addEventListener('dragstart', event => {
    const tab = event.target.closest('.tab-item'), caption = event.target.closest('.pane-caption'); if (!tab && !caption) return;
    draggingTab = tab ? Number(tab.dataset.tabId) : state.panes[caption.closest('.browser-pane').dataset.pane];
    event.dataTransfer.setData('application/x-craftside-tab', String(draggingTab)); event.dataTransfer.effectAllowed = 'move';
    $('#split-drop-overlay').hidden = false; shell.classList.add('dragging-tab');
  });
  shell.addEventListener('dragover', event => {
    if (!draggingTab) return;
    const bounds = viewport.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move';
    const side = event.clientX < bounds.left + bounds.width / 2 ? 'left' : 'right';
    $$('#split-drop-overlay [data-drop-side]').forEach(zone => zone.classList.toggle('drop-active', zone.dataset.dropSide === side));
  });
  const endDrag = () => { draggingTab = null; $('#split-drop-overlay').hidden = true; shell.classList.remove('dragging-tab'); };
  shell.addEventListener('drop', event => {
    if (!draggingTab) return; event.preventDefault();
    const bounds = viewport.getBoundingClientRect(), id = draggingTab; endDrag();
    if (event.clientX >= bounds.left && event.clientY >= bounds.top && event.clientY <= bounds.bottom) splitTab(id, event.clientX < bounds.left + bounds.width / 2 ? 'left' : 'right');
  });
  document.addEventListener('dragend', endDrag);
  const divider = $('#pane-divider');
  function dragDivider(event) { const bounds = viewport.getBoundingClientRect(); setRatio((event.clientX - bounds.left) / bounds.width * 100); }
  divider.addEventListener('pointerdown', event => { event.preventDefault(); divider.setPointerCapture(event.pointerId); divider.classList.add('is-dragging'); dragDivider(event); });
  divider.addEventListener('pointermove', event => { if (divider.hasPointerCapture(event.pointerId)) dragDivider(event); });
  divider.addEventListener('pointerup', event => { if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId); divider.classList.remove('is-dragging'); });
  divider.addEventListener('pointercancel', () => divider.classList.remove('is-dragging')); divider.addEventListener('dblclick', () => setRatio(50));
  divider.addEventListener('keydown', event => { const values = { ArrowLeft: state.ratio - 5, ArrowRight: state.ratio + 5, Home: 28, End: 72 }; if (event.key in values) { event.preventDefault(); setRatio(values[event.key]); } });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { endDrag(); if (dialogs.some(dialog => dialog.open)) return; if (!$('#shield-popover').hidden) closePopovers(); else if (state.layout === 'peek') setLayout('closed'); }
    const isTextEntry = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
    if (!(event.ctrlKey || event.metaKey) || event.altKey || dialogs.some(dialog => dialog.open)) return;
    if (event.key.toLowerCase() === 'b' && !isTextEntry) { event.preventDefault(); setLayout(state.layout === 'closed' ? 'pinned' : 'closed', true); }
    if (event.key.toLowerCase() === 'l') { event.preventDefault(); openAddress(); }
  });
  window.addEventListener('pagehide', () => { if (state.artUrl) URL.revokeObjectURL(state.artUrl); });
  newTab('home'); newTab('notes'); newTab('reading'); state.panes.left = state.tabs[0].id;
  setRatio(50); renderViews(); setLayout('pinned'); setAd('collapse');
})();
