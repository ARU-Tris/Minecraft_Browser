'use strict';
const ENDPOINT = 'https://net-secondary.web.minecraft-services.net/api/v1.0/en-us/search?page=1&pageSize=24&category=News&sortType=Recent&newsOnly=true';
function normalize(payload) {
  const articles = [];
  for (const item of payload?.result?.results || []) {
    let url; try { url = new URL(item.url); } catch { continue; }
    if (url.protocol !== 'https:' || !['www.minecraft.net','minecraft.net'].includes(url.hostname) || url.username || url.password || !url.pathname.includes('/article/') || typeof item.title !== 'string' || !item.title.trim() || !Number.isFinite(item.time)) continue;
    url.search = ''; url.hash = '';
    articles.push({ title: item.title.trim().slice(0,240), url: url.href, published: item.time });
  }
  if (!articles.length) throw Error('Official Minecraft News is temporarily unavailable');
  return articles.sort((a,b) => b.published-a.published);
}
function create(fetcher) {
  let cached, time = 0, pending;
  return async () => {
    if (cached && Date.now()-time < 900000) return cached;
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetcher(ENDPOINT, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
        if (!response.ok) throw Error('News unavailable');
        const bytes = await response.arrayBuffer(); if (bytes.byteLength > 1048576) throw Error('News response too large');
        cached = { source: 'https://www.minecraft.net/en-us/article', checkedAt: new Date().toISOString(), stale: false, articles: normalize(JSON.parse(Buffer.from(bytes).toString('utf8'))) }; time = Date.now(); return cached;
      } catch (error) { if (cached) return { ...cached, stale: true }; throw error; }
      finally { pending = null; }
    })();
    return pending;
  };
}
module.exports = { normalize, create };
