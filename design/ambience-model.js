(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CraftAmbienceModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEY = 'craftside:ambience:v1', NEWS_KEY = 'craftside:news:v1';
  const defaults = { effects: true, effectsVolume: .4, music: true, musicVolume: .22, news: true };
  const clamp = (value, fallback) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  function preferences(raw) {
    let value; try { value = JSON.parse(raw); } catch { value = {}; }
    value = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof fallback === 'boolean' ? (typeof value[key] === 'boolean' ? value[key] : fallback) : clamp(value[key], fallback)]));
  }
  function schedule(date = new Date()) {
    const hour = date.getHours();
    const period = hour < 6 ? 'cave' : hour < 18 ? 'day' : hour < 20 ? 'sunset' : 'night';
    const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const slot = period === 'day' ? Math.floor((hour - 6) / 2) : 0;
    return { period, slot, key: `${day}:${period}:${slot}`, day };
  }
  function hash(text) { let value = 2166136261; for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return value >>> 0; }
  function background(date, assets) {
    const state = schedule(date), images = assets.backgrounds[state.period];
    // Seeded daily shuffle: stable through reload and distinct across adjacent two-hour slots.
    const shuffled = [...images]; let seed = hash(state.day + state.period);
    for (let index = shuffled.length - 1; index > 0; index--) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const other = seed % (index + 1); [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]; }
    return { ...state, image: shuffled[state.slot % shuffled.length] };
  }
  function chooseTrack(ids, previous, random = Math.random) {
    const available = ids.filter(id => id !== previous);
    const choices = available.length ? available : ids;
    return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
  }
  function caveDelay(random = Math.random) { return (7 + random() * 9) * 60 * 1000; }
  function safeArticle(article) {
    if (!article || typeof article.title !== 'string' || !article.title.trim() || typeof article.url !== 'string') return null;
    try {
      const url = new URL(article.url);
      if (url.protocol !== 'https:' || !['www.minecraft.net', 'minecraft.net'].includes(url.hostname) || url.username || url.password || !/^\/(?:[a-z]{2}-[a-z]{2}\/)?article\/[a-z\d-]+\/?$/i.test(url.pathname)) return null;
      url.search = ''; url.hash = '';
      return { id: url.pathname.replace(/^\/[a-z]{2}-[a-z]{2}/i, '').replace(/\/$/, ''), title: article.title.trim().slice(0, 240), url: url.href, published: Number.isFinite(article.published) ? article.published : 0 };
    } catch { return null; }
  }
  function newsState(raw) {
    try { const data = JSON.parse(raw); if (data?.schema === 1 && Array.isArray(data.seen) && data.seen.every(id => typeof id === 'string') && Number.isFinite(data.watermark)) return data; } catch { /* A fresh baseline never announces the whole archive. */ }
    return null;
  }
  function ingestNews(articles, previous, enabled = true) {
    const valid = [...new Map(articles.map(safeArticle).filter(Boolean).sort((a, b) => b.published - a.published).map(item => [item.id, item])).values()];
    if (!valid.length) return { state: previous, fresh: [], discovered: [], articles: [] };
    const seen = new Set(previous?.seen || []), watermark = previous?.watermark || 0;
    const discovered = previous && enabled ? valid.filter(item => !seen.has(item.id) && item.published >= watermark) : [];
    const fresh = discovered.slice(0, 3).reverse();
    const state = { schema: 1, watermark: Math.max(watermark, ...valid.map(item => item.published)), seen: [...new Set([...valid.map(item => item.id), ...seen])].slice(0, 300) };
    return { state, fresh, discovered, articles: valid };
  }
  return { key: KEY, newsKey: NEWS_KEY, defaults, preferences, schedule, background, chooseTrack, caveDelay, safeArticle, newsState, ingestNews };
});
