(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const shell = $('#browser-shell');
  const sidebar = $('#sidebar');
  const addressDialog = $('#address-dialog');
  const storageDialog = $('#storage-dialog');
  const scenes = {
    home: { title: '새로운 월드', address: 'craftside://newtab', icon: 'globe' },
    notes: { title: '브라우저 아이디어', address: 'notes.example/workspace', icon: 'note' },
    reading: { title: '읽는 시간', address: 'fieldnotes.example/essay', icon: 'book' }
  };
  const state = { layout: 'pinned', theme: 'stone', scene: 'home', ad: 'collapse', tabs: [{ id: 1, scene: 'home' }, { id: 2, scene: 'notes' }, { id: 3, scene: 'reading' }], activeTab: 1, nextTab: 4, history: ['home'], historyIndex: 0, artUrl: null };
  let toastTimer;

  function icon(name) { return `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`; }
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3200);
  }
  function setLayout(layout, focus = false) {
    if (!['pinned', 'peek', 'closed'].includes(layout)) return;
    const containedFocus = sidebar.contains(document.activeElement);
    state.layout = layout;
    shell.dataset.layout = layout;
    sidebar.inert = layout === 'closed';
    sidebar.setAttribute('aria-hidden', String(layout === 'closed'));
    $$('.review-controls [data-layout]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.layout === layout)));
    $('#pin-sidebar').setAttribute('aria-pressed', String(layout === 'pinned'));
    $('#pin-sidebar').setAttribute('aria-label', layout === 'pinned' ? '사이드바 고정 해제' : '사이드바 고정');
    $('#edge-handle').setAttribute('aria-expanded', String(layout !== 'closed'));
    $('#layout-readout').textContent = layout === 'pinned' ? '고정 사이드바 · 페이지와 나란히' : layout === 'peek' ? '잠깐 열기 · 페이지 너비를 유지하는 겹침 방식' : '사이드바 0px · 왼쪽 손잡이만 남기고 집중';
    $('#shield-popover').hidden = true;
    $('#shield-button').setAttribute('aria-expanded', 'false');
    if (layout === 'closed' && containedFocus) $('#edge-handle').focus({ preventScroll: true });
    else if (focus && layout !== 'closed') $('#collapse-sidebar').focus({ preventScroll: true });
  }
  function renderTabs() {
    $('#tab-list').innerHTML = state.tabs.map(tab => `<div class="tab-item${tab.id === state.activeTab ? ' active' : ''}" data-tab-id="${tab.id}"><button class="tab-select" data-select-tab="${tab.id}" ${tab.id === state.activeTab ? 'aria-current="page"' : ''}>${icon(scenes[tab.scene].icon)}<span>${scenes[tab.scene].title}</span></button><button class="tab-close" data-close-tab="${tab.id}" aria-label="${scenes[tab.scene].title} 탭 닫기">${icon('close')}</button></div>`).join('');
    $('#tab-count').textContent = String(state.tabs.length);
  }
  function renderScene(scene, addHistory = true) {
    if (!scenes[scene]) return;
    state.scene = scene;
    $$('.site').forEach(site => { site.hidden = site.id !== `site-${scene}`; });
    $('#current-address').textContent = scenes[scene].address;
    $('#scene-select').value = scene;
    const tab = state.tabs.find(item => item.id === state.activeTab);
    if (tab) tab.scene = scene;
    if (addHistory && state.history[state.historyIndex] !== scene) {
      state.history = state.history.slice(0, state.historyIndex + 1);
      state.history.push(scene);
      state.historyIndex = state.history.length - 1;
    }
    $('#back-button').disabled = state.historyIndex === 0;
    $('#forward-button').disabled = state.historyIndex === state.history.length - 1;
    renderTabs();
  }
  function selectScene(scene) {
    const existing = state.tabs.find(tab => tab.scene === scene);
    if (existing) state.activeTab = existing.id;
    renderScene(scene);
    if (addressDialog.open) addressDialog.close();
    if (storageDialog.open) storageDialog.close();
  }
  function addTab() {
    const tab = { id: state.nextTab++, scene: 'home' };
    state.tabs.push(tab);
    state.activeTab = tab.id;
    renderScene('home');
    if (state.layout === 'closed') setLayout('peek');
  }
  function closeTab(id) {
    const index = state.tabs.findIndex(tab => tab.id === id);
    if (index < 0) return;
    state.tabs.splice(index, 1);
    if (state.tabs.length === 0) { addTab(); return; }
    if (state.activeTab === id) {
      const next = state.tabs[Math.min(index, state.tabs.length - 1)];
      state.activeTab = next.id;
      renderScene(next.scene);
    } else renderTabs();
  }
  function setAd(mode, navigate = false) {
    if (!['collapse', 'replace', 'original'].includes(mode)) return;
    state.ad = mode;
    $('#site-reading').dataset.adMode = mode;
    $$('[data-ad]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ad === mode)));
    $('#shield-summary').textContent = { collapse: '광고 자리 접기', replace: '내 그림으로 바꾸기', original: '원본 비교 중' }[mode];
    $('.on-light').textContent = mode === 'original' ? 'DEMO' : 'ON';
    if (navigate) selectScene('reading');
  }
  function openAddress() {
    if (storageDialog.open) storageDialog.close();
    if (!addressDialog.open) addressDialog.showModal();
    $('#command-input').value = state.scene === 'home' ? '' : scenes[state.scene].address;
    $('#command-input').focus();
    $('#command-input').select();
  }
  function submitAddress(value) {
    const query = value.trim().toLowerCase();
    if (!query || /newtab|home|새.?탭/.test(query)) selectScene('home');
    else if (/fieldnotes|reading|글|읽기|광고/.test(query)) selectScene('reading');
    else if (/note|작업|문서/.test(query)) selectScene('notes');
    else { addressDialog.close(); toast('현재는 화면 설계 시안입니다. 실제 검색·웹 탐색은 구현 단계에서 연결합니다.'); }
  }
  function showStorage(panel) {
    $('#storage-title').textContent = panel === 'downloads' ? '다운로드' : '즐겨찾기';
    $('#storage-content').innerHTML = panel === 'downloads' ? '<p class="storage-empty">아직 내려받은 파일이 없습니다.<br>이 시안에서는 실제 다운로드를 시작하지 않습니다.</p>' : `<button class="command-choice" data-scene="notes">${icon('note')}<span>작업 노트<small>notes.example / workspace</small></span></button><button class="command-choice" data-scene="reading">${icon('book')}<span>읽는 시간<small>fieldnotes.example / essay</small></span></button>`;
    if (!storageDialog.open) storageDialog.showModal();
  }

  document.addEventListener('click', event => {
    const layout = event.target.closest('.review-controls [data-layout]');
    if (layout) setLayout(layout.dataset.layout);
    const scene = event.target.closest('[data-scene]');
    if (scene) selectScene(scene.dataset.scene);
    const ad = event.target.closest('[data-ad]');
    if (ad) setAd(ad.dataset.ad, true);
    const tab = event.target.closest('[data-select-tab]');
    if (tab) { const item = state.tabs.find(item => item.id === Number(tab.dataset.selectTab)); if (item) { state.activeTab = item.id; renderScene(item.scene); } }
    const close = event.target.closest('[data-close-tab]');
    if (close) closeTab(Number(close.dataset.closeTab));
    const panel = event.target.closest('[data-panel]');
    if (panel) showStorage(panel.dataset.panel);
    if (event.target.closest('[data-close-popover]')) { $('#shield-popover').hidden = true; $('#shield-button').setAttribute('aria-expanded', 'false'); }
  });
  $('#collapse-sidebar').addEventListener('click', () => setLayout('closed'));
  $('#edge-handle').addEventListener('click', () => setLayout('peek', true));
  $('#sidebar-scrim').addEventListener('click', () => setLayout('closed'));
  $('#pin-sidebar').addEventListener('click', () => setLayout(state.layout === 'pinned' ? 'peek' : 'pinned'));
  $('#scene-select').addEventListener('change', event => selectScene(event.target.value));
  $('#theme-select').addEventListener('change', event => { state.theme = event.target.value; shell.dataset.theme = state.theme; });
  $('#new-tab').addEventListener('click', addTab);
  $('#open-address').addEventListener('click', openAddress);
  $('#address-slot').addEventListener('click', openAddress);
  $('#close-address').addEventListener('click', () => addressDialog.close());
  $('#address-form').addEventListener('submit', event => { event.preventDefault(); submitAddress($('#command-input').value); });
  $('#home-search').addEventListener('submit', event => { event.preventDefault(); submitAddress($('#home-query').value); });
  $('#close-storage').addEventListener('click', () => storageDialog.close());
  $('#favorite-picker').addEventListener('click', () => showStorage('bookmarks'));
  $('#shortcut-add').addEventListener('click', () => toast('바로가기 추가 위치입니다. 실제 사이트 등록은 브라우저 구현 단계에서 연결합니다.'));
  $('#reload-button').addEventListener('click', () => { const site = $(`#site-${state.scene}`); site.scrollTop = 0; toast('미리보기 화면의 처음으로 돌아왔습니다.'); });
  $('#back-button').addEventListener('click', () => { if (state.historyIndex > 0) renderScene(state.history[--state.historyIndex], false); });
  $('#forward-button').addEventListener('click', () => { if (state.historyIndex < state.history.length - 1) renderScene(state.history[++state.historyIndex], false); });
  $('#shield-button').addEventListener('click', () => { const popover = $('#shield-popover'); popover.hidden = !popover.hidden; $('#shield-button').setAttribute('aria-expanded', String(!popover.hidden)); });
  $('#settings-button').addEventListener('click', () => { $('#theme-select').value = state.theme === 'stone' ? 'deepslate' : 'stone'; $('#theme-select').dispatchEvent(new Event('change')); toast(state.theme === 'stone' ? '스톤 재질' : '심층암 재질'); });
  $('#art-input').addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { toast('PNG, JPEG, WebP, GIF 이미지를 골라주세요.'); return; }
    if (state.artUrl) URL.revokeObjectURL(state.artUrl);
    state.artUrl = URL.createObjectURL(file);
    $('#replacement-image').src = state.artUrl;
    $('#replacement-image').alt = '광고 대신 표시할 사용자가 고른 이미지';
    setAd('replace', true);
    toast('이 미리보기 안에서만 표시합니다. 이미지 파일을 서버로 보내지 않습니다.');
  });
  document.addEventListener('keydown', event => {
    const modifier = event.ctrlKey || event.metaKey;
    const isTextEntry = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
    if (event.key === 'Escape') {
      if (addressDialog.open || storageDialog.open) return;
      if (!$('#shield-popover').hidden) { $('#shield-popover').hidden = true; $('#shield-button').setAttribute('aria-expanded', 'false'); }
      else if (state.layout === 'peek') setLayout('closed');
    }
    if (!modifier || event.altKey || addressDialog.open || storageDialog.open) return;
    if (event.key.toLowerCase() === 'b' && !isTextEntry) { event.preventDefault(); setLayout(state.layout === 'closed' ? 'pinned' : 'closed', true); }
    if (event.key.toLowerCase() === 'l') { event.preventDefault(); openAddress(); }
    // Ctrl+T / Ctrl+W belong to the host browser in this HTML concept.
    // Connect them in the desktop shell only when the real browser is implemented.
  });
  window.addEventListener('pagehide', () => { if (state.artUrl) URL.revokeObjectURL(state.artUrl); });
  renderScene('home', false);
  setLayout('pinned');
  setAd('collapse');
})();
