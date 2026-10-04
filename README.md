# AAC 앱

언어·발달장애인을 위한 장소 기반 AAC(보완대체의사소통) 앱. Expo(React Native + TypeScript).

## 실행

```bash
cd ~/Desktop/aac
npm install
npx expo start        # 폰의 Expo Go 앱으로 QR 스캔
```

점검 명령:

```bash
npm run typecheck     # TypeScript 타입 검사
npm run check:logic   # 문장 조합·판 생성·질문 매핑 로직 테스트
```

## 기능 (v0.1)

- 레벨 L1(그림 중심) / L2(그림+단어 조합, 기본) / L3(문장·입력)
- 상단 고정 핵심 버튼 (위치 불변)
- 장소판: 병원, 식당, 편의점, 다이소 + 보호자가 만든 판
- 한국어 조사 자동 처리: 배 + 아파요 -> "배가 아파요"
- TTS(expo-speech, ko-KR), 말하기 속도 조절
- 보여주기 화면: 큰 글씨, 180도 회전, 상대방 질문 버튼 -> 사용자 선택지
- 상대 말 입력 -> 키워드 규칙으로 선택지 변환
- 보호자 모드(PIN, 초기값 0000): 레벨, 장소, 판 만들기(초안 -> 선택 -> 승인), 이름, PIN 변경, 초기화
- 저장: 기기 로컬(AsyncStorage)만 사용

## 구조

```
App.tsx                  Provider 연결
src/Root.tsx             화면 전환(home/show/guardian) + 모달
src/data.ts              핵심 버튼, 장소판, 선택지 데이터
src/types.ts             타입
src/state/AppState.tsx   설정/판 상태, 말하기, 토스트
src/lib/korean.ts        조사 처리, 문장 조합
src/lib/aiDraft.ts       판 초안 생성 (현재 목업, 교체 지점)
src/lib/heard.ts         상대 말 -> 선택지 매핑
src/lib/speech.ts        TTS
src/lib/storage.ts       로컬 저장
src/screens/             Home, Show, Guardian
src/components/          SymbolButton, Grid, AskSheet, PinModal, Toast
```

## 미구현 / 다음 단계

- 실제 AI 판 생성: `src/lib/aiDraft.ts`의 `generateBoardDraft()`를 서버 API로 교체 (API 키는 앱에 넣지 말고 서버 경유)
- 음성인식(STT): 현재는 텍스트 입력. `expo-speech-recognition` 등은 개발 빌드 필요
- 카드 이미지: 기존 PNG 호환 + 보호자 의미 지정 → 검수 라이브러리 조회 → AI 생성/사진 선택 → 확인. 실패 시 임시 카드 저장. 서버 연결·미완료 항목은 `IMAGE_IMPLEMENTATION.md` 참조 (실제 API 키/배포/품질 검증 필요)
- 앱 아이콘/스플래시: `app.json`에 icon, splash 추가 필요
- 기기 간 동기화, 치료사 공유, 사용 기록
