# 실시간 통역 (EN · RU ⇄ KO)

모바일 웹앱(PWA). 설치 없이 브라우저에서 동작하고, 홈 화면에 추가하면 앱처럼 쓸 수 있습니다.

| 버튼 | 동작 |
|---|---|
| **EN / RU** | 상대방의 영어/러시아어를 듣고 → 원문 + 한국어 번역 표시 → 한국어로 읽기 |
| **한국어** (가운데) | 내 한국어를 듣고 → 영어·러시아어 번역 표시 → 해당 언어로 읽기 |
| ⇅ 마주보기 | 화면 위쪽을 상대방 방향으로 뒤집어 테이블 너머로 대화 |
| 입력 | 키보드로 입력해서 번역 |
| 한 → EN·RU | 한국어 번역 대상 전환 (둘 다 / 영어 / 러시아어) |

## 설치

- **Android 앱(APK)**: `pwabuilder-apk/RealtimeTX.apk` 를 휴대폰에 복사 → 열기 → "출처를 알 수 없는 앱" 허용 후 설치
- **웹앱**: https://dongcyun-agentmster50.github.io/ → Chrome 메뉴 "앱 설치" / Safari "홈 화면에 추가"

> APK 는 TWA(Trusted Web Activity) 방식: 설치된 Chrome 이 위 주소를 앱 화면으로 띄웁니다.
> 웹 파일을 수정해서 push 하면 APK 재설치 없이 바로 반영됩니다.
> `pwabuilder-apk/signing.keystore` + `signing-key-info.txt` 는 **업데이트·Play 스토어 등록에 필수** — 안전한 곳에 백업하세요 (git 에는 올라가지 않음).

## 로컬 개발 실행

```bash
node server.js
```

- PC: http://localhost:5173
- 휴대폰(같은 Wi‑Fi): 콘솔에 나오는 `https://<PC-IP>:5443` 접속 → 인증서 경고에서 "고급 → 계속" 선택

> 마이크는 **HTTPS**에서만 동작합니다. `certs/` 인증서는 자체 서명이라 경고가 뜹니다.
> IP가 바뀌면 `certs/` 를 다시 만드세요 (openssl, SAN 에 새 IP 포함).

### 정식 HTTPS로 배포 (추천, 1분)
폴더(`certs/`, `server.js` 제외)를 [Netlify Drop](https://app.netlify.com/drop) 또는 GitHub Pages에 올리면 바로 HTTPS 주소가 생깁니다.

## 지원 브라우저
- **Android Chrome** ✅ (권장)
- **iOS Safari 14.5+** ✅ — 첫 번째 버튼 탭 이후부터 자동 읽기 가능
- Firefox ❌ (음성 인식 미지원 → 입력 기능만 사용)

## 구조
- `app.js` — STT(Web Speech) → 실시간 번역(Google gtx, 실패 시 MyMemory) → TTS(speechSynthesis)
- `styles.css` — 다크/라이트 자동, 언어별 색상 (KO 보라 · EN 하늘 · RU 핑크)
- `sw.js`, `manifest.webmanifest` — PWA 설치 지원
