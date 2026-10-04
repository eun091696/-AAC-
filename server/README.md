# AAC 카드 이미지 생성 서버

AAC 앱의 카드용 그림을 OpenAI 이미지 모델(기본 `gpt-image-2.5-flare`)로 생성해주는 아주 작은 백엔드입니다.
**외부 npm 패키지를 전혀 쓰지 않고** Node.js 내장 모듈(`http`, `crypto`, `fs`, `node:test` 등)만으로 만들었습니다.
API 키는 이 서버에서만 사용하고, 클라이언트(Expo 앱)에는 절대 노출하지 않습니다.

## 빠른 시작

```bash
cd server
cp .env.example .env
# .env를 채운 뒤 셸에 로드 (이 서버는 dotenv를 쓰지 않으므로 자동으로 읽지 않습니다)
export $(grep -v '^#' .env | xargs)
npm start           # 기본값: http://127.0.0.1:8787
```

키가 없어도 서버는 뜨지만, `/v1/card-images` 요청은 항상 `503`을 반환합니다.

## API

### `POST /v1/card-images`

**요청 바디** (JSON):

| 필드 | 타입 | 필수 | 제한 |
|---|---|---|---|
| `label` | string | ✅ | 1~80자 |
| `kind` | `'n' \| 'p'` | ✅ | `n`=명사, `p`=표현/감정/상황 |
| `visualMeaning` | string | 조건부 ✅ | 최대 240자. 아래 설명 참고. |

`sentence`나 그 외 알려지지 않은 필드(구버전 앱의 발화 문장 등)는 요청 바디에 끼워 보내도 그냥 무시됩니다. 검증/해석/프롬프트/캐시 어디에도 절대 쓰이지 않고, AI 생성 호출에도 전달되지 않습니다.

`visualMeaning`이 언제 필요한지는 `shared/visualConcepts.json` 큐레이션(`src/visualConcepts.js`)에 따릅니다:

- `kind: 'p'` (표현/감정/상황)은 **항상** 보호자가 실제 상황을 구체적으로 설명한 `visualMeaning`이 필요합니다. 단순 웃는/우는 아이콘으로 대체할 수 없습니다.
- `kind: 'n'`인데 레이블이 2가지 이상 흔한 뜻을 가진 단어(사과=과일/사과하기, 배=과일/몸/배, 눈=눈(眼)/눈(雪), 차=차(음료)/차(자동차), 밤=밤(시간)/밤(견과류), 말=말(동물)/말(言) 등 `shared/visualConcepts.json`의 `ambiguous`에 등록됨)라면, `visualMeaning`이 **반드시 있어야** 합니다 (없으면 422). 그 레이블에 제시된 선택지는 UI 제안일 뿐 엄격한 화이트리스트가 아닙니다: 선택지 중 하나와 정확히 일치하면 그 선택지의 큐레이션된 장면을 그대로 쓰고, 그렇지 않더라도 보호자가 적은 비어있지 않은 구체적인 설명을 그대로(고쳐 쓰지 않고) 받아들입니다. 서버가 자동으로 뜻을 골라주는 경우는 절대 없습니다.
- `kind: 'n'`이고 레이블이 큐레이션된 unambiguous 명사 사전(`nouns`)에 있으면 `visualMeaning` 없이도 바로 해결됩니다 (사전 값을 그대로 사용, 보호자가 보낸 값은 무시).
- `kind: 'n'`이고 사전/모호 목록에 없는 단어(알려지지 않은 명사)라면 `visualMeaning`(구체적인 장면 설명)이 필요합니다.

**성공 응답** `200`:
```json
{ "uri": "data:image/png;base64,...", "source": "ai", "visualMeaning": "먹는 과일 사과" }
```
캐시 히트일 때도 같은 형태이며 같은 `visualMeaning`을 돌려줍니다.

**에러 응답** (모두 간결한 JSON `{ "error": "code", "message": "..." }`):

