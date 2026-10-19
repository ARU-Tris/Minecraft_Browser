# Chrome 데이터 가져오기 — MINECRAFT? 0.2.0

Settings → Import from Chrome에서 시작합니다. 한국어는 Settings → Language에서 선택합니다. 이 기능은 한 번의 이전이며 Chrome과 계속 동기화하지 않습니다. 기존 인벤토리·스킨·리소스팩과 Chrome 원본 데이터는 유지합니다.

## 암호

1. Chrome의 Google Password Manager → Settings → Export passwords에서 CSV를 내보냅니다. [Google 공식 안내](https://support.google.com/chrome/answer/95606?hl=en)
2. MINECRAFT?의 Import from Chrome에서 암호 CSV 가져오기 버튼을 누르고 파일을 선택합니다.
3. 사이트를 연 다음 사이드바의 Saved passwords에서 해당 계정을 선택하고 Fill login을 누릅니다. 현재 사이트와 정확히 일치하는 주소에만 입력하며 로그인 버튼은 자동으로 누르지 않습니다.

암호와 메모는 Windows 암호화 저장소를 사용한 `imported-data.enc`에 저장합니다. 같은 사이트·사용자 이름이 이미 있으면 기존 항목을 유지합니다. 목록은 이름·사이트·사용자 이름만 보여줍니다. 원본 CSV는 평문 파일이므로 이전을 마쳤다면 직접 삭제하세요.

## 쿠키와 북마크

1. Import from Chrome에서 Open helper folder를 누릅니다.
2. Chrome에서 `chrome://extensions`를 열고 Developer mode를 켠 다음 Load unpacked로 방금 열린 폴더를 선택합니다.
3. MINECRAFT?의 이전 창에서 수신을 시작하고 일회용 코드를 복사합니다. 기존 앱 쿠키를 유지하는 것이 기본이며, 덮어쓰려면 해당 옵션을 직접 선택합니다.
4. Chrome의 확장 프로그램 메뉴에서 MINECRAFT? 이전 도우미를 열고 코드를 붙여 넣습니다. 가져올 쿠키·북마크를 선택하고 Transfer now를 누릅니다.
5. 완료된 북마크는 MINECRAFT? 사이드바의 Chrome bookmarks에서 찾습니다. 기존 인벤토리 슬롯은 바꾸지 않습니다. 이전이 끝나면 Chrome에서 도우미를 제거해도 됩니다.

도우미는 Transfer now를 눌렀을 때만 데이터를 읽고, 이 컴퓨터의 일회용 수신기로 직접 전달합니다. 코드는 10분 뒤 만료되고 한 번만 사용할 수 있습니다. 쿠키를 별도의 평문 파일로 내보내거나 클라우드 서버에 전송하지 않습니다. Chrome의 쿠키 암호화 보호를 해제하거나 프로필 데이터베이스를 복호화하지 않습니다.

## 이전 범위

가져오는 데이터는 암호 CSV의 로그인 정보·메모, 일반 쿠키, 웹사이트 북마크입니다. 북마크 폴더 구조는 평평한 검색 목록으로 가져옵니다. 파티션 쿠키·기기에 묶인 로그인 키·패스키·결제 정보·방문 기록·확장 프로그램은 가져오지 않습니다. 일부 사이트에서는 다시 로그인해야 합니다. Google 로그인과 모든 사이트의 세션 유지는 확인되지 않았습니다.

개발 검증은 시험용 CSV·쿠키·북마크와 실제 Windows 암호화·브라우저 세션으로 진행했습니다. 사용자의 실제 Chrome 프로필이나 로그인 계정 데이터는 읽거나 이전하지 않았습니다. Chrome에 도우미를 설치한 실제 계정의 전체 이전은 사용 후 확인이 필요합니다.

관련 공식 설명: [Chrome 쿠키 보호](https://security.googleblog.com/2024/07/improving-security-of-chrome-cookies-on.html), [Chrome cookies API](https://developer.chrome.com/docs/extensions/reference/api/cookies), [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).
