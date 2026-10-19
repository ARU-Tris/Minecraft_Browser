(() => {
  'use strict';
  const $ = selector => document.querySelector(selector), M = window.CraftPackModel, Renderer = window.CraftPackRenderer;
  const t = (source, values) => window.CraftI18n.t(source, values), dialog = $('#resource-packs-dialog'), shell = $('#browser-shell');
  let indexed; try { indexed = window.indexedDB; } catch { indexed = null; }
  const db = window.CraftPackDB.create(indexed), originals = Renderer.originals;
  let saved = window.CraftPackDB.empty(), draft = null, plan = null, revision = 0, busy = false, ready = false, returnSettings = false, libraryURLs = [], summaryError = '';
  const imageState = new WeakMap(), baseAliases = new Map(); let animationNodes = new Set();
  let channel; try { channel = new BroadcastChannel('craftside:resource-packs'); } catch { /* Storage still works without cross-window announcements. */ }
  function error(message) { $('#resource-pack-error').textContent = t(message); $('#resource-pack-error').hidden = !message; }
  function status(source, values) { $('#resource-pack-status').textContent = t(source, values); }
  function lock(value) { busy = value; dialog.setAttribute('aria-busy', String(value)); dialog.querySelectorAll('button,input').forEach(button => { button.disabled = value; }); if (!value) render(); }
  function changed() { return Boolean(draft && (JSON.stringify(draft.active) !== JSON.stringify(saved.active) || JSON.stringify(draft.packs.map(pack => pack.id)) !== JSON.stringify(saved.packs.map(pack => pack.id)))); }
  function summary() {
    const selected = saved.active.map(id => saved.packs.find(pack => pack.id === id));
    $('#resource-pack-summary').textContent = summaryError ? t(summaryError) : selected.length ? t('{count} selected · {name}', { count: selected.length, name: selected[0].name }) : t('Default · Vanilla Tweaks');
  }
  function refreshImages(root = document) {
    const nodes = root.nodeType === 1 && root.matches('img') ? [root] : [...root.querySelectorAll('img')];
    for (const image of nodes) {
      const token = image.getAttribute('src'); if (!token) continue;
      const prior = imageState.get(image), original = plan?.aliases.get(token) || baseAliases.get(token) || (prior?.last === token ? prior.original : null);
      if (!original) { imageState.delete(image); animationNodes.delete(image); continue; }
      const keepFrame = prior?.revision === revision && plan?.animationSources.has(original) && plan.aliases.has(token);
      const source = keepFrame ? token : plan?.replacements.get(original) || original;
      const record = { original, last: source, revision }; imageState.set(image, record);
      image.dataset.resourceSource = original;
      if (token !== source) image.src = source;
      const animation = plan?.animationSources.get(original);
      if (animation) {
        record.animation = animation; animationNodes.add(image); image.dataset.resourceAnimation = animation;
        image.dataset.resourceFrame = String(plan.animations.get(animation).frames.find(frame => frame.url === source)?.index ?? 0);
      } else { animationNodes.delete(image); delete image.dataset.resourceAnimation; delete image.dataset.resourceFrame; }
    }
  }
  function commit(next, state) {
    const previous = plan;
    // Current nodes may still contain the old plan's blob URLs.
    if (previous) for (const [url, original] of previous.aliases) baseAliases.set(url, original);
    plan = next; saved = state; revision++;
    for (const key of previous?.css.keys() || []) shell.style.removeProperty(key);
    for (const [key, value] of next.css) shell.style.setProperty(key, value);
    shell.dataset.packButtons = String(next.hasButtons); shell.dataset.resourcePacks = String(state.active.length); shell.dataset.resourceRevision = String(revision);
    for (const item of window.CraftAssets.items) item.src = next.itemSources.get(item.id) || originals.assets.items.find(base => base.id === item.id).src;
    Object.assign(window.CraftAssets.gui, next.gui); window.CraftAssets.equipment = next.equipment;
    Object.assign(window.CraftAmbienceAssets.effects, next.effects); Object.assign(window.CraftAmbienceAssets.tracks, next.tracks);
    refreshImages(); window.CraftInventory?.render(); window.CraftPlayer?.reloadResources?.(); window.CraftUnread?.decorate();
    document.dispatchEvent(new CustomEvent('craftside:resources-changed', { detail: { revision, stats: next.stats } }));
    summaryError = ''; summary();
    // CSS and decoded image replacements get a frame to switch before disposal.
    requestAnimationFrame(() => { previous?.dispose(); if (previous) for (const url of previous.aliases.keys()) baseAliases.delete(url); });
  }
  window.CraftResources = {
    get revision() { return revision; },
    worldSource(source, period) { return period === 'day' && plan?.panorama.length ? plan.panorama[Math.floor(Math.max(0, new Date().getHours() - 6) / 2) % plan.panorama.length] : source; },
    refreshImages
  };
  const observer = new MutationObserver(records => {
    let changed = false;
    for (const record of records) {
      if (record.type === 'attributes') { refreshImages(record.target); changed = true; }
      else for (const node of record.addedNodes) if (node.nodeType === 1) { refreshImages(node); changed = true; }
    }
    if (changed) window.CraftUnread?.decorate();
  });
  observer.observe(shell, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  motion.addEventListener('change', () => {
    if (!motion.matches || !plan) return;
    for (const image of animationNodes) {
      const record = imageState.get(image), first = plan.animations.get(record?.animation)?.frames[0];
      if (record && first) { record.last = first.url; image.src = first.url; image.dataset.resourceFrame = String(first.index); }
    }
    window.CraftUnread?.decorate();
  });
  const animationTimer = setInterval(() => {
    if (!plan || document.hidden || motion.matches) return;
    let changed = false;
    for (const image of animationNodes) {
      if (!image.isConnected) { animationNodes.delete(image); continue; }
      const record = imageState.get(image), sequence = plan.animations.get(record?.animation); if (!sequence) continue;
      let time = performance.now() % sequence.duration, selected;
      for (const frame of sequence.frames) { selected = frame; time -= frame.time; if (time < 0) break; }
      if (selected && image.getAttribute('src') !== selected.url) { record.last = selected.url; image.src = selected.url; image.dataset.resourceFrame = String(selected.index); changed = true; }
    }
    if (changed) window.CraftUnread?.decorate();
  }, 50);
  function button(text, action, pack, disabled = false) {
    const node = document.createElement('button'); node.type = 'button'; node.className = 'pack-small-button'; node.textContent = t(text);
    node.dataset.packAction = action; node.dataset.packId = pack.id; node.disabled = disabled; node.setAttribute('aria-label', t('{action} · {name}', { action: t(text), name: pack.name })); return node;
  }
  function card(pack, selected) {
    const row = document.createElement('article'); row.className = 'pack-card'; row.dataset.packCard = pack.id;
    const icon = document.createElement('img'); icon.alt = ''; icon.draggable = false;
    const file = pack.files.find(file => file.path === 'pack.png');
    if (file) { const url = URL.createObjectURL(file.blob); libraryURLs.push(url); icon.src = url; } else icon.src = '../assets/craftside-mark.svg';
    const content = document.createElement('div'), name = document.createElement('strong'), description = document.createElement('p'), info = document.createElement('small');
    name.textContent = pack.name; name.dataset.userContent = ''; description.textContent = pack.description; description.dataset.userContent = '';
    info.textContent = t('{count} resources · Format {format}', { count: pack.count, format: pack.formats.low.join('.') + '–' + pack.formats.high.join('.') });
    content.append(name, description, info);
    const warnings = [];
    if (!pack.compatible) warnings.push(t('Different game format · supported files will still be used'));
    if (pack.warnings?.shaders || pack.warnings?.extensions) warnings.push(t('Shaders and mod features are skipped'));
    if (pack.warnings?.fonts) warnings.push(t('Pack fonts are skipped'));
    if (warnings.length) { const note = document.createElement('small'); note.className = 'pack-warning'; note.textContent = warnings.join(' · '); content.append(note); }
    const actions = document.createElement('div'); actions.className = 'pack-card-actions';
    if (selected) { const index = draft.active.indexOf(pack.id); actions.append(button('Move up', 'up', pack, index === 0), button('Move down', 'down', pack, index === draft.active.length - 1), button('Disable', 'disable', pack)); }
    else actions.append(button('Use pack', 'enable', pack));
    actions.append(button('Remove', 'remove', pack)); row.append(icon, content, actions); return row;
  }
  function render() {
    summary(); if (!draft || busy) return;
    $('#resource-pack-applied').textContent = plan ? t('{items} items · {gui} UI textures · {armor} armor textures · {sounds} sounds', plan.stats) + (plan.stats.modelsSkipped ? ' · ' + t('{count} complex item models use their default icon.', { count: plan.stats.modelsSkipped }) : '') : '';
    libraryURLs.forEach(url => URL.revokeObjectURL(url)); libraryURLs = [];
    const available = $('#resource-pack-available'), selected = $('#resource-pack-selected'); available.replaceChildren(); selected.replaceChildren();
    for (const pack of draft.packs.filter(pack => !draft.active.includes(pack.id))) available.append(card(pack, false));
    for (const id of draft.active) selected.append(card(draft.packs.find(pack => pack.id === id), true));
    if (!available.childElementCount) { const note = document.createElement('p'); note.className = 'pack-empty'; note.textContent = t('Import a Java resource pack ZIP to get started.'); available.append(note); }
    if (!selected.childElementCount) { const note = document.createElement('p'); note.className = 'pack-empty'; note.textContent = t('No extra packs selected'); selected.append(note); }
    $('#apply-resource-packs').disabled = !changed(); $('#resource-pack-defaults').disabled = draft.active.length === 0;
    $('#resource-pack-pending').hidden = !changed();
  }
  async function load() {
    const info = await Renderer.base();
    for (const source of [...Object.keys(info.bindings), ...originals.assets.items.map(item => item.src)]) { baseAliases.set(source, source); baseAliases.set(new URL(source, document.baseURI).href, source); }
    let state = await db.read();
    // Seed only an untouched native profile. A deliberately disabled or removed
    // pack has a nonzero revision and is never silently restored.
    if (window.craftsideBrowser && state.revision === 0 && !state.packs.length && !state.active.length) {
      const response = await fetch('../assets/default-packs/VanillaTweaks_r106307_MC26.3.x.zip');
      if (!response.ok) throw Error('Could not load the bundled resource pack.');
      const pack = await M.importPack(new File([await response.blob()], 'VanillaTweaks_r106307_MC26.3.x.zip'));
      state = await db.write({ ...state, packs: [pack], active: [pack.id] }, 0);
    }
    M.stack(state.packs, state.active);
    const next = await Renderer.prepare(state.packs, state.active); commit(next, state); ready = true;
  }
  async function open() {
    if (busy) return;
    returnSettings = true; $('#settings-dialog').close(); dialog.showModal(); error(''); status('Loading resource packs…'); lock(true);
    try { if (!ready || summaryError) await load(); else { const state = await db.read(); if (state.revision !== saved.revision) await load(); } draft = { ...saved, packs: [...saved.packs], active: [...saved.active] }; status('Higher packs override lower packs. Missing files use Default.'); }
    catch (failure) { summaryError = failure.message; error(failure.message); }
    finally { lock(false); }
  }
  async function importFiles(files) {
    if (busy || !draft || !files.length) return;
    lock(true); error('');
    try {
      const info = await Renderer.base();
      for (const file of files) {
        if (draft.packs.length >= M.limits.packs) throw Error('You can keep up to 12 resource packs.');
        status('Importing {name}…', { name: file.name });
        const pack = await M.importPack(file, info.format, (done, total) => status('Importing {name} · {done}/{total}', { name: file.name, done, total }));
        if (draft.packs.some(previous => previous.id === pack.id)) { status('This resource pack is already in your library.'); continue; }
        draft.packs.push(pack);
      }
      status('Imported. Select a pack, then apply.');
    } catch (failure) { error(failure.message); }
    finally { $('#resource-pack-file').value = ''; lock(false); }
  }
  async function apply() {
    if (busy || !draft || !changed()) return;
    lock(true); error(''); status('Applying resource packs…'); let next;
    try {
      next = await Renderer.prepare(draft.packs, draft.active, (done, total) => status('Preparing icons · {done}/{total}', { done, total }));
      const state = await db.write(draft, saved.revision); commit(next, state); next = null; draft = null;
      channel?.postMessage({ revision: saved.revision }); status('Resource packs applied.'); dialog.close();
    } catch (failure) { next?.dispose(); error(failure.message); }
    finally { lock(false); }
  }
  $('#settings-resource-packs').addEventListener('click', open);
  $('#import-resource-pack').addEventListener('click', () => $('#resource-pack-file').click());
  $('#resource-pack-file').addEventListener('change', event => importFiles([...event.target.files]));
  $('#apply-resource-packs').addEventListener('click', apply);
  $('#resource-pack-defaults').addEventListener('click', () => { if (draft && !busy) { draft.active = []; render(); } });
  for (const id of ['close-resource-packs', 'cancel-resource-packs']) $('#' + id).addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { draft = null; libraryURLs.forEach(url => URL.revokeObjectURL(url)); libraryURLs = []; if (returnSettings && !document.querySelector('dialog[open]')) { returnSettings = false; $('#settings-dialog').showModal(); } });
  dialog.addEventListener('click', event => {
    const control = event.target.closest('[data-pack-action]'); if (!control || busy || !draft) return;
    const id = control.dataset.packId, action = control.dataset.packAction, index = draft.active.indexOf(id);
    if (action === 'enable' && draft.packs.some(pack => pack.id === id) && index < 0) draft.active.unshift(id);
    if (action === 'disable' || action === 'remove') draft.active = draft.active.filter(value => value !== id);
    if (action === 'remove') draft.packs = draft.packs.filter(pack => pack.id !== id);
    if (action === 'up' && index > 0) [draft.active[index - 1], draft.active[index]] = [id, draft.active[index - 1]];
    if (action === 'down' && index >= 0 && index < draft.active.length - 1) [draft.active[index + 1], draft.active[index]] = [id, draft.active[index + 1]];
    error(''); render();
  });
  dialog.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files') && !busy) { event.preventDefault(); dialog.classList.add('pack-drag-over'); } });
  dialog.addEventListener('dragleave', event => { if (!dialog.contains(event.relatedTarget)) dialog.classList.remove('pack-drag-over'); });
  dialog.addEventListener('drop', event => { event.preventDefault(); dialog.classList.remove('pack-drag-over'); importFiles([...event.dataTransfer.files]); });
  document.addEventListener('craftside:language-changed', render);
  if (channel) channel.onmessage = async event => {
    if (event.data?.revision <= saved.revision || busy) return;
    if (dialog.open && changed()) { error('Resource packs changed in another window. Reopen this screen to reload them.'); return; }
    try { await load(); if (dialog.open) { draft = { ...saved, packs: [...saved.packs], active: [...saved.active] }; render(); } } catch (failure) { summaryError = failure.message; summary(); }
  };
  window.addEventListener('pagehide', () => { clearInterval(animationTimer); observer.disconnect(); channel?.close(); });
  load().catch(failure => { summaryError = failure.message; summary(); });
})();