| 상태 | error code | 상황 |
|---|---|---|
| 400 | `invalid_request` / `invalid_json` / `bad_request` | 입력값 검증 실패 (형태/길이) |
| 422 | `meaning_required` | 필요한 `visualMeaning`이 없을 때(모호한 단어/사전에 없는 명사/표현(kind=p) 모두 해당). 모호한 단어는 응답에 `choices`(UI 제안, 화이트리스트 아님)가 있을 수 있음. **API 키 확인, 캐시 조회, 생성 호출보다 먼저** 체크됩니다. |
| 413 | `payload_too_large` | 요청 바디가 `MAX_BODY_BYTES` 초과 |
| 429 | `rate_limited` | IP별 요청 빈도 초과 |
| 429 | `too_many_requests` | 동시 생성 요청 수(`MAX_CONCURRENCY`) 초과 |
| 503 | `service_unavailable` | `OPENAI_API_KEY` 미설정 |
| 504 | `timeout` | OpenAI 응답이 `OPENAI_TIMEOUT_MS` 내에 오지 않음 |
| 502 | `upstream_error` | OpenAI API가 에러를 반환하거나 응답 형식이 이상함 |

### `POST /v1/card-images/lookup`

`/v1/card-images`와 같은 바디 `{ label, kind, visualMeaning? }`를 받는 별도 엔드포인트입니다. **API 키가 없어도 정상 동작**합니다: 생성 호출이나 OpenAI 쪽은 전혀 건드리지 않고, `server/library/approved.json`에 **사람이 직접 검토해 등록한** 항목만 찾아 돌려줍니다.

```json
{ "found": false }
```
또는
```json
{ "found": true, "uri": "data:image/png;base64,...", "source": "approved", "visualMeaning": "먹는 과일 사과" }
```

매칭은 `label` + `kind` + 해석된 `visualMeaning`이 **정확히** 일치할 때만 일어납니다 (같은 레이블도 다른 뜻으로 해석되면 다른 항목). 필요한 `visualMeaning`이 없으면 `/v1/card-images`와 동일하게 `422 meaning_required`를 돌려줍니다. 생성/캐시/업스트림과는 전혀 상관없이 동작합니다.

