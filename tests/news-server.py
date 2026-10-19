"""Check news normalization, cache behavior and the real loopback integration."""
import importlib.util
from pathlib import Path
import json
import unittest
from unittest.mock import patch
import requests

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('serve', ROOT / 'tools/serve.py')
serve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(serve)


class NewsTests(unittest.TestCase):
    def setUp(self):
        serve._cache, serve._cached_at = None, 0

    def test_only_official_articles_survive(self):
        payload = {'result': {'results': [
            {'title': 'Official', 'url': 'https://www.minecraft.net/en-us/article/test?ref=a', 'time': 100},
            {'title': 'Other', 'url': 'https://elsewhere.example/article/test', 'time': 101},
            {'title': 'Credentials', 'url': 'https://user:pass@minecraft.net/article/test', 'time': 102},
            {'title': 'HTTP', 'url': 'http://minecraft.net/article/test', 'time': 103},
        ]}}
        self.assertEqual(serve.normalize_news(payload), [{'title': 'Official', 'url': 'https://www.minecraft.net/en-us/article/test', 'published': 100}])

    def test_empty_response_is_failure(self):
        with self.assertRaises(ValueError):
            serve.normalize_news({'result': {'results': []}})

    def test_cache_and_offline_stale_flag(self):
        class Response:
            content = b'{}'
            def raise_for_status(self): pass
            def json(self): return {'result': {'results': [{'title': 'News', 'url': 'https://www.minecraft.net/en-us/article/test', 'time': 100}]}}
        with patch.object(serve.requests, 'get', return_value=Response()) as get:
            first = serve.fetch_news()
            self.assertIs(serve.fetch_news(), first)
            self.assertEqual(get.call_count, 1)
        serve._cached_at = -1000000
        with patch.object(serve.requests, 'get', side_effect=requests.ConnectionError()):
            self.assertTrue(serve.fetch_news()['stale'])
            self.assertEqual(serve.fetch_news()['articles'], first['articles'])

    def test_live_preview_feed(self):
        response = requests.get('http://127.0.0.1:43127/api/minecraft-news', timeout=20)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data['stale'])
        self.assertGreater(len(data['articles']), 0)
        self.assertTrue(all(item['url'].startswith('https://www.minecraft.net/') for item in data['articles']))
        (ROOT / 'design/evidence/v6/news-live.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    unittest.main()
