(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./locales.js') : root.CraftLocales);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    let storage;
    try { storage = root.localStorage; } catch { storage = null; }
    root.CraftI18n = api.create(storage);
    api.bind(root.CraftI18n, root.document, root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (messages) {
  'use strict';
  const KEY = 'craftside:language:v1';
  const normalize = value => value.trim().replace(/\s+/gu, ' ');
  const lookup = new Map();
  for (const [en, ko] of Object.entries(messages)) {
    for (const value of [en, ko]) if (!lookup.has(normalize(value))) lookup.set(normalize(value), { en, ko });
  }
  function create(storage) {
    let language = 'en';
    try { if (storage?.getItem(KEY) === 'ko') language = 'ko'; } catch { /* English is always the default. */ }
    const listeners = new Set();
    const api = {
      get language() { return language; },
      key: KEY,
      t(source, values = {}) {
        const text = String(source ?? ''), match = text.match(/^(\s*)([\s\S]*?)(\s*)$/u);
        const pair = lookup.get(normalize(text));
        const result = pair ? match[1] + pair[language] + match[3] : text;
        return result.replace(/\{([a-zA-Z]+)\}/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token);
      },
      itemName(item) { return language === 'ko' ? item.nameKo || item.name : item.name; },
      setLanguage(next, persist = true) {
        if (!['en', 'ko'].includes(next)) throw Error('Unsupported language');
        if (persist) {
          try { if (!storage) throw Error('Storage unavailable'); storage.setItem(KEY, next); }
          catch { throw Error(api.t('Could not save the language preference. Your previous language was kept.')); }
        }
        if (language === next) return;
        language = next; listeners.forEach(listener => listener(next));
      },
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
    };
    return api;
  }
  function bind(api, document, window) {
    const attrs = ['aria-label', 'title', 'placeholder', 'alt'];
    const skip = element => !element || element.closest('script,style,textarea,[contenteditable="true"],[data-user-content],[data-i18n-skip]');
    function text(node) {
      if (skip(node.parentElement)) return;
      const value = api.t(node.nodeValue);
      if (node.nodeValue !== value) node.nodeValue = value;
    }
    function attributes(element, name = null) {
      if (skip(element)) return;
      for (const attr of name ? [name] : attrs) {
        if (!element.hasAttribute(attr)) continue;
        const value = api.t(element.getAttribute(attr));
        if (element.getAttribute(attr) !== value) element.setAttribute(attr, value);
      }
    }
    function apply(root = document) {
      if (root.nodeType === 3) { text(root); return; }
      if (root.nodeType === 1) attributes(root);
      const walker = document.createTreeWalker(root, window.NodeFilter.SHOW_ELEMENT | window.NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) { if (node.nodeType === 3) text(node); else attributes(node); }
    }
    api.apply = apply;
    const select = document.querySelector('#settings-language'), error = document.querySelector('#language-error');
    function refresh() {
      document.documentElement.lang = api.language;
      select.value = api.language;
      apply();
      document.dispatchEvent(new window.CustomEvent('craftside:language-changed', { detail: { language: api.language } }));
    }
    select.addEventListener('change', () => {
      error.hidden = true;
      try { api.setLanguage(select.value); } catch (failure) { select.value = api.language; error.textContent = failure.message; error.hidden = false; }
    });
    api.subscribe(refresh);
    const observer = new window.MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') text(record.target);
        else if (record.type === 'attributes') attributes(record.target, record.attributeName);
        else record.addedNodes.forEach(apply);
      }
    });
    refresh();
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attrs });
    window.addEventListener('storage', event => { if (event.key === KEY) api.setLanguage(event.newValue === 'ko' ? 'ko' : 'en', false); });
  }
  return { create, bind, key: KEY, messages };
});
