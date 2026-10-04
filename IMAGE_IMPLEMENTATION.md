# 이미지 브랜치 인수인계

작업 브랜치: `feat/card-image` (사용자 터미널에서 생성, `.git/HEAD` 확인). 에이전트 환경 `/usr/bin/git`은 xcrun 개발 도구 누락으로 실행 불가. 커밋/push/PR은 수행하지 않음. 기존 카드 편집의 initial/onDirtyChange/place/L1/dirty 확인은 보존.

## 확정 흐름

1. 보호자가 단어 또는 표현을 입력.
2. 다의어·표현·미등록 단어는 구체적인 뜻/장면을 직접 지정. 의미 확인 사전은 현재 명사 30개, 다의어 6개이며 사진 라이브러리와는 다름.
3. 전송 동의 후 입력 종료 또는 추가 버튼에서, 뜻·종류·이름이 정확히 일치하는 **수동 검수 라이브러리** 조회 → 없으면 AI 생성. 생성 결과는 서버 캐시에 저장하여 같은 뜻의 요청에서 재사용.
4. 실제 사용할 그림은 개인 사용자가 이해하는지 확인한 뒤 저장. 사용자의 확인은 공용 라이브러리 검수 승인이 아님.
5. 거부·오프라인·생성 실패·의미 미지정은 명시적인 `그림 준비 중 임시 카드로 저장` 허용. 임의의 이모지/사진 대체 없음. 카드 수정에서 뜻 지정 및 재생성 가능.
6. 직접 카메라/앨범 선택 가능. 선택한 사진은 기기에만 저장. AI 서버 업로드 없음. 사진에도 뜻 확인 절차 적용.

## 실제 확인한 것

- 타입 검사, 린트, 카드/편집/문장 로직 41개, 이미지 의미/전송 계약 19개, 서버 모의 테스트 91개 통과.
- 웹 빌드 및 iOS/Android 번들 빌드 검증(실기기 검증과 다름).
- 웹에서 배의 3가지 뜻 표시 → 몸의 배 선택 → 서버 키 없음(503) 안내 → 임시 카드 저장 → 새로고침 유지 확인.
- 개인 사진 대신 생성 시안 파일로 웹 앨범 선택 → 미리보기 → 확인 전 저장 차단 → 확인 체크 → 로컬 사진 카드 저장. 뜻 변경 시 확인 체크 해제, 선택한 사진은 유지됨. 체크 동작을 테스트한 것이며 실제 장애 당사자 검증은 하지 않음.
- Aside 이미지 생성 도구로 바나나 사진형 시안 1개 실제 생성. `assets/image-review/banana-candidate.png`에 검수 후보로 보관. 앱 OpenAI 연결 성공으로 간주하지 않음.

## 미완료 / blocked

- **앱의 실제 AI API 생성**: `server/.env`와 OpenAI 키 없음. 실제 모델 접근·한국어 의미 보존·생성 품질 미검증.
- **공용 검수 이미지 라이브러리**: `server/library/approved.json`의 entries는 현재 0개. 검수 후보를 승인된 사진처럼 자동 등록하지 않았음. 초기 카드 전체를 사진형으로 교체하는 작업은 아직 완료하지 않았음. 기존 OpenMoji 카드의 읽기 호환만 유지하며 새 카드 임시 대안으로 쓰지 않음.
- **휴대폰 카메라/앨범 권한·로컬 파일 재실행**: 실기기 미검증. Expo plugin 권한 문구는 새로운 네이티브 빌드에 적용해야 함.
- **배포/운영 보안**: 프로덕션 인증·TLS·사용자별 일일 예산 제한 미구현. 현재 IP 요청 제한은 일일/기기당 예산 제한이 아님. 개발 서버를 공개하지 말 것.
- **저장 용량**: 웹 사진/data URI는 브라우저 로컬 저장 용량 한도 적용. 기존 storage.ts가 저장 실패를 숨기므로 용량 초과/안내 보완과 IndexedDB 이미지 저장소는 별도 작업 필요. 모바일 사진은 파일 URI 저장. 미사용 이미지 파일 정리는 후속 작업.
- **이해도**: 사진형 프롬프트와 확인 UI는 품질을 보장하지 않음. 언어장애·발달장애·외국인 대상 실제 그림 이해도 검증은 미실시.

## 주요 파일

- 앱: `CardForm.tsx`, `CardSymbol.tsx`, `types.ts`, `cardImages.ts`, `imageMeaning.ts`, `imageContract.ts`, `localCardPhoto.ts`, `cardImageStore*.ts`
- 계약: `shared/visualConcepts.json`
- 서버: `server/src/visualConcepts.js`, `validate.js`, `promptBuilder.js`, `hash.js`, `library.js`, `server.js`, config/.env.example
- 사진 권한 및 모듈: `app.json`, package.json/package-lock.json (`expo-image-picker` 추가)

## 실행

서버 `server/.env.example`을 `server/.env`로 복사하여 OpenAI 키 설정(채팅에 키를 보내지 말 것). 현재 공식 문서에 맞춘 기본 모델은 `gpt-image-2.5-flare`, 환경변수로 교체 가능. 실제 모델 접근은 미검증.

```
cd server
node --env-file=.env bin/start.js
```

루트 `.env.example`을 `.env.local`로 복사, `EXPO_PUBLIC_IMAGE_API_URL`을 실행한 서버 주소로 설정 후 Expo 재시작. 웹 검증 출처를 서버 CORS_ORIGINS에 지정. 폰에서는 localhost 대신 PC LAN IP를 사용하며 개발 접근만 허용.

```
npm run typecheck
npm run lint
npm run check:logic
npx tsc src/lib/imageMeaning.check.ts --outDir .logic-images --module commonjs --target es2020 --strict --skipLibCheck --resolveJsonModule --esModuleInterop --ignoreConfig
node .logic-images/src/lib/imageMeaning.check.js
node --test server/test/*.test.js
```

검증용 웹 정적 서버 8083, 키 없는 로컬 이미지 서버 8787 사용. 해당 프로세스의 종료 권한이 도구에서 거절되어 실행 상태 정리는 사용자 터미널 필요. Expo 개발 서버 파일 감시 한도(EMFILE) 때문에 정적 export로 검증했으며 시스템 설정은 변경하지 않음.
