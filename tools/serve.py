"""Loopback-only design server plus a cached, read-only official Minecraft news feed."""
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import argparse
import json
import threading
import time
import requests

ROOT = Path(__file__).resolve().parents[1]
NEWS_SOURCE = 'https://net-secondary.web.minecraft-services.net/api/v1.0/en-us/search'
NEWS_PARAMS = {'page': 1, 'pageSize': 24, 'category': 'News', 'sortType': 'Recent', 'newsOnly': 'true'}
CACHE_SECONDS = 15 * 60
_cache = None
_cached_at = 0
_lock = threading.Lock()


def normalize_news(payload):
    articles = []
    for item in payload.get('result', {}).get('results', []):
        url = urlparse(str(item.get('url', '')))
        title, stamp = item.get('title'), item.get('time')
        if (url.scheme != 'https' or url.hostname not in ('www.minecraft.net', 'minecraft.net')
                or url.username or url.password or '/article/' not in url.path
                or not isinstance(title, str) or not title.strip()
                or not isinstance(stamp, (float, int))):
            continue
        articles.append({'title': title.strip()[:240], 'url': url._replace(query='', fragment='').geturl(), 'published': stamp})
    if not articles:
        raise ValueError('No valid articles in the official response')
    return sorted(articles, key=lambda item: item['published'], reverse=True)


def fetch_news():
    global _cache, _cached_at
    with _lock:
        if _cache and time.monotonic() - _cached_at < CACHE_SECONDS:
            return _cache
        try:
            response = requests.get(NEWS_SOURCE, params=NEWS_PARAMS, headers={'User-Agent': 'CRAFTSIDE-Local-Design/0.6', 'Accept': 'application/json'}, timeout=(5, 10))
            response.raise_for_status()
            if len(response.content) > 1024 * 1024:
                raise ValueError('Unexpectedly large news response')
            result = {'source': 'https://www.minecraft.net/en-us/article', 'checkedAt': datetime.now(timezone.utc).isoformat(), 'stale': False, 'articles': normalize_news(response.json())}
            _cache, _cached_at = result, time.monotonic()
            return result
        except (requests.RequestException, ValueError, TypeError, AttributeError):
            if _cache:
                return {**_cache, 'stale': True}
            raise


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/minecraft-news':
            try:
                body, status = fetch_news(), 200
            except (requests.RequestException, ValueError, TypeError, AttributeError):
                body, status = {'error': 'Official Minecraft News is temporarily unavailable', 'articles': []}, 503
            encoded = json.dumps(body, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(encoded)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            self.wfile.write(encoded)
            return
        if path.startswith('/api/'):
            self.send_error(404)
            return
        return super().do_GET()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=43127)
    args = parser.parse_args()
    httpd = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT)))
    print(f'CRAFTSIDE: http://127.0.0.1:{args.port}/design/', flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.server_close()
