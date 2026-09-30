# 카드 이미지 구현 인수인계 (Claude Code 협업용)

## 구현 및 검증한 것
- 기본 카드/핵심 버튼/질문 선택지/L1 교체 슬롯: 기기 이모지 대신 로컬 PNG 표시. 기존 카드 구조·저장 데이터는 유지하며 렌더 시 변환.
- OpenMoji PNG 106개, CC BY-SA 4.0. 약 1.2MB. 출처/라이선스: `assets/symbols/LICENSE.md`, `LICENSE.txt`.
- 공통 CardForm: 이름 입력 → 정확 일치 사전 그림 자동 선택 → 미리보기 → 저장. 사과로 웹 UI 저장 및 새로고침 후 유지 확인.
- 사전 밖 표현: 서버 주소 설정 및 전송 동의 후 입력 종료/추가 버튼에서 자동 AI 생성 → 의미 확인 후 저장. 실패 시 재시도 또는 명시적으로 그림 없이 추가. 입력 변경 시 오래된 응답 적용 차단.
- AI 이미지 서버: `server/`, OpenAI images API, 키 서버 전용, 입력 검증/타임아웃/캐시/요청 제한. 모바일은 이미지 파일을 documentDirectory에 저장하고 AsyncStorage에는 파일 URI만 저장. 웹은 data URI 저장.
- 타입 검사, 기존 로직 30개, 그림 사전 7개, 서버 모의 테스트 45개 통과. 웹 정적 빌드 통과.

## 미검증 / blocked
- 실제 OpenAI 생성: 서버용 API 키 없음. 실과금 호출/한국어 의미 정확도/실제 이미지 품질은 검증하지 않음.
- iOS/Android 실제 기기에서 파일 저장·오프라인 재시작 검증 필요.
- 서버 배포/프로덕션 인증: 미구현. 개발 서버를 인증 없이 공개하지 말 것. 앱에는 정적 비밀 키를 넣지 말 것. 출시 전에 사용자 인증·예산 한도·TLS 필요.
- 일반 그림 라이브러리로서 임상 검증된 AAC 상징 세트는 아님. 특히 추상 표현·신체 부위는 보호자/당사자 의미 확인 필요. 현 단계는 기존 상징의 PNG화이며 전체 기본 카드를 AI로 새로 그린 것은 아님.
- 웹은 로컬 저장 용량 한도가 있음. 많은 AI 카드 저장은 별도 IndexedDB 이미지 저장소 필요. 삭제된 모바일 카드의 그림 파일 정리는 후속 작업.
- 저장 실패 안내는 기존 storage.ts가 실패를 숨기는 구조이므로 별도 보완 필요.

## 로컬 실행
```
cd server
cp .env.example .env
# .env의 OPENAI_API_KEY 및 CORS_ORIGINS=http://localhost:8083 지정
node --env-file=.env bin/start.js
```
루트 `.env.example`을 `.env.local`로 복사하여 `EXPO_PUBLIC_IMAGE_API_URL` 설정 후 Expo 재시작. 현재 PC에서는 localhost, 폰에서는 PC LAN IP 사용. LAN 노출은 개발 기기에서만 제한적으로 사용.

검증 명령:
```
npm run typecheck
npm run check:logic
npx tsc src/lib/symbolCatalog.check.ts --outDir .logic-images --module commonjs --target es2020 --strict --skipLibCheck --ignoreConfig
node .logic-images/symbolCatalog.check.js
node --test server/test/*.test.js
```

기존 8082 개발 서버는 이 작업 폴더의 변경을 반영하지 않아 별도 정적 빌드(8083)로 검증. 새 Expo 시작에서 EMFILE 파일 감시 한도 발생. Watchman 설치 또는 기존 개발 프로세스 정리 후 재시작 필요. 시스템 설정은 변경하지 않음.
