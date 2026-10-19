(() => {
  'use strict';
  const $ = selector => document.querySelector(selector), $$ = selector => [...document.querySelectorAll(selector)];
  const model = window.CraftAmbienceModel, assets = window.CraftAmbienceAssets;
  const t = (text, values) => window.CraftI18n.t(text, values);
  let storage; try { storage = localStorage; } catch { storage = null; }
  const read = key => { try { return storage?.getItem(key) || null; } catch { return null; } };
  let prefs = model.preferences(read(model.key)), newsMemory = model.newsState(read(model.newsKey));
  let unlocked = false, period = '', currentBackground = null, currentTrack = null, active = null, loading = false, musicError = false;
  let epoch = 0, gapTimer = null, caveTimer = null, newsTimer = null, toastTimer = null, toastHideTimer = null, newsBusy = false, latestArticles = [], checkedAt = null, newsError = false;
  const fades = new Map(), effectPlayers = new Set(), history = [], newsQueue = [], backgroundJobs = new WeakMap();
  const periodNames = { cave: 'Cave', day: 'Daylight', sunset: 'Sunset', night: 'Night' };
  const audioNodes = [0, 1].map(index => {
    const audio = document.createElement('audio'); audio.dataset.bgmChannel = String(index); audio.preload = 'none'; audio.hidden = true; audio.volume = 0;
    audio.addEventListener('ended', () => {
      if (audio !== active || !prefs.music) return;
      clearTimeout(gapTimer);
      gapTimer = setTimeout(() => { gapTimer = null; if (prefs.music) playTrack(); }, (8 + Math.random() * 14) * 1000);
      updateControls();
    });
    document.body.append(audio); return audio;
  });
  function stopFade(audio) { const id = fades.get(audio); if (id) clearInterval(id); fades.delete(audio); }
  function fade(audio, target, duration, done) {
    stopFade(audio); const start = performance.now(), initial = audio.volume;
    const timer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / duration), eased = progress * progress * (3 - 2 * progress);
      audio.volume = Math.max(0, Math.min(1, initial + (target - initial) * eased));
      if (progress >= 1) { stopFade(audio); done?.(); }
    }, 40);
    fades.set(audio, timer);
  }
  function savePreference(key, value) {
    prefs = { ...prefs, [key]: value };
    try { if (!storage) throw Error(); storage.setItem(model.key, JSON.stringify(prefs)); $('#ambience-error').hidden = true; }
    catch { $('#ambience-error').textContent = t('Could not save sound settings. Changes apply for this session.'); $('#ambience-error').hidden = false; }
    updateControls(); return true;
  }
  function sound(name, level = 1) {
    if (!unlocked || !prefs.effects || prefs.effectsVolume === 0) return;
    const choices = assets.effects[name] || (name.startsWith('equip_') ? assets.effects.equip_generic : assets.effects.click), audio = document.createElement('audio');
    audio.src = choices[Math.floor(Math.random() * choices.length)]; audio.volume = Math.min(1, prefs.effectsVolume * level); audio.hidden = true; audio.dataset.soundEffect = name;
    const cleanup = () => { effectPlayers.delete(audio); audio.remove(); };
    audio.addEventListener('ended', cleanup, { once: true }); audio.addEventListener('error', cleanup, { once: true });
    effectPlayers.add(audio); document.body.append(audio); audio.play().catch(cleanup);
  }
  function stopEffects() { for (const audio of effectPlayers) { audio.pause(); audio.remove(); } effectPlayers.clear(); }
  async function playTrack(id = null, duration = 4000, resume = false) {
    if (!unlocked || !prefs.music) return;
    clearTimeout(gapTimer); gapTimer = null;
    const playlist = assets.playlists[period], token = ++epoch;
    id = id || model.chooseTrack(playlist, currentTrack);
    if (!assets.tracks[id]) return;
    const previous = active, audio = resume && active && !active.ended && id === currentTrack ? active : audioNodes.find(node => node !== active);
    stopFade(audio);
    if (audio !== previous || !resume) { audio.pause(); audio.src = assets.tracks[id].src; audio.load(); }
    audio.dataset.playToken = String(token); audio.volume = 0; loading = true; musicError = false; updateControls();
    try {
      await audio.play();
      if (token !== epoch || !prefs.music) { if (audio.dataset.playToken === String(token)) audio.pause(); return; }
      active = audio; currentTrack = id; loading = false;
      if (history[history.length - 1] !== id) history.push(id);
      if (history.length > 50) history.shift();
      fade(audio, prefs.musicVolume, duration);
      if (previous && previous !== audio) fade(previous, 0, duration, () => previous.pause());
      updateControls();
    } catch {
      if (token !== epoch) return;
      loading = false; musicError = true; updateControls();
    }
  }
  function stopMusic() {
    epoch++; loading = false; clearTimeout(gapTimer); gapTimer = null;
    audioNodes.forEach(audio => fade(audio, 0, 450, () => audio.pause())); scheduleCave(); updateControls();
  }
  function updateControls() {
    const title = assets.tracks[currentTrack]?.title || 'Minecraft';
    $('#music-title').textContent = title;
    const playing = prefs.music && unlocked && !musicError && Boolean(loading || gapTimer || active && !active.paused);
    const status = !prefs.music ? 'Music off' : !unlocked ? 'Click anywhere to start' : musicError ? 'Could not play · press Play to retry' : loading ? 'Loading music…' : active?.ended ? 'A quiet moment between tracks' : 'Playing softly';
    $('#music-status').textContent = t(status);
    const label = t(playing ? 'Pause music' : 'Play music');
    $('#music-toggle').setAttribute('aria-label', label); $('#music-toggle').title = label; $('#music-toggle').setAttribute('aria-pressed', String(playing));
    $('#music-toggle span').textContent = playing ? 'Ⅱ' : '▶';
    $('#music-volume').value = Math.round(prefs.musicVolume * 100);
    $('#settings-effects').checked = prefs.effects; $('#settings-effects-volume').value = Math.round(prefs.effectsVolume * 100);
    $('#effects-volume-value').textContent = Math.round(prefs.effectsVolume * 100) + '%';
    $('#settings-news').checked = prefs.news;
    $('#world-period').textContent = t(periodNames[period] || 'Daylight');
    $('#news-status').textContent = t(newsError ? 'News unavailable. Will retry automatically.' : checkedAt ? 'News checked at {time}' : 'Checking Minecraft News…', { time: checkedAt ? new Intl.DateTimeFormat(window.CraftI18n.language, { hour: '2-digit', minute: '2-digit' }).format(checkedAt) : '' });
  }
  function dateForWorld() {
    const date = new Date(), preview = $('#world-preview').value;
    if (preview !== 'auto') date.setHours({ cave: 2, day: 12, sunset: 19, night: 22 }[preview], 0, 0, 0);
    return date;
  }
  function syncBackground(root) {
    const container = root.querySelector('.world-backdrop'); if (!container || !currentBackground) return;
    const resourceRevision = window.CraftResources?.revision || 0;
    const backgroundId = currentBackground.image.id + ':' + resourceRevision;
    if (container.dataset.background === backgroundId) return;
    const job = (backgroundJobs.get(container) || 0) + 1; backgroundJobs.set(container, job);
    const layers = [...container.querySelectorAll('.world-layer')], previous = layers.find(layer => layer.classList.contains('is-visible'));
    const incoming = layers.find(layer => layer !== previous), image = currentBackground.image;
    incoming.onload = () => {
      if (backgroundJobs.get(container) !== job) return;
      incoming.classList.add('is-visible'); previous?.classList.remove('is-visible');
      container.dataset.background = backgroundId; root.dataset.world = period;
    };
    incoming.onerror = () => { /* Keep the previous loaded image, including during an offline switch. */ };
    incoming.src = window.CraftResources?.worldSource(image.src, period) || image.src;
    if (incoming.complete && incoming.naturalWidth) incoming.onload();
  }
  function syncWorld() {
    const next = model.background(dateForWorld(), assets), changed = next.period !== period;
    period = next.period; currentBackground = next;
    $$('.home-site').forEach(syncBackground);
    $('#world-clock').textContent = new Intl.DateTimeFormat(window.CraftI18n.language, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    $('#world-clock').dateTime = new Date().toISOString();
    updateControls();
    if (changed) { scheduleCave(); if (unlocked && prefs.music) playTrack(null, 6000); }
  }
  function scheduleCave() {
    clearTimeout(caveTimer); caveTimer = null;
    if (period !== 'cave' || !prefs.music || !prefs.effects || !unlocked) return;
    caveTimer = setTimeout(() => {
      if (period === 'cave' && !document.hidden && $$('.home-site').some(site => site.isConnected && site.getBoundingClientRect().width > 0)) sound('cave', .45);
      scheduleCave();
    }, model.caveDelay());
  }
  function unlock(event) {
    if (unlocked || !event.isTrusted) return;
    unlocked = true;
    const explicitControl = event.target.closest('#music-toggle,#music-next,#music-previous');
    if (prefs.music && !explicitControl) playTrack();
    scheduleCave(); showQueuedNews(); updateControls();
  }
  function hideNews() {
    clearTimeout(toastTimer); clearTimeout(toastHideTimer);
    const toast = $('#news-toast');
    if (toast.hidden) return;
    toast.classList.remove('is-visible'); sound('toastOut', .4);
    document.dispatchEvent(new CustomEvent('craftside:advancement', { detail: { hide: true } }));
    toastHideTimer = setTimeout(() => { toast.hidden = true; showQueuedNews(); }, 650);
  }
  function showQueuedNews() {
    const toast = $('#news-toast');
    if (!unlocked || document.hidden || !toast.hidden || !newsQueue.length) return;
    const article = newsQueue.shift();
    if (!prefs.news && !article.preview) { showQueuedNews(); return; }
    $('#news-toast-title').textContent = article.preview ? t('Preview · {title}', { title: article.title }) : article.title;
    $('#news-toast-heading').textContent = t('Advancement Made!'); $('#news-toast-link').href = article.url;
    toast.dataset.preview = String(Boolean(article.preview)); toast.hidden = false;
    document.dispatchEvent(new CustomEvent('craftside:advancement', { detail: { hide: false } }));
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('is-visible')));
    sound('toastIn', .4); setTimeout(() => { if (!toast.hidden && toast.classList.contains('is-visible')) sound('challenge', .45); }, 400);
    toastTimer = setTimeout(hideNews, 5600);
  }
  async function checkNews() {
    if (newsBusy) return; newsBusy = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/minecraft-news', { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw Error();
      const payload = await response.json();
      if (!Array.isArray(payload.articles) || payload.stale) throw Error();
      let previous = newsMemory;
      try { previous = model.newsState(storage?.getItem(model.newsKey)) || previous; } catch { /* Use this session's last successful baseline. */ }
      const result = model.ingestNews(payload.articles, previous, prefs.news);
      if (!result.articles.length) throw Error();
      if (result.discovered.length) document.dispatchEvent(new CustomEvent('craftside:news-received', { detail: { articles: result.discovered } }));
      newsMemory = result.state; latestArticles = result.articles;
      try { storage?.setItem(model.newsKey, JSON.stringify(result.state)); } catch { /* The in-memory baseline still prevents repeat alerts in this session. */ }
      newsQueue.push(...result.fresh); showQueuedNews(); checkedAt = new Date(); newsError = false;
    } catch { newsError = true; }
    finally { clearTimeout(timeout); newsBusy = false; updateControls(); }
  }
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', event => { if (!event.ctrlKey && !event.metaKey && !event.altKey) unlock(event); }, true);
  document.addEventListener('click', event => {
    unlock(event);
    const button = event.target.closest('.sidebar button,#edge-handle,.inventory-native .crafting-grid button,.native-output,.creative-grid button,.creative-tabs button');
    if (button && !button.disabled) sound('click', .65);
  }, true);
  document.addEventListener('craftside:inventory-sound', event => sound(event.detail.type === 'equip' ? 'equip_' + (event.detail.material || 'generic') : 'click', event.detail.type === 'equip' ? .7 : .3));
  $('#music-toggle').addEventListener('click', () => {
    if (prefs.music && !musicError && (loading || gapTimer || active && !active.paused)) { if (savePreference('music', false)) stopMusic(); }
    else if (savePreference('music', true)) { playTrack(assets.playlists[period].includes(currentTrack) ? currentTrack : null, 2500, true); scheduleCave(); }
  });
  $('#music-next').addEventListener('click', () => { if (savePreference('music', true)) { playTrack(null, 2000); scheduleCave(); } });
  $('#music-previous').addEventListener('click', () => {
    if (!savePreference('music', true)) return;
    if (history.length > 1) history.pop();
    const prior = history[history.length - 1]; playTrack(assets.playlists[period].includes(prior) ? prior : null, 2000); scheduleCave();
  });
  $('#music-volume').addEventListener('input', event => { if (savePreference('musicVolume', Number(event.target.value) / 100)) audioNodes.forEach(audio => { if (audio === active && !audio.paused && prefs.music) fade(audio, prefs.musicVolume, 180); else if (prefs.musicVolume === 0) fade(audio, 0, 180, () => audio.pause()); }); });
  $('#settings-effects').addEventListener('change', event => { if (savePreference('effects', event.target.checked)) { if (!prefs.effects) stopEffects(); else sound('click', .65); scheduleCave(); } });
  $('#settings-effects-volume').addEventListener('input', event => { if (savePreference('effectsVolume', Number(event.target.value) / 100)) { if (!prefs.effectsVolume) stopEffects(); else for (const audio of effectPlayers) audio.volume = Math.min(audio.volume, prefs.effectsVolume); } });
  $('#test-sound').addEventListener('click', () => sound('click', .65));
  $('#settings-news').addEventListener('change', event => { if (savePreference('news', event.target.checked) && !prefs.news) { newsQueue.length = 0; hideNews(); } });
  $('#preview-news-alert').addEventListener('click', () => {
    $('#settings-dialog').close();
    newsQueue.push({ ...(latestArticles[0] || { title: t('Minecraft News'), url: 'https://www.minecraft.net/en-us/article' }), preview: true }); showQueuedNews();
  });
  $('#dismiss-news').addEventListener('click', hideNews);
  $('#news-toast').addEventListener('pointerenter', () => clearTimeout(toastTimer));
  $('#news-toast').addEventListener('pointerleave', () => { if (!$('#news-toast').hidden) toastTimer = setTimeout(hideNews, 2500); });
  $('#news-toast').addEventListener('focusin', () => clearTimeout(toastTimer));
  $('#news-toast').addEventListener('focusout', () => { toastTimer = setTimeout(hideNews, 2500); });
  $('#world-preview').addEventListener('change', syncWorld);
  document.addEventListener('craftside:language-changed', () => { updateControls(); syncWorld(); });
  document.addEventListener('craftside:resources-changed', () => { syncWorld(); stopEffects(); if (unlocked && prefs.music && currentTrack && active && !active.paused) playTrack(currentTrack, 1500); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { syncWorld(); showQueuedNews(); if (!checkedAt || Date.now() - checkedAt.getTime() >= 15 * 60 * 1000) checkNews(); } });
  window.addEventListener('online', checkNews);
  window.addEventListener('storage', event => {
    if (event.key !== model.key) return;
    const previous = prefs; prefs = model.preferences(event.newValue);
    if (!prefs.effects) stopEffects();
    if (!prefs.music) stopMusic(); else if (!previous.music && unlocked) playTrack();
    if (active && prefs.music && !active.paused) fade(active, prefs.musicVolume, 300);
    scheduleCave(); updateControls();
  });
  const observer = new MutationObserver(records => { if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches('.home-site') || node.querySelector('.home-site'))))) $$('.home-site').forEach(syncBackground); });
  observer.observe($('#web-viewport'), { childList: true, subtree: true });
  window.addEventListener('pagehide', () => { epoch++; audioNodes.forEach(audio => { stopFade(audio); audio.pause(); }); stopEffects(); clearTimeout(gapTimer); clearTimeout(caveTimer); clearInterval(newsTimer); observer.disconnect(); });
  syncWorld(); checkNews();
  setInterval(syncWorld, 30000); newsTimer = setInterval(() => { if (!document.hidden) checkNews(); }, 15 * 60 * 1000);
})();
