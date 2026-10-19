(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const assets = window.CraftAssets, catalog = new Map(assets.items.map(item => [item.id, item]));
  const t = (source, values) => window.CraftI18n.t(source, values);
  const itemName = item => window.CraftI18n.itemName(item);
  const defaultTitles = { 'bookmark-maps': ['Google Maps', 'Google 지도'], 'bookmark-school': ['Sungkyunkwan University', '성균관대학교'], 'bookmark-goorm': ['SKKU goorm', 'SKKU 구름'], 'bookmark-minecraft-news': ['Minecraft News', '마인크래프트 뉴스'] };
  const entryTitle = entry => defaultTitles[entry.id]?.includes(entry.title) ? t(defaultTitles[entry.id][0]) : entry.title;
  let storage;
  try { storage = localStorage; } catch { storage = { getItem() { throw Error('Storage unavailable'); } }; }
  const model = new window.CraftInventoryModel(assets.items, storage);
  const partNames = { head: '투구', chest: '흉갑', legs: '각반', feet: '부츠' };
  const placeholder = { head: 'helmetSlot', chest: 'chestSlot', legs: 'legsSlot', feet: 'feetSlot' };
  let dragging = null, carried = null, editing = null, targetSlot = null, candidate = null, editorTitle = '';
  let noticeTimer, undoSnapshot = null, undoRaw = null, lastEquipment = null, menuOrigin = null;
  const categories = [
    ['all', '전체 아이템', 'compass'], ['blocks', '블록', 'crafting_table'], ['tools', '도구', 'diamond_pickaxe'],
    ['equipment', '전투와 장비', 'iron_sword'], ['food', '음식', 'apple'], ['transport', '이동과 회로', 'minecart'], ['materials', '재료', 'diamond']
  ];
  const creativeItems = [...assets.items].sort((a, b) => {
    const order = ['blocks', 'tools', 'equipment', 'food', 'transport', 'materials'];
    return order.indexOf(a.category) - order.indexOf(b.category) || a.id.localeCompare(b.id);
  });
  let category = 'all', creativeRow = 0, filteredIcons = [];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function notify(text, undo = false) {
    clearTimeout(noticeTimer);
    $('#inventory-notice span').textContent = t(text); $('#inventory-notice').hidden = false; $('#undo-bookmark').hidden = !undo;
    noticeTimer = setTimeout(() => { $('#inventory-notice').hidden = true; }, undo ? 9000 : 4200);
  }
  function targetOf(button) {
    return button.hasAttribute('data-equipment-slot') ? { type: 'armor', key: button.dataset.equipmentSlot } : { type: 'slot', key: Number(button.dataset.bookmarkSlot) };
  }
  function entryOf(button) { const id = button.dataset.bookmarkId; return id ? model.data.entries[id] : null; }
  function notificationAttributes(entry, label) {
    const kind = entry && window.CraftUnreadModel.kindForURL(entry.url);
    return kind ? `data-notification-kind="${kind}" data-notification-label="${escape(label)}"` : '';
  }
  function slotHTML(index) {
    const id = model.data.slots[index], entry = id ? model.data.entries[id] : null, item = entry ? catalog.get(entry.itemId) : null;
    const label = entry ? entryTitle(entry) + ' · ' + itemName(item) : t('Empty inventory slot {number} · Add site', { number: index + 1 });
    return `<button type="button" class="inventory-slot bookmark-slot${id && id === carried ? ' carried' : ''}" data-bookmark-slot="${index}" data-user-content ${notificationAttributes(entry, label)} ${id ? `data-bookmark-id="${id}" data-item-id="${item.id}" draggable="true"` : ''} aria-label="${escape(label)}" ${id && id === carried ? 'aria-pressed="true"' : ''}>${item ? `<img src="${item.src}" alt="" draggable="false">` : '<span class="empty-slot-plus" aria-hidden="true">+</span>'}</button>`;
  }
  function armorHTML(part) {
    const id = model.data.armor[part], entry = id ? model.data.entries[id] : null, item = entry ? catalog.get(entry.itemId) : null;
    const label = t('{part} slot · {item}', { part: t(partNames[part]), item: entry ? entryTitle(entry) + ' · ' + itemName(item) : t('Empty') });
    return `<button type="button" class="inventory-slot equipment-slot${id && id === carried ? ' carried' : ''}" data-equipment-slot="${part}" data-user-content ${notificationAttributes(entry, label)} ${id ? `data-bookmark-id="${id}" draggable="true"` : ''} aria-label="${escape(label)}"><img src="${item ? item.src : assets.gui[placeholder[part]]}" alt="" draggable="false" class="${item ? '' : 'empty-armor'}"></button>`;
  }
  function mount(root) {
    const grid = root.querySelector('[data-role="inventory-grid"]'); if (!grid) return;
    grid.innerHTML = Array.from({ length: 27 }, (_, index) => slotHTML(index)).join('');
    root.querySelector('[data-role="inventory-hotbar"]').innerHTML = Array.from({ length: 9 }, (_, index) => slotHTML(index + 27)).join('');
    root.querySelector('[data-role="equipment-slots"]').innerHTML = Object.keys(partNames).map(armorHTML).join('');
    window.CraftUnread?.decorate(root);
  }
  function renderLibrary(container) {
    container.innerHTML = '<div class="bookmark-library">' + Object.values(model.data.entries).map(entry => `<div><button data-bookmark-open="${entry.id}" data-user-content ${notificationAttributes(entry, entryTitle(entry))}><img src="${catalog.get(entry.itemId).src}" alt="" draggable="false"><span>${escape(entryTitle(entry))}<small>${escape(entry.url)}</small></span></button><button data-bookmark-edit="${entry.id}" data-user-content aria-label="${escape(t('Edit {title}', { title: entryTitle(entry) }))}">${t('Edit')}</button></div>`).join('') + '</div>';
    window.CraftUnread?.decorate(container);
  }
  function render() {
    $('#item-tooltip').hidden = true;
    $$('.inventory-native').forEach(mount);
    if ($('#storage-dialog').open && $('#storage-dialog').dataset.panel === 'bookmarks') renderLibrary($('#storage-content'));
    const equipment = model.equipment(), signature = JSON.stringify(equipment);
    if (signature !== lastEquipment) { lastEquipment = signature; window.CraftPlayer?.setEquipment(equipment); }
    if (model.loadError) { $('#inventory-storage-warning').textContent = t(model.loadError); $('#inventory-storage-warning').hidden = false; }
  }
  function mutate(action, message) {
    try {
      const previousEquipment = model.equipment();
      action();
      const equipment = model.equipment();
      const changedPart = Object.keys(equipment).find(part => JSON.stringify(previousEquipment[part]) !== JSON.stringify(equipment[part]));
      document.dispatchEvent(new CustomEvent('craftside:inventory-sound', { detail: { type: changedPart ? 'equip' : 'move', material: equipment[changedPart]?.material || previousEquipment[changedPart]?.material || 'generic' } }));
      undoSnapshot = undoRaw = null; carried = null; render(); if (message) notify(message); return true;
    }
    catch (error) { notify(error.message || '변경을 저장하지 못했습니다.'); return false; }
  }
  function openEntry(id) {
    try {
      const entry = model.entry(id);
      document.dispatchEvent(new CustomEvent('craftside:open-bookmark', { detail: { title: entry.title, url: window.CraftInventoryModel.normalizeURL(entry.url) } }));
    } catch (error) { notify(error.message); }
  }
  function assignment(item) {
    candidate = item.id; $('#assigned-item-image').src = item.src; $('#assigned-item-name').textContent = itemName(item);
    $('#assigned-item-description').textContent = item.armor ? t('Drop this in the {part} slot to wear it', { part: t(partNames[item.armor.slot]) }) : t('Choose any available item with Choose icon');
  }
  function openEditor(id = null, slot = null) {
    closeMenu(); $('#item-tooltip').hidden = true; $('#bookmark-error').hidden = true;
    editing = id; targetSlot = slot;
    try {
      model.refreshFromStorage();
      const entry = id ? model.entry(id) : null;
      if (!id && model.data.slots.every(Boolean)) throw Error('인벤토리가 가득 찼습니다. 먼저 빈칸을 만들어 주세요.');
      assignment(entry ? catalog.get(entry.itemId) : model.pick());
      editorTitle = entry ? entryTitle(entry) : '';
      $('#bookmark-name').value = editorTitle; $('#bookmark-url').value = entry?.url || '';
      $('#bookmark-dialog-title').textContent = t(entry ? 'Edit site' : 'Add site'); $('#save-bookmark').textContent = t(entry ? 'Save' : 'Add');
      $$('dialog[open]').forEach(dialog => dialog.close());
      $('#bookmark-dialog').showModal(); $('#bookmark-name').focus();
    } catch (error) { notify(error.message); }
  }
  function renderPicker() {
    const query = $('#icon-search').value.trim().normalize('NFKC').toLowerCase();
    filteredIcons = creativeItems.filter(item => (category === 'all' || item.category === category) &&
      `${item.id} ${item.id.replaceAll('_', ' ')} ${item.name} ${item.nameKo || ''}`.normalize('NFKC').toLowerCase().includes(query));
    const maximum = Math.max(0, Math.ceil(filteredIcons.length / 9) - 5);
    creativeRow = Math.max(0, Math.min(maximum, creativeRow));
    const start = creativeRow * 9;
    $('#creative-tooltip').hidden = true;
    $('#creative-grid').innerHTML = filteredIcons.slice(start, start + 45).map((item, index) => {
      const available = model.canAssign(item.id, editing), reserved = window.CraftInventoryModel.reserved.includes(item.id);
      const status = available ? '' : ' · ' + t(reserved ? 'Fixed tool' : 'In use');
      return `<button type="button" class="creative-slot${candidate === item.id ? ' selected' : ''}" data-icon-id="${item.id}" data-icon-index="${start + index}" aria-label="${escape(itemName(item) + ' (' + item.id + ')' + status)}" aria-pressed="${candidate === item.id}" ${available ? '' : 'disabled'}><img src="${item.src}" alt="" draggable="false"></button>`;
    }).join('');
    const slider = $('#creative-scroll'); slider.max = maximum; slider.value = creativeRow; slider.disabled = maximum === 0;
    $('#creative-empty').hidden = filteredIcons.length > 0;
    $('#creative-count').textContent = `${filteredIcons.length ? start + 1 : 0}–${Math.min(start + 45, filteredIcons.length)} / ${filteredIcons.length}`;
    $$('#creative-tabs button').forEach(button => {
      const selected = button.dataset.iconCategory === category, name = t(categories.find(([key]) => key === button.dataset.iconCategory)[1]);
      button.setAttribute('aria-selected', String(selected)); button.setAttribute('aria-label', name); button.title = name; button.tabIndex = selected ? 0 : -1;
    });
  }
  function openIconPicker() {
    try {
      model.refreshFromStorage(); category = 'all'; creativeRow = 0; $('#icon-search').value = '';
      $('#creative-tabs').innerHTML = categories.map(([key, name, icon]) => `<button type="button" role="tab" data-icon-category="${key}" aria-label="${name}" aria-controls="creative-grid" title="${name}"><img src="${catalog.get(icon).src}" alt="" draggable="false"></button>`).join('');
      $('#creative-hotbar').innerHTML = model.data.slots.slice(27).map(id => `<span data-user-content>${id ? `<img src="${catalog.get(model.entry(id).itemId).src}" alt="${escape(entryTitle(model.entry(id)))}" draggable="false">` : ''}</span>`).join('');
      $('#creative-current-image').src = catalog.get(candidate).src; $('#creative-current-name').textContent = itemName(catalog.get(candidate));
      renderPicker(); $('#icon-dialog').showModal(); $('#icon-search').focus();
    } catch (error) { notify(error.message); }
  }
  function closeIconPicker() { $('#creative-tooltip').hidden = true; $('#icon-dialog').close(); $('#assign-icon').focus(); }
  function pickerTooltip(button) {
    const item = catalog.get(button.dataset.iconId), tooltip = $('#creative-tooltip');
    tooltip.querySelector('strong').textContent = itemName(item);
    tooltip.querySelector('span').textContent = window.CraftInventoryModel.reserved.includes(item.id) ? t('Fixed tool icon') : !model.canAssign(item.id, editing) ? t('Used by another site') : t(categories.find(([key]) => key === item.category)?.[1] || 'All items');
    tooltip.hidden = false;
    const frame = $('.creative-workbench').getBoundingClientRect(), rect = button.getBoundingClientRect();
    tooltip.style.left = Math.max(0, Math.min(rect.right - frame.left - 9, frame.width - tooltip.offsetWidth)) + 'px';
    tooltip.style.top = Math.max(0, rect.top - frame.top - tooltip.offsetHeight - 5) + 'px';
  }
  function closeMenu() {
    $('#bookmark-menu').hidden = true;
    if (menuOrigin?.isConnected && document.activeElement?.closest('#bookmark-menu')) menuOrigin.focus({ preventScroll: true });
  }
  function positionPopup(element, rect) {
    const shell = $('#browser-shell').getBoundingClientRect();
    element.style.left = Math.max(7, Math.min(rect.left - shell.left + 12, shell.width - element.offsetWidth - 12)) + 'px';
    element.style.top = Math.max(7, Math.min(rect.bottom - shell.top + 5, shell.height - element.offsetHeight - 12)) + 'px';
  }
  function showMenu(id, button) {
    const entry = model.entry(id), item = catalog.get(entry.itemId), equipped = model.location(id).type === 'armor';
    menuOrigin = button; $('#item-tooltip').hidden = true;
    const actions = [['open', t('Open site')], ['edit', t('Edit site')]];
    if (item.armor) actions.push([equipped ? 'unequip' : 'equip', t(equipped ? 'Unequip {part}' : 'Equip {part}', { part: t(partNames[item.armor.slot]) })]);
    actions.push(['remove', t('Delete bookmark')]);
    $('#bookmark-menu').innerHTML = `<strong data-user-content>${escape(entryTitle(entry))}</strong>` + actions.map(([action, label]) => `<button role="menuitem" data-bookmark-command="${action}" data-entry="${id}">${label}</button>`).join('');
    $('#bookmark-menu').hidden = false; positionPopup($('#bookmark-menu'), button.getBoundingClientRect());
    $('#bookmark-menu button').focus();
  }
  function showTooltip(button) {
    if (dragging || carried || !$('#bookmark-menu').hidden) return;
    const entry = entryOf(button); if (!entry) return;
    const item = catalog.get(entry.itemId), tooltip = $('#item-tooltip');
    tooltip.querySelector('strong').setAttribute('data-user-content', ''); tooltip.querySelector('strong').textContent = entryTitle(entry);
    tooltip.querySelector('span').textContent = itemName(item);
    const hint = t(item.armor ? 'Drag or Shift+click to equip · Right-click to edit' : 'Click to open site · Right-click to edit');
    tooltip.querySelector('small').textContent = (button.querySelector('.item-enchantment') ? window.CraftUnread.description(button.dataset.notificationKind) + ' · ' : '') + hint;
    tooltip.hidden = false; positionPopup(tooltip, button.getBoundingClientRect());
  }
  const slotSelector = '[data-bookmark-slot], [data-equipment-slot]';
  document.addEventListener('click', event => {
    const add = event.target.closest('[data-new-bookmark]'); if (add) { openEditor(); return; }
    const open = event.target.closest('[data-bookmark-open]'); if (open) { openEntry(open.dataset.bookmarkOpen); return; }
    const edit = event.target.closest('[data-bookmark-edit]'); if (edit) { openEditor(edit.dataset.bookmarkEdit); return; }
    const command = event.target.closest('[data-bookmark-command]');
    if (command) {
      const { entry: id, bookmarkCommand: action } = command.dataset;
      closeMenu();
      if (action === 'open') openEntry(id);
      if (action === 'edit') openEditor(id);
      if (action === 'equip') mutate(() => model.equip(id), '갑옷을 착용하고 저장했습니다.');
      if (action === 'unequip') mutate(() => model.unequip(model.location(id).key), '갑옷을 벗고 저장했습니다.');
      if (action === 'remove') {
        const before = model.snapshot();
        if (mutate(() => model.remove(id))) { undoSnapshot = before; undoRaw = model.lastSaved; notify('북마크를 삭제했습니다.', true); }
      }
      return;
    }
    if (!event.target.closest('#bookmark-menu')) closeMenu();
    const button = event.target.closest(slotSelector); if (!button) return;
    $('#item-tooltip').hidden = true;
    const entry = entryOf(button), target = targetOf(button);
    if (carried) { mutate(() => model.move(carried, target), '아이템 위치를 저장했습니다.'); return; }
    if (!entry) { if (target.type === 'slot') openEditor(null, target.key); else notify('해당 부위의 갑옷을 이 칸으로 끌어 놓으세요.'); return; }
    if (target.type === 'armor') { showMenu(entry.id, button); return; }
    if (event.shiftKey && catalog.get(entry.itemId).armor) { mutate(() => model.equip(entry.id), '갑옷을 착용하고 저장했습니다.'); return; }
    openEntry(entry.id);
  });
  document.addEventListener('contextmenu', event => { const button = event.target.closest(slotSelector); if (button && entryOf(button)) { event.preventDefault(); showMenu(entryOf(button).id, button); } });
  document.addEventListener('pointerover', event => { const button = event.target.closest(slotSelector); if (button) showTooltip(button); });
  document.addEventListener('pointerout', event => { const button = event.target.closest(slotSelector); if (button && !button.contains(event.relatedTarget)) $('#item-tooltip').hidden = true; });
  document.addEventListener('focusin', event => { const button = event.target.closest(slotSelector); if (button) showTooltip(button); });
  document.addEventListener('keydown', event => {
    const button = event.target.closest(slotSelector);
    if (event.key === 'Escape') { closeMenu(); carried = null; $('#item-tooltip').hidden = true; render(); }
    if (button && event.code === 'Space') {
      event.preventDefault(); const entry = entryOf(button); if (entry) { carried = carried === entry.id ? null : entry.id; button.classList.toggle('carried', Boolean(carried)); button.setAttribute('aria-pressed', String(Boolean(carried))); if (carried) notify('옮길 칸으로 이동한 뒤 Enter를 누르세요. Esc로 취소합니다.'); }
    }
    if (button && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) && entryOf(button)) { event.preventDefault(); showMenu(entryOf(button).id, button); }
    if (button?.hasAttribute('data-bookmark-slot') && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
      event.preventDefault(); const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[event.key];
      const index = Math.max(0, Math.min(35, Number(button.dataset.bookmarkSlot) + delta));
      button.closest('.inventory-native').querySelector(`[data-bookmark-slot="${index}"]`)?.focus();
    }
    if (event.target.closest('#bookmark-menu') && ['ArrowDown','ArrowUp'].includes(event.key)) {
      event.preventDefault(); const buttons = $$('#bookmark-menu button'), index = buttons.indexOf(document.activeElement);
      buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus();
    }
  });
  document.addEventListener('dragstart', event => {
    const button = event.target.closest(slotSelector); if (!button || !entryOf(button)) return;
    dragging = entryOf(button).id; carried = null; $('#item-tooltip').hidden = true; closeMenu();
    document.dispatchEvent(new CustomEvent('craftside:inventory-sound', { detail: { type: 'pickup' } }));
    event.dataTransfer.setData('application/x-craftside-bookmark', dragging); event.dataTransfer.effectAllowed = 'move'; button.classList.add('dragging-item');
  });
  document.addEventListener('dragover', event => {
    const button = event.target.closest(slotSelector); if (!dragging || !button) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move';
    $$('.slot-drop-target').forEach(slot => { if (slot !== button) slot.classList.remove('slot-drop-target'); }); button.classList.add('slot-drop-target');
  });
  document.addEventListener('drop', event => {
    const button = event.target.closest(slotSelector); if (!dragging || !button) return;
    event.preventDefault(); const id = dragging; dragging = null;
    mutate(() => model.move(id, targetOf(button)), button.hasAttribute('data-equipment-slot') ? '갑옷을 착용하고 저장했습니다.' : '아이템 위치를 저장했습니다.');
    $$('.slot-drop-target,.dragging-item').forEach(slot => slot.classList.remove('slot-drop-target','dragging-item'));
  });
  document.addEventListener('dragend', () => { dragging = null; $$('.slot-drop-target,.dragging-item').forEach(slot => slot.classList.remove('slot-drop-target','dragging-item')); });
  $('#bookmark-form').addEventListener('submit', event => {
    event.preventDefault(); $('#bookmark-error').hidden = true;
    try {
      const values = { title: $('#bookmark-name').value, url: $('#bookmark-url').value, itemId: candidate, slot: targetSlot };
      if (editing && values.title === editorTitle) values.title = model.entry(editing).title;
      if (editing) model.edit(editing, values); else model.add(values);
      document.dispatchEvent(new CustomEvent('craftside:inventory-sound', { detail: { type: 'move' } }));
      undoSnapshot = undoRaw = null; render(); $('#bookmark-dialog').close(); notify('사이트와 아이템 배치를 저장했습니다.');
    } catch (error) { $('#bookmark-error').textContent = t(error.message || 'Could not save the site.'); $('#bookmark-error').hidden = false; }
  });
  $('#assign-icon').addEventListener('click', openIconPicker);
  $('#close-icon-picker').addEventListener('click', closeIconPicker); $('#cancel-icon-picker').addEventListener('click', closeIconPicker);
  $('#icon-dialog').addEventListener('close', () => { $('#creative-tooltip').hidden = true; });
  $('#icon-search').addEventListener('input', () => { creativeRow = 0; renderPicker(); });
  $('#creative-tabs').addEventListener('click', event => { const tab = event.target.closest('[data-icon-category]'); if (tab) { category = tab.dataset.iconCategory; creativeRow = 0; renderPicker(); } });
  $('#creative-tabs').addEventListener('keydown', event => {
    const current = event.target.closest('[data-icon-category]'); if (!current || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); const index = categories.findIndex(([key]) => key === current.dataset.iconCategory);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? categories.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : categories.length - 1)) % categories.length;
    category = categories[next][0]; creativeRow = 0; renderPicker(); $(`#creative-tabs [data-icon-category="${category}"]`).focus();
  });
  $('#creative-grid').addEventListener('click', event => {
    const button = event.target.closest('[data-icon-id]'); if (!button || button.disabled) return;
    assignment(catalog.get(button.dataset.iconId)); closeIconPicker();
  });
  $('#creative-grid').addEventListener('pointerover', event => { const button = event.target.closest('[data-icon-id]'); if (button) pickerTooltip(button); });
  $('#creative-grid').addEventListener('pointerout', event => { if (!event.target.closest('[data-icon-id]')?.contains(event.relatedTarget)) $('#creative-tooltip').hidden = true; });
  $('#creative-grid').addEventListener('focusin', event => { const button = event.target.closest('[data-icon-id]'); if (button) pickerTooltip(button); });
  $('#creative-grid').addEventListener('focusout', () => { $('#creative-tooltip').hidden = true; });
  $('#creative-scroll').addEventListener('input', event => { creativeRow = Number(event.target.value); renderPicker(); });
  $('#creative-grid').addEventListener('wheel', event => { event.preventDefault(); creativeRow += Math.sign(event.deltaY); renderPicker(); }, { passive: false });
  $('#creative-grid').addEventListener('keydown', event => {
    const button = event.target.closest('[data-icon-index]'), delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[event.key];
    if (!button || !delta) return;
    event.preventDefault(); let index = Number(button.dataset.iconIndex) + delta;
    while (index >= 0 && index < filteredIcons.length && !model.canAssign(filteredIcons[index].id, editing)) index += delta;
    if (index < 0 || index >= filteredIcons.length) return;
    if (index < creativeRow * 9) creativeRow = Math.floor(index / 9);
    if (index >= (creativeRow + 5) * 9) creativeRow = Math.floor(index / 9) - 4;
    renderPicker(); $(`#creative-grid [data-icon-index="${index}"]`)?.focus();
  });
  $('#close-bookmark').addEventListener('click', () => $('#bookmark-dialog').close()); $('#cancel-bookmark').addEventListener('click', () => $('#bookmark-dialog').close());
  $('#undo-bookmark').addEventListener('click', () => {
    if (!undoSnapshot) return;
    try { if (storage.getItem(window.CraftInventoryModel.key) !== undoRaw) throw Error('그 뒤의 변경이 있어 삭제 전 상태로 되돌리지 않았습니다.'); const snapshot = undoSnapshot; mutate(() => model.restore(snapshot), '삭제한 북마크를 복원했습니다.'); }
    catch (error) { notify(error.message); }
  });
  window.addEventListener('storage', event => { if (event.key === window.CraftInventoryModel.key) { try { model.refreshFromStorage(); carried = null; undoSnapshot = undoRaw = null; render(); } catch { notify('다른 창의 저장값을 읽지 못했습니다. 현재 인벤토리는 보존했습니다.'); } } });
  document.addEventListener('craftside:language-changed', () => {
    closeMenu(); render();
    if (candidate && $('#bookmark-dialog').open) assignment(catalog.get(candidate));
    if (candidate && $('#icon-dialog').open) { $('#creative-current-name').textContent = itemName(catalog.get(candidate)); renderPicker(); }
  });
  window.CraftInventory = { mount, render, renderLibrary, openEditor };
  render();
})();
