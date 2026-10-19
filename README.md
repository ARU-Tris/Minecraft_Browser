# MINECRAFT? · Minecraft 스타일 브라우저

[Windows x64 설치파일](https://github.com/ARU-Tris/Minecraft_Browser/releases/latest) · [Chrome 데이터 이전 안내](docs/CHROME-IMPORT.md) · [0.2.0 검증 범위](docs/VERIFICATION-0.2.0.md)

릴리스의 `Minecraft-Browser-Setup-0.2.0-x64.exe`를 내려받아 설치합니다. 소스를 실행하려면 Node.js 24에서 `npm ci`, `npm start`를 실행합니다. 기본 리소스는 포함되어 있어 Minecraft 설치나 별도의 `ref` 폴더는 필요 없습니다. 아래 `design/evidence/` 경로의 원본 검증 캡처와 테스트 프로필은 로컬 작업 자료이며 저장소에 포함하지 않습니다.

현재 단계는 **Windows 설치 가능한 네이티브 브라우저 0.2.0**입니다. 브라우저 표시 이름은 **MINECRAFT?**입니다. 설정에서 인벤토리 크기를 75~225%로 조절하며 기본은 150%입니다. 같은 탭 상태의 중복 갱신과 플레이어의 임시 캔버스 생성을 줄였습니다. Chrome 암호 CSV와 쿠키·북마크 이전 기능을 추가했습니다. 설치본의 기본 리소스팩은 제공받은 Vanilla Tweaks 원본입니다.

`npm install` 후 `npm start`로 실행하고, `npm test`와 `npm run test:native`로 점검합니다. `MC_SMOKE_SUITE=navigation` 환경변수로 실제 클릭/입력 → IPC → 외부 사이트/검색 결과 경로를 검사합니다. `MC_SMOKE_SUITE=experience`는 크기 설정·암호화 저장·명시적 로그인 입력·쿠키 이전을 시험용 데이터로 검사합니다. `npm run build:installer`가 `release/Minecraft-Browser-Setup-0.2.0-x64.exe`를 생성합니다. 기본 팩과 필터 엔진은 저장소에 포함되어 별도 서버나 Python이 필요 없습니다. 사용법과 제한은 [Chrome 데이터 이전 안내](docs/CHROME-IMPORT.md)와 [배포 안내](docs/RELEASE.md)에 기록합니다.

3차 시안은 제공한 VanillaTweaks 인벤토리 GUI·핫바·파노라마, 설치된 Minecraft 26.2의 실제 아이템·갑옷 텍스처, 사용자 `ARU_Tris.png` 스킨을 사용합니다. 북마크 아이템의 이동·추가·편집·삭제·장비 착용이 저장되며, 공통 사이드바를 쓰는 듀얼 뷰를 유지합니다.

4차 시안은 지정한 11개 사이트와 고정 도구 아이콘으로 정리했습니다. 첫 줄은 Pinterest·Google 지도·YouTube·NAVER·ChatGPT, 둘째 줄은 학교·Gmail·SKKU 구름, 핫바는 GitHub·Minecraft·지정한 YouTube 영상입니다. 추가·편집의 **아이콘 지정**에서 실제 크리에이티브 GUI로 852종의 아이템/블록을 검색·분류해 고릅니다.

5차 시안은 **영어가 기본**입니다. **Settings → Language → 한국어**에서 즉시 바꾸고 새로고침 후에도 유지합니다. 사이드바·대화상자·아이템 이름·툴팁·안내/오류 문구·설계 예시를 함께 전환하며, 사용자 사이트 이름·주소·파일명·입력값은 보존합니다. 플레이어는 마우스를 따라 머리와 몸을 함께 돌리고, 몸은 더 작은 각도로 조금 늦게 따라옵니다.

아래의 콘셉트 기록과 `python tools/serve.py`는 웹 시안에 관한 설명입니다. 웹 시안은 외부 사이트를 일반 브라우저에서 열며 네이티브 설치본과 저장 프로필이 다릅니다. 설치본에서는 자체 엔진으로 웹사이트를 엽니다. 계정 로그인·유튜브 광고 차단·DRM 재생은 실제 서비스로 확인되지 않았습니다. 영구 방문 기록과 종료 후 탭 복원은 아직 없습니다.

6차 시안은 실제 게임 효과음·17곡의 음악·시간대별 배경과 공식 Minecraft News를 연결했습니다. 아래쪽 Add site 버튼은 제거했고 제작대/빈칸/설정에서 사이트를 추가합니다. 핫바 9번은 물 양동이 → Minecraft News이며 기존 사용자 배치는 백업 후 유지합니다.

## 열어보기

음악·배경은 별도 빌드가 필요하지 않습니다. 공식 뉴스까지 확인하려면 아래의 개발 서버를 사용합니다. 현재 개발 환경에는 Python과 requests가 설치되어 있습니다.

로컬 서버로 볼 경우 프로젝트 폴더에서 다음을 실행합니다.

```powershell
python tools/serve.py --port 43127
```

이후 `http://127.0.0.1:43127/design/`로 접속합니다. Python은 시안 제작에 사용한 개발 도구이며, 추후 완성된 브라우저 사용자의 필수 프로그램으로 정한 것이 아닙니다.

화면 위의 비교 도구는 설계 검토용입니다. 완성될 브라우저의 영구 상단 바가 아닙니다.

- 고정해서 열기 / 잠깐 열기 / 접고 집중하기
- 새 탭 / 웹에서 작업 / 글 읽기
- 스톤 / 심층암 재질
- 사이드바의 방패 → 광고 자리 접기 / 그림으로 대체 / 원본 비교
- 내 이미지 골라보기 → 로컬 이미지로 대체 시뮬레이션
- 탭 선택·추가·닫기, 주소 입력창, 즐겨찾기 예시
- 탭을 페이지의 왼쪽/오른쪽으로 끌기 → 두 페이지 나란히 보기. 탭의 작은 분할 버튼으로도 가능
- Dual view를 다시 눌러 닫기 → 선택 중인 쪽과 무관하게 왼쪽 화면을 유지합니다. 오른쪽 탭은 목록에 남습니다.
- 두 페이지를 클릭해 활성 화면 전환 → 공통 주소창과 이전/다음 버튼이 그 화면에 적용
- 가운데 경계 끌기 / 방향키로 비율 조절, 경계 더블클릭으로 50:50 복원
- 화면 위 제목 옆 × → 해당 페이지 하나만 보기. 다른 탭은 탭 목록에 보존
- 스킨 변경 → 64×64 / 64×32 PNG, 클래식·슬림 체형, 겉옷 레이어, 회전
- 언어 → Settings → Language → English / 한국어. 기본은 English이며 OS 언어를 자동 적용하지 않습니다.
- 인벤토리 플레이어 → 마우스 위치에 따라 머리·몸을 부드럽게 돌립니다. 몸의 추적 회전은 약 ±9.2° 이내이며 수동 회전값에 더합니다. 화면을 벗어나면 기본 자세로 돌아옵니다.
- 스킨은 브라우저의 로컬 저장소에 저장. 이미지 서버 업로드·Minecraft 계정 연결 없음
- 스킨 변경은 **설정 → 플레이어 스킨 변경**에 있습니다. 기본 스킨은 제공한 ARU_Tris입니다.
- 인벤토리 아이템 드래그 → 위치 교환. 핫바까지 36칸을 사용하며 새로고침 후 복원합니다.
- 빈칸 클릭 또는 사이트 추가 → 이름·URL 입력. 처음에는 사용하지 않는 아이템을 무작위 배정합니다. **아이콘 지정**을 누르면 크리에이티브 인벤토리에서 직접 선택합니다. 기존 사이트도 우클릭 → 사이트 편집에서 변경합니다.
- 아이콘 선택창은 분류 탭·한국어/영문/ID 검색·휠/스크롤바·방향키 이동을 제공합니다. 사용 중인 아이콘과 고정 도구 5개는 중복 선택할 수 없습니다. 선택창을 취소하면 작성 중인 이름·주소·기존 아이콘을 유지합니다.
- 아이템 클릭 → 북마크 열기. 외부 사이트는 현재 호스트 브라우저의 새 탭에서 열립니다. 브라우저 시안 안에 외부 사이트를 탑재한 것은 아닙니다.
- 아이템 우클릭 → 사이트 편집, 갑옷 착용/벗기, 삭제. 삭제 직후 되돌리기가 있습니다.
- 갑옷을 맞는 장비 칸에 드래그하거나 Shift+클릭 → 실제 갑옷 텍스처로 플레이어가 착용합니다. 장비를 인벤토리로 끌어 벗을 수 있습니다.
- 키보드 이동: 아이템에서 Space → 방향키 또는 Tab으로 대상 칸 → Enter. Esc로 취소합니다.
- `Ctrl+B`: 사이드바 토글, `Ctrl+L`: 주소 입력창, `Esc`: 임시 패널 닫기

## 시간대와 소리

| 컴퓨터 로컬 시간 | 배경 | 음악 |
| --- | --- | --- |
| 00:00~05:59 | 설치된 게임의 자수정 동굴 파노라마 | Ancestry, Deeper, Infinite Amethyst, Floating Dream, Echo in the Wind |
| 06:00~17:59 | 마을·맹그로브·벚꽃 등 5개 게임 파노라마, 2시간마다 선정 | Minecraft, Sweden 등 8곡 |
| 18:00~19:59 | 산과 벚꽃의 실제 노을 파노라마 | Sweden, Mice on Venus, Subwoofer Lullaby, Wet Hands |
| 20:00~23:59 | 공식 Minecraft 사이트의 달 뜬 숲 스크린샷 | Key, Dry Hands, Wet Hands, Oxygene, Living Mice |

낮 풍경은 하루별 순서를 섞고 같은 2시간 구간에는 새로고침해도 유지합니다. 배경은 4초, 시간대가 바뀔 때 음악은 6초 동안 교차 페이드합니다. OS 시계/시간대 변경·절전 복귀는 다음 확인 때 반영합니다(30초 주기 및 화면 복귀 즉시). 화면 위 World는 이 시안의 시간대 미리보기이며 새로고침 시 Computer time으로 돌아옵니다.

첫 실제 클릭/키 입력으로 음악을 시작합니다(브라우저 자동재생 제한). 사이드바에서 켜기/끄기·이전/다음 곡·볼륨을 조절하며, 다음 곡은 직전 곡과 겹치지 않게 고릅니다. 곡 사이에는 8~22초의 조용한 간격을 둡니다. 음악을 끄면 동굴 환경음도 멈춥니다.

Settings → Sound & ambience에서 효과음 전체 켜기/끄기, 효과음 볼륨, 테스트 버튼, 뉴스 알림과 미리보기를 제공합니다. 일반 인벤토리 이동에는 별도의 Java 바닐라 아이템 집기/놓기 소리가 없어 실제 UI 클릭음을 작게 사용합니다. 갑옷은 재질별 실제 착용음, 사이드바는 Minecraft UI 버튼 클릭음입니다. 새벽의 보이는 인벤토리에서는 음악과 효과음이 켜져 있을 때만 실제 동굴 환경음 23개를 7~16분 간격으로 낮게 재생합니다.

## Minecraft News

물 양동이는 [공식 기사 페이지](https://www.minecraft.net/en-us/article)를 엽니다. 시안이 열려 있고 화면이 보이는 동안 15분마다 공식 사이트가 사용하는 최신 기사 API를 확인합니다. 첫 확인은 기준만 저장하고, 그 뒤 발견한 새 기사를 오른쪽 위에 실제 160×32 advancement 텍스처를 2배로 표시합니다. 0.6초 슬라이드·5초 표시·퇴장과 실제 toast in/out 및 challenge_complete 소리를 사용합니다. 마우스를 올리거나 키보드로 포커스하면 읽는 동안 유지하고, 클릭하면 해당 기사가 새 탭에서 열립니다.

이미 본 기사는 다시 알리지 않고 한 번에 최대 3개만 차례대로 보여줍니다. 꺼져 있는 동안 확인한 기사는 나중에 켜도 몰아서 띄우지 않습니다. 오프라인/서버 오류는 신규 기사로 처리하지 않으며 자동 재시도합니다. Settings의 미리보기에는 Preview 표시가 있고 신규 기사 기록을 바꾸지 않습니다. 시안이 닫혀 있을 때의 OS 알림·백그라운드 서비스는 구현하지 않았습니다.

소리 설정은 `craftside:ambience:v1`, 뉴스 전달 중복 방지 기준은 `craftside:news:v1`에 저장합니다. 뉴스 바로가기 추가 전 원문은 `craftside:inventory:v1:before-news-20261019`에 보존합니다. 한번 추가한 후에는 물 양동이를 옮기거나 이름을 바꾸거나 삭제해도 다음 시작에서 되돌리지 않습니다.

## 실제 리소스팩 적용

**Settings → Resource packs → Import ZIP**에서 내려받은 **Minecraft Java Edition 리소스팩 ZIP**을 선택합니다. ZIP을 창에 끌어 놓아도 됩니다. 압축을 직접 풀 필요 없이 팩 아이콘·설명·지원 형식을 읽고, **Use pack → Apply packs**로 적용합니다. 선택 목록에서 위로 올린 팩이 우선입니다. 파일이 없으면 아래쪽 팩과 기본 Vanilla Tweaks/게임 리소스로 돌아갑니다. **Use defaults → Apply packs**로 전체 해제할 수 있고 Cancel은 적용 전 변경을 버립니다.

팩 라이브러리와 우선순위는 별도 IndexedDB `craftside:resource-packs:v1`에 저장되어 새로고침 후 복원됩니다. 파일은 이 브라우저 프로필의 로컬 저장소에만 들어가고 서버 업로드·게임 폴더 변경은 없습니다. 사이트 데이터 삭제 시 설치한 팩도 없어지며 내려받았던 원본 ZIP은 그대로 남습니다. 북마크 위치·이름·아이콘 ID, 스킨, 언어와 소리 설정은 별개로 보존합니다.

- 아이템 PNG·레이어, 부모/namespace를 쓰는 정적 cuboid 모델을 반영합니다. 제작대·주크박스 같은 블록 아이콘도 팩 텍스처로 다시 그립니다. 조건·손상도·표시 문맥 모델은 GUI의 기본 정지 상태를 사용합니다.
- 인벤토리·버튼·크리에이티브 창·빈 장비 슬롯·갑옷·인챈트·도전과제 텍스처를 교체합니다. 고해상도 PNG, 구형 widgets.png 버튼과 armor layer 경로도 대응합니다.
- `.png.mcmeta`의 아이템 프레임 순서·시간을 재생합니다. 모션 줄이기 설정에서는 첫 프레임을 유지합니다. 프레임 간 보간은 하지 않습니다.
- 팩에 파노라마가 있으면 낮 배경으로 사용합니다. 이전에 지정한 컴퓨터 시간 기준의 동굴·노을·밤 배경과 음악 일정은 유지합니다.
- 기존 음악/효과음과 같은 Minecraft 자산 경로의 OGG와 지원되는 `sounds.json` UI/갑옷/동굴 이벤트를 사용합니다. 신규 게임 전체 사운드 엔진을 구현한 것은 아닙니다.

현재 기본 해석 버전은 Minecraft 26.2 / 리소스 형식 88.0이며 `pack_format`, `supported_formats`, `min_format`/`max_format`, 해당 버전용 overlays를 읽습니다. 다른 버전 팩도 지원 파일은 적용하고 형식 차이를 표시합니다. **Bedrock·셰이더·OptiFine 등 모드 전용 기능·팩 폰트·특수 복합 아이템 렌더러는 지원 범위 밖**입니다. 처리하지 못한 복잡한 모델은 기본 아이콘을 유지하고 개수를 보여줍니다. 모든 Minecraft 팩을 게임과 100% 동일하게 렌더링한다는 의미는 아닙니다.

ZIP 256MB, 적용 자산 합계 192MB, 팩 12개까지 보관합니다. PNG·파일 경로·압축 해제량·CRC를 검사하며 잘못된 팩과 저장 실패는 기존 적용 상태를 보존합니다. 팩 파일의 코드를 실행하거나 외부 텍스처 URL을 불러오지 않습니다.

검증은 제공한 Vanilla Tweaks, 제작자 배포본 [Golden Days 16.5](https://github.com/PoeticRainbow/golden-days/releases/tag/16.5), 합성 진단 팩으로 구분합니다. 실제 ZIP 적용·우선순위·복원은 로컬 화면에서 확인하고, 압축/형식/저장 실패는 자동 검사로 확인합니다. 자료는 `design/evidence/v9/`에 있습니다.

## 안 읽은 알림과 인챈트

새 Minecraft News를 아직 확인하지 않았으면 물 양동이에 인챈트 광택을 표시합니다. 실제 제공한 팩의 glint 텍스처를 사용하고 아이템의 알파 모양에 맞춰 합성합니다. 알림이 저절로 닫히거나 ×를 눌러도 광택은 유지됩니다. 기사를 클릭하면 해당 기사만, 물 양동이로 뉴스 목록을 열면 남은 뉴스 전체를 확인 처리합니다. 안 읽은 뉴스는 `craftside:unread:v1`에 별도로 저장되어 새로고침 후에도 유지됩니다. 첫 기준 확인·알림 끔·미리보기는 과거 기사에 인챈트를 붙이지 않습니다.

Gmail도 같은 광택 표시를 사용합니다. **별도 Google OAuth 프로젝트나 클라이언트 JSON은 요구하지 않습니다.** 실제 브라우저의 Gmail 탭에 한 번 로그인한 세션에서 받은편지함의 안 읽음 표시를 따라가는 방향입니다. Gmail 바로가기를 누르는 것만으로 메일을 읽음 처리하지 않고, Gmail에서 실제 안 읽은 수가 0이 되어야 해제합니다. 북마크의 이름·아이콘·위치를 바꿔도 서비스 URL을 기준으로 표시가 따라갑니다.

현재는 외부 URL을 다른 브라우저 탭에 여는 웹 시안이므로 **Gmail 실시간 연동은 아직 연결되지 않았습니다.** `browser/`에는 받은편지함 배지/제목 감지와 네이티브 탭 수명주기 모듈 및 연동 계약을 준비했습니다. 실제 로그인·메일 수신 검증이나 탭을 닫은 뒤의 백그라운드 추적은 네이티브 엔진 단계에 필요합니다. 코드의 모의 검사를 실제 Gmail 연동 완료로 취급하지 않습니다.

Settings → Unread indicators → Preview enchantment로 물 양동이와 Gmail의 광택을 확인할 수 있습니다. 화면에 Preview 표시를 붙이고 20초 후 끝납니다. 실제 안 읽은 수나 뉴스 저장 기록은 바뀌지 않습니다. Done으로 바로 끝낼 수도 있습니다.

저장소 오류가 있어도 소리 끄기·볼륨 변경은 현재 실행에 즉시 적용하고, 설정에 저장 실패 안내를 표시합니다. 즐겨찾기 창의 닫기/편집이 부모의 `data-panel` 값 때문에 다시 열리던 이벤트 충돌도 수정했습니다.

이 HTML을 여는 기존 브라우저에 따라 단축키가 먼저 처리될 수 있습니다. 버튼으로도 모든 핵심 시안을 비교할 수 있습니다. `Ctrl+T/W`는 기존 브라우저 탭을 건드리지 않도록 연결하지 않았습니다.

## 파일

- `docs/CONCEPT.md` — 디자인 원칙, 동작, 광고 정책, 구현 후보와 단계
- `design/` — HTML/CSS/JavaScript 시안과 확인 캡처
- `design/workspace.js`, `design/inventory.css` — 2차 시안의 공통 사이드바·듀얼 뷰·인벤토리
- `design/player.js` — 로컬 PNG 스킨 로딩·저장과 플레이어 미리보기
- `design/player-pose.js` — 크기에 독립적인 시선 목표와 머리/몸 회전 보간
- `design/locales.js`, `design/i18n.js` — 영어/한국어 UI와 언어 저장·전환
- `design/inventory-model.js`, `design/bookmarks.js` — 북마크 위치·장비·URL 저장과 인벤토리 조작
- `design/resource-ui.css` — 실제 리소스 팩의 176×166 GUI 좌표를 쓰는 화면
- `assets/minecraft/catalog.json` — 852종 아이콘, 한국어/영문 이름, 분류, 장비·GUI 경로. 평면 PNG와 게임 큐브 모델에서 만든 블록 뷰 포함
- `assets/minecraft/sources.json` — 각 자산의 원본 파일·ZIP 내부 경로·해시
- `assets/player/ARU_Tris.png` — 사용자 스킨의 원본과 동일한 사본
- `tools/import-minecraft-assets.py` — 필요한 리소스만 복사하는 개발 도구. 게임 파일 수정 없음
- `tests/inventory-model.cjs` — 이동·저장·오류 복구 모델 확인 (`node tests/inventory-model.cjs`)
- `tests/language-player.cjs` — 언어 기본값·저장 실패·데이터 보존·머리/몸 회전과 복귀 확인 (`node tests/language-player.cjs`)
- `design/evidence/v3/` — 3차 시안의 실제 조작 캡처와 검증 결과
- `design/evidence/v4/` — 지정 배치·크리에이티브 선택창 캡처, 27개 저장/마이그레이션 모델 검사, 실제 UI 조작과 원본 보존 확인
- `design/evidence/v5/` — 영어 기본 화면·한국어 설정·좌우 플레이어 추적 캡처, 언어/회전 모델 검사 20개와 실제 UI 검증
- `design/ambience-model.js`, `design/ambience.js`, `design/ambience.css` — 로컬 시각·배경 페이드·실제 오디오·음악 제어·뉴스 알림
- `assets/ambience/` — 게임에서 검증해 복사한 이미지·OGG·도전과제 GUI 및 출처/해시
- `tools/serve.py` — 루프백 개발 서버와 15분 캐시의 공식 뉴스 읽기 API
- `tools/import-ambience.py` — 설치된 공개 게임 자산의 해시 확인·복사 도구
- `tests/ambience.cjs`, `tests/news-server.py` — 시간 경계·안전한 마이그레이션·뉴스 중복 방지·캐시·실시간 API 검사
- `design/evidence/v6/` — 6차 변경 전 코드 백업, 모델/API 검사와 UI·오디오·배경·알림 확인 자료
- `design/unread-model.js`, `design/unread.js`, `design/unread.css` — 안 읽은 뉴스 저장·확인 처리와 URL에 연결된 아이템 인챈트
- `assets/notifications/` — 제공한 팩의 실제 아이템 glint 텍스처와 출처/해시
- `browser/` — Gmail 로그인 세션용 네이티브 호스트 소스와 연결 계약. 현재 웹 시안에는 미연결
- `tests/unread.cjs`, `tests/unread-controller.cjs` — 안 읽음 저장·뉴스 확인·실제 UI 제어 모듈·Gmail DOM 예시·모의 네이티브 수명주기 검사
- `design/evidence/v7/` — 인챈트 변경 전 코드, 모델/제어 검사, 실제 시안 캡처와 검증 범위
- `design/resource-pack-model.js`, `resource-pack-db.js`, `resource-pack-renderer.js`, `resource-packs.js`, `resource-pack.css` — 실제 ZIP 해석·로컬 저장·아이템/GUI 합성과 설정 화면
- `assets/resource-base.json`, `assets/resource-base.sources.json` — 공개 클라이언트의 기본 모델·경로 대응표와 출처
- `tools/build-resource-base.py` — 기본 모델 표를 만드는 개발 도구. 브라우저에서 팩을 가져오는 데 Python은 필요하지 않음
- `tests/resource-packs.cjs` — 리소스팩 검사 25개. 저장 트랜잭션 검사는 `fake-indexeddb@6.2.6`을 별도의 테스트용 런타임에 설치해 실행 (`npm install --prefix "$env:TEMP/minecraft-browser-pack-tests" fake-indexeddb@6.2.6 --ignore-scripts --no-audit --no-fund`, 이후 `node tests/resource-packs.cjs`)
- `tools/create-pack-test-fixture.cjs` — 애니메이션·HD 텍스처·구형 GUI/갑옷·모델·사운드 진단용 ZIP 생성. 제품 배포본이나 설치 프로그램이 아님
- `design/evidence/v9/` — 리소스팩 변경 전 코드, 자동 검사와 실제 팩/진단 팩 확인 자료
- `design/evidence/v2/` — 2차 시안 캡처와 확인 결과. 기존 캡처·`concept.js`는 1차 자료로 보존
- `assets/fonts/` — 사용자 ZIP에서 복사한 폰트
- `assets/*.svg` — 이 시안을 위해 새로 그린 픽셀 마크·풍경
- `ref/` — 사용자 원본 자료. 원본 ZIP은 수정하지 않습니다.
- `docs/reference-manifest.json` — 원본 해시와 사용 폰트 기록

인벤토리는 로컬 저장소 `craftside:inventory:v1`, 스킨은 `craftside:player:v2`에 저장합니다. 사이트 데이터 삭제 시 사라집니다. 저장 실패 시 변경을 되돌리고 오류를 표시합니다. 손상된 기존 인벤토리는 덮어쓰지 않고 보기 모드로 엽니다.

언어는 별도 키 `craftside:language:v1`에 `en` 또는 `ko`만 저장합니다. 저장 실패 시 이전 언어를 유지하고 오류를 표시합니다. 언어 전환 자체는 북마크와 스킨의 저장값을 수정하지 않습니다.

사용자가 요청한 4차 초기 배치는 한 번만 적용합니다. 기존 원문은 `craftside:inventory:v1:before-curated-20261019`에 먼저 백업하고, 이후의 이동·추가·아이콘 변경은 새로고침해도 유지합니다. 백업이나 교체 저장이 실패하면 기존 배치를 보존합니다. 아이콘 카탈로그는 현재 표시 가능한 아이템·큐브 블록이며 게임 전체 모델을 재현하는 렌더러는 아닙니다.

## 빌드 원칙

**최종 배포 단계 전에는 EXE·포터블·설치 프로그램을 만들지 않습니다.**

현재는 패키징 설정·빌드 산출물·실제 브라우저 앱을 생성하지 않았습니다. 디자인 시안은 각종 완성 기능의 작동 증거가 아닙니다. 이후 구현과 개발 모드 검증을 거쳐 최종 단계에서만 패키징합니다.