**`server/library/approved.json`은 생성 캐시와 완전히 별개입니다.** 캐시 히트나 사용자의 "이 이미지 괜찮음" 승인이 절대 이 파일로 자동 승격되지 않습니다. 현재는 사람이 실제로 검토한 항목이 하나도 없으므로 `entries: []`이고, 검토자가 사람이 직접 추가해야만 늘어납니다. 각 항목의 `file`은 `server/library/` 바로 아래의 단순 파일명(구분자가 `..`/`/`/`\` 미포함)만 허용되며, 절대 경로나 원격 URL은 거부됩니다. 또한 `reviewedBy`(비어있지 않은 문자열)와 `reviewedAt`(`Date.parse()`로 읽히는 날짜 문자열)이 둘 다 있어야 승인된 것으로 취급합니다 (`src/library.js`의 `isReviewedEntry`) — label/kind/visualMeaning이 일치해도 이 메타데이터가 없거나 잘못되면 조용히 미발견으로 처리합니다.

### `GET /health`

```json
{ "status": "ok" }
```
비밀 정보(키, 설정값)는 절대 포함하지 않습니다.

## 의미 해석 (`shared/visualConcepts.json`)

AAC 카드 그림의 목표는 **언어/발달 장애가 있는 사용자와 외국인 사용자가 봤을 때 명확히 읽히는 그림**입니다. 추상적인 기호·이모지·은유나 서버가 임의로 지어낸 의미는 쓰지 않습니다. 그래서 서버는 생성 전에 반드시 `(label, kind, visualMeaning?)` -> `{ meaning, scene }`으로 해석(`src/visualConcepts.js`의 `resolveVisualMeaning`)하고, 해석에 실패하면 **API 키 확인/캐시 조회/프로바이더 호출보다 먼저** `422 meaning_required`로 막습니다.

- `shared/visualConcepts.json`은 **큐레이션된 사전**입니다. 하나의 뜻만 갖는 흔한 명사 약 30개(`nouns`)는 고정된 `{ meaning, scene }`을 그대로 쓰고(보호자 입력은 무시), 사과/배/눈/차/밤/말처럼 **2가지 이상의 흔한 뜻을 가진 단어**는 `ambiguous`에 선택지 배열로 등록해 두고 보호자가 반드시 `visualMeaning`을 보내야만 해석됩니다. 그 선택지는 UI 제안일 뿐 엄격한 화이트리스트는 아니라서, 정확히 일치하면 큐레이션된 장면을 쓰고 그렇지 않아도 보호자가 적은 비어있지 않은 구체적인 설명을 그대로 받아들입니다(절대 서버가 대신 골라주지 않습니다).
- `kind: 'p'`(표현/감정/상황)는 사전에 없고, **항상** 보호자가 실제 상황/행동을 적은 `visualMeaning`이 필요합니다. 기본 웃는/우는 얼굴 같은 대체물은 절대 자동 생성하지 않습니다.
- 이 함수는 입력의 "존재 여부/형태/(모호한 단어의 경우) 비어있지 않은 설명 여부"만 확인하며, 자유 텍스트 설명이 의미적으로 적절한지는 판단하지 않습니다 (그 품질 검증은 보호자 또는 검토자의 책임입니다).
- 이 리졸버는 `server/`와 `shared/`에만 있고, 서버는 받은 `visualMeaning`을 트리밍만 하고 **고쳐 쓰지 않습니다** — 응답의 `visualMeaning`은 요청에서 보낸 문구(또는 사전 값) 그대로입니다.

## 이미지 생성 방식

- 모델: `gpt-image-2.5-flare` (env `OPENAI_MODEL`로 변경 가능). `gpt-image-1`은 2026-10-23 OpenAI 종료 예정이라 기본값을 바꿨습니다. **실제 키로 접근 가능 여부와 생성 품질은 이 작업에서 검증하지 않았습니다.**
- 프롬프트는 서버에서만 조립합니다 (`src/promptBuilder.js`, 템플릿 버전 `v2-realistic`): 해석된 `{ label, kind, meaning, scene }`을 **지시문이 아니라 JSON 데이터**로 프롬프트 끝에 붙이고, "실사 사진처럼, 아이콘/만화/이모지/은유 금지, 텍스트·화살표·오버레이·과장된 만화 효과 금지, 설명에 없는 사물/원인/장소를 지어내지 말 것, 사람이 필요하면 실제 인물이 아닌 일반적인 성인(유아화 금지)"을 지시합니다.
- 프롬프트 문구를 바꾸면 `PROMPT_TEMPLATE_VERSION`(코드) 또는 `PROMPT_VERSION`(env)을 올려서 캐시를 무효화하세요.
- OpenAI 호출은 공식적으로 지원되는 파라미터(`model`, `prompt`, `size`, `quality`, `n`)만 보냅니다. 기본 품질은 `medium`(`OPENAI_IMAGE_QUALITY`)이고 출력은 PNG입니다.

## 캐시

- 같은 `(model, promptVersion, label, kind, 해석된 meaning, imageSize)` 조합은 같은 이미지를 재사용합니다 (`sha256` 해시를 캐시 키로 사용, `src/hash.js`). **`sentence`(발화 문장)는 절대 캐시 키에 들어가지 않습니다** — 새 앱은 아예 보내지 않고, 보내더라도 서버가 무시합니다.
- 같은 레이블이라도 해석된 의미가 다르면(예: 모호한 단어를 다른 뜻으로 선택) 서로 다른 캐시 항목이 됩니다.
- 기본은 디스크 캐시(`CACHE_DIR`, 기본 `./.cache`)이며 파일명은 해시값뿐이라 라벨/의미 텍스트는 파일 시스템에 평문으로 남지 않습니다.
- `CACHE_ENABLED=false`로 끄면 매 요청마다 새로 생성합니다.
- 이 캐시는 `server/library/approved.json`(사람이 검토한 라이브러리)과 **완전히 별개**입니다. 캐시에 있다고 해서 사람이 검토했다는 뜻이 아닙니다.

## 보호 장치

- **바디 크기 제한**: `MAX_BODY_BYTES` (기본 4096B). 스트리밍 중 초과 시 즉시 `413`.
- **레이트 리밋**: IP별 고정 윈도우 방식 (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`). 단일 프로세스 메모리 기반이라 다중 인스턴스 배포 시 분산 저장소로 교체가 필요합니다.
- **동시성 제한**: OpenAI 호출 동시 개수를 `MAX_CONCURRENCY`로 제한. 초과 시 `429`.
- **타임아웃**: OpenAI 호출은 `OPENAI_TIMEOUT_MS`(기본 85000ms)에서 중단됩니다. **앱(클라이언트) 쪽 타임아웃이 100초이므로 이 값을 100000ms보다 낮게 유지하세요.**
- **CORS**: `CORS_ORIGINS`에 등록된 출처만 브라우저 크로스오리진 요청을 허용합니다. 비워두면 크로스오리진 요청을 차단합니다 (개발용 Expo 웹은 `http://localhost:19006` 등을 추가).
- **로깅**: 이벤트/상태코드/해시 앞 12자/소요시간만 기록합니다. `label`, `sentence`, `visualMeaning`, `meaning`, `scene`, API 키, Authorization 헤더는 로그에 남기지 않습니다 (`src/logger.js`).

