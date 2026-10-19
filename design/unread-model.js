(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./ambience-model.js') : root.CraftAmbienceModel);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CraftUnreadModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (newsModel) {
  'use strict';
  const KEY = 'craftside:unread:v1';
  function kindForURL(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
      if (url.hostname === 'mail.google.com') return 'gmail';
      if (['minecraft.net', 'www.minecraft.net'].includes(url.hostname) && /^\/(?:[a-z]{2}-[a-z]{2}\/)?article\/?$/i.test(url.pathname)) return 'news';
    } catch { /* Non-web and invalid URLs do not acquire notification state. */ }
    return null;
  }
  function parse(raw) {
    if (raw === null) return { schema: 1, news: [] };
    const data = JSON.parse(raw);
    if (data?.schema !== 1 || !Array.isArray(data.news)) throw Error('Invalid unread state');
    const news = data.news.map(newsModel.safeArticle);
    if (news.some(item => !item) || new Set(news.map(item => item.id)).size !== news.length) throw Error('Invalid unread articles');
    return { schema: 1, news };
  }
  class Store {
    constructor(storage) {
      this.storage = storage; this.data = { schema: 1, news: [] }; this.error = false; this.readOnly = false;
      try { this.data = parse(storage.getItem(KEY)); } catch { this.error = true; this.readOnly = true; }
    }
    change(action) {
      // Merge a second window's latest read acknowledgements before any local write.
      if (!this.error) { try { this.data = parse(this.storage.getItem(KEY)); } catch { this.error = true; this.readOnly = true; } }
      action(this.data);
      try { if (this.readOnly) throw Error(); this.storage.setItem(KEY, JSON.stringify(this.data)); this.error = false; }
      catch { this.error = true; }
    }
    receive(articles) {
      const valid = articles.map(newsModel.safeArticle).filter(Boolean); if (!valid.length) return;
      this.change(data => { data.news = [...new Map([...data.news, ...valid].map(item => [item.id, item])).values()]; });
    }
    readAllNews() { this.change(data => { data.news = []; }); }
    readArticle(url) {
      const article = newsModel.safeArticle({ url, title: 'Article' }); if (!article) return;
      this.change(data => { data.news = data.news.filter(item => item.id !== article.id); });
    }
    refresh() { try { this.data = parse(this.storage.getItem(KEY)); this.error = this.readOnly = false; } catch { this.error = true; this.readOnly = true; } }
    get newsCount() { return this.data.news.length; }
  }
  function gmailState(value) {
    const status = ['signed-in', 'signed-out', 'unavailable', 'unknown'].includes(value?.status) ? value.status : 'unknown';
    const count = Number.isSafeInteger(value?.unread) && value.unread >= 0 ? value.unread : null;
    return { status: status === 'signed-in' && count === null ? 'unknown' : status, unread: status === 'signed-in' ? count : null };
  }
  return { key: KEY, kindForURL, parse, Store, gmailState };
});
