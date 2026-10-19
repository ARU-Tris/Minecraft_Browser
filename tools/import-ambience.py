"""Copy verified, installed game assets into this project; never change the game."""
from pathlib import Path
from zipfile import ZipFile
import hashlib
import json
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
GAME = Path.home() / 'AppData/Roaming/.minecraft'
DEST = ROOT / 'assets/ambience'
records = []
indexes = {}


def copy_object(index, entry, target):
    if index not in indexes:
        indexes[index] = json.loads((GAME / f'assets/indexes/{index}.json').read_text())['objects']
    item = indexes[index][entry]
    digest = item['hash']
    source = GAME / 'assets/objects' / digest[:2] / digest
    data = source.read_bytes()
    if hashlib.sha1(data).hexdigest() != digest:
        raise ValueError(f'Game asset hash mismatch: {entry}')
    return write(data, target, {'source': 'Installed Minecraft asset', 'assetIndex': index, 'entry': entry, 'sha1': digest})


def write(data, target, provenance):
    path = DEST / target
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    records.append({'path': str(path.relative_to(ROOT)).replace('\\', '/'), 'sha256': hashlib.sha256(data).hexdigest(), **provenance})
    return '../assets/ambience/' + target


manifest = {'backgrounds': {key: [] for key in ['cave', 'day', 'sunset', 'night']}, 'tracks': {}, 'playlists': {}, 'effects': {}}
for period, index, faces in [('cave', '1.17', [0, 1, 2]), ('day', '1.19', [0]), ('day', '26', [0]), ('day', '27', [0]), ('day', '30', [0]), ('sunset', '1.18', [0]), ('sunset', '1.20', [0])]:
    for face in faces:
        src = copy_object(index, f'minecraft/textures/gui/title/background/panorama_{face}.png', f'backgrounds/{period}-{index}-{face}.png')
        manifest['backgrounds'][period].append({'id': f'{period}-{index}-{face}', 'src': src})
with ZipFile(ROOT / 'ref/VanillaTweaks_r106307_MC26.3.x.zip') as pack:
    entry = 'assets/minecraft/textures/gui/title/background/panorama_0.png'
    src = write(pack.read(entry), 'backgrounds/day-village.png', {'source': 'VanillaTweaks_r106307_MC26.3.x.zip', 'entry': entry})
    manifest['backgrounds']['day'].append({'id': 'day-village', 'src': src})
night = ROOT / 'design/evidence/v6/survivenight_header.jpg'
src = write(night.read_bytes(), 'backgrounds/night-forest.jpg', {'source': 'Official Minecraft screenshot', 'url': 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/survivenight_header.jpg', 'article': 'https://www.minecraft.net/en-us/article/how-survive-your-first-night-minecraft'})
manifest['backgrounds']['night'].append({'id': 'night-forest', 'src': src})

playlists = {
    'day': ['minecraft', 'sweden', 'haggstrom', 'clark', 'danny', 'living_mice', 'mice_on_venus', 'subwoofer_lullaby'],
    'sunset': ['sweden', 'mice_on_venus', 'subwoofer_lullaby', 'wet_hands'],
    'night': ['key', 'dry_hands', 'wet_hands', 'oxygene', 'living_mice'],
    'cave': ['ancestry', 'deeper', 'infinite_amethyst', 'floating_dream', 'echo_in_the_wind']
}
for track in sorted({track for tracks in playlists.values() for track in tracks}):
    manifest['tracks'][track] = {'id': track, 'title': track.replace('_', ' ').title(), 'src': copy_object('32', f'minecraft/sounds/music/game/{track}.ogg', f'music/{track}.ogg')}
manifest['playlists'] = playlists
for name, entry in {'click': 'random/click_stereo', 'toastIn': 'ui/toast/in', 'toastOut': 'ui/toast/out', 'challenge': 'ui/toast/challenge_complete'}.items():
    manifest['effects'][name] = [copy_object('32', f'minecraft/sounds/{entry}.ogg', f'sounds/{name}.ogg')]
for material in ['generic', 'leather', 'iron', 'gold', 'diamond', 'netherite', 'copper']:
    entry = f'minecraft/sounds/item/armor/equip_{material}1.ogg'
    if entry in indexes['32']:
        manifest['effects']['equip_' + material] = [copy_object('32', entry, f'sounds/equip_{material}.ogg')]
manifest['effects']['cave'] = [copy_object('32', f'minecraft/sounds/ambient/cave/cave{i}.ogg', f'sounds/cave{i}.ogg') for i in range(1, 24)]
with ZipFile(GAME / 'versions/26.2/26.2.jar') as jar:
    entry = 'assets/minecraft/textures/gui/sprites/toast/advancement.png'
    manifest['toast'] = write(jar.read(entry), 'gui/advancement.png', {'source': 'Minecraft 26.2 client', 'entry': entry})
DEST.mkdir(parents=True, exist_ok=True)
(DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
(DEST / 'manifest.js').write_text('window.CraftAmbienceAssets = ' + json.dumps(manifest, separators=(',', ':')) + ';\n', encoding='utf-8')
(DEST / 'sources.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
print(json.dumps({'copied': len(records), 'musicTracks': len(manifest['tracks']), 'bytes': sum((ROOT / item['path']).stat().st_size for item in records)}))