## 환경 변수

`.env.example` 참고. 요약:

| 변수 | 기본값 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` | (없음) | 필수. 없으면 생성 요청은 503 |
| `OPENAI_MODEL` | `gpt-image-2.5-flare` | 이미지 모델 (`gpt-image-1`은 2026-10-23 종료 예정) |
| `OPENAI_IMAGE_SIZE` | `1024x1024` | 이미지 크기 |
| `OPENAI_IMAGE_QUALITY` | `medium` | 이미지 품질 |
| `PROMPT_VERSION` | `v2-realistic` | 캐시 무효화용 프롬프트 버전 |
| `HOST` | `127.0.0.1` | 바인드 호스트 |
| `PORT` | `8787` | 바인드 포트 |
| `OPENAI_TIMEOUT_MS` | `85000` | OpenAI 호출 타임아웃 |
| `MAX_CONCURRENCY` | `4` | 동시 생성 요청 수 |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | `60000` / `30` | IP별 요청 제한 |
| `MAX_BODY_BYTES` | `4096` | 요청 바디 최대 크기 |
| `CACHE_ENABLED` / `CACHE_DIR` | `true` / `./.cache` | 디스크 캐시 설정 |
| `CORS_ORIGINS` | (빈 값) | 허용 출처 콤마 목록 |

## 테스트

외부 의존성 없이 `node:test` + 의존성 주입으로 작성했습니다. **실제 OpenAI API를 호출하지 않으며 과금 요청이 전혀 발생하지 않습니다.**

```bash
cd server
npm test
```

- `test/validate.test.js`: 입력 검증 (label 80자, visualMeaning 240자, kind 필수, sentence/알 수 없는 필드 무시 등)
- `test/visualConcepts.test.js`: 큐레이션 사전 로딩, 모호한/미등록 단어의 `meaning_required`, 같은 레이블의 서로 다른 의미 해석 등
- `test/config.test.js`: 기본 `promptVersion`/`imageQuality`, env 오버라이드, `hasApiKey` 계산
- `test/library.test.js`: `server/library/approved.json` 로딩(빈 상태), 정확 매칭, 경로 탈출/원격 URL 차단
- `test/promptBuilder.test.js`: 프롬프트가 실사 사진체를 요구하고 아이콘/만화/이모지/은유/텍스트/오버레이를 금지하는지, label/meaning/scene이 JSON 데이터로만 들어가는지 등
- `test/hash.test.js`: 캐시 키가 model/promptVersion/label/kind/meaning/imageSize에 따라 달라지고 sentence는 영향이 없는지
- `test/cache.test.js`: 메모리/디스크/널 캐시 동작
- `test/rateLimiter.test.js`, `test/concurrencyLimiter.test.js`: 제한 로직 단위 테스트
- `test/server.test.js`: HTTP 서버 통합 테스트. `openaiClient.generateImage`를 **모킹**해서 성공/422 meaning_required/타임아웃/업스트림 에러/캐시 히트/같은 레이블의 다른 의미 분리/레이트리밋/동시성 초과/CORS/바디 크기 초과, 그리고 `/v1/card-images/lookup`의 히트·미스·422·캐시 미접근을 검증합니다. 실제 네트워크 호출이나 OpenAI 키가 전혀 필요 없습니다.

## 배포 관련 주의 (아직 안 된 것)

이 서버는 **프로덕션 준비 상태가 아닙니다**. 이 작업에서는 OpenAI API 키가 없어 **실제 유료 생성 호출, 실제 이미지 품질, 한국어 의미 정확도는 검증하지 않았습니다** (45개+ 테스트는 모두 `openaiClient`/`library`를 모킹한 것입니다). 최소한 다음을 직접 추가해야 합니다:

- **인증/인가**: 현재 이 서버 자체에는 클라이언트 인증이 없습니다. 외부에 노출하려면 앞단에 리버스 프록시(API 게이트웨이) + API 키/JWT/세션 등 적절한 인증을 반드시 두세요. 기본 바인드가 `127.0.0.1`인 것도 이 때문입니다 (같은 머신의 신뢰된 프로세스에서만 접근 가정).
- **레이트 리밋 저장소**: 현재는 프로세스 메모리 기반이라 다중 인스턴스/재시작 시 상태가 초기화됩니다. 여러 대로 스케일하려면 Redis 등 공유 저장소가 필요합니다.
- **캐시 공유**: 디스크 캐시는 로컬 파일 시스템 기준입니다. 다중 인스턴스라면 공유 스토리지(S3 등)나 별도 캐시 서비스가 필요합니다.
- **HTTPS/TLS**: 이 서버는 평문 HTTP만 제공합니다. TLS 종료는 앞단 프록시(nginx, Caddy, 클라우드 로드밸런서 등)에 맡기세요.
- **비용 상한/모니터링**: OpenAI 사용량/비용 알림, 예산 상한 설정은 OpenAI 대시보드에서 별도로 구성해야 합니다.

## 파일 구조

```
server/
  bin/start.js              실제 의존성을 조립해서 서버를 띄우는 진입점
  library/
    approved.json             사람이 직접 검토해 등록한 이미지 매니페스트 (초기값: entries: [])
  src/
    config.js                환경변수 로딩
    validate.js               요청 바디 검증 (label/kind/visualMeaning, sentence는 무시)
    visualConcepts.js          shared/visualConcepts.json 기반 의미 해석 (resolveVisualMeaning)
    library.js                 server/library/approved.json 검토 라이브러리 조회
    promptBuilder.js           실사 사진 스타일 AAC 프롬프트 생성 (v2-realistic) + 버전
    hash.js                    캐시 키(sha256) 계산
    cache.js                   디스크/메모리/널 캐시 구현
    openaiClient.js            OpenAI images API 호출 (fetch 기반, 타임아웃 포함)
    rateLimiter.js             IP별 고정 윈도우 레이트 리밋
    concurrencyLimiter.js      동시 생성 요청 수 제한
    cors.js                    CORS 허용 출처 처리
    logger.js                  민감정보 제외 최소 로깅
    server.js                  HTTP 라우팅 (/v1/card-images, /v1/card-images/lookup) + 위 모듈 조립 (의존성 주입 가능)
  test/                        node:test 기반 단위/통합 테스트 (OpenAI/라이브러리 모킹, 실제 과금 요청 없음)
  .env.example                 환경 변수 예시
  .gitignore
  package.json
  README.md                    (이 문서)

shared/
  visualConcepts.json         서버와 앱이 함께 쓰는 큐레이션 명사/모호어 사전 (단일 소스)
```
