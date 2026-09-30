# AAC 카드 이미지 생성 서버

AAC 앱의 카드용 그림을 OpenAI `gpt-image-1`로 생성해주는 아주 작은 백엔드입니다.
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
| `sentence` | string | ❌ | 최대 160자, 문맥 문장 |
| `kind` | `'n' \| 'p'` | ❌ | `n`=명사, `p`=표현/감정 |

**성공 응답** `200`:
```json
{ "uri": "data:image/png;base64,...", "source": "ai" }
```

**에러 응답** (모두 간결한 JSON `{ "error": "code", "message": "..." }`):

| 상태 | error code | 상황 |
|---|---|---|
| 400 | `invalid_request` / `invalid_json` / `bad_request` | 입력값 검증 실패 |
| 413 | `payload_too_large` | 요청 바디가 `MAX_BODY_BYTES` 초과 |
| 429 | `rate_limited` | IP별 요청 빈도 초과 |
| 429 | `too_many_requests` | 동시 생성 요청 수(`MAX_CONCURRENCY`) 초과 |
| 503 | `service_unavailable` | `OPENAI_API_KEY` 미설정 |
| 504 | `timeout` | OpenAI 응답이 `OPENAI_TIMEOUT_MS` 내에 오지 않음 |
| 502 | `upstream_error` | OpenAI API가 에러를 반환하거나 응답 형식이 이상함 |

### `GET /health`

```json
{ "status": "ok" }
```
비밀 정보(키, 설정값)는 절대 포함하지 않습니다.

## 이미지 생성 방식

- 모델: `gpt-image-1` (env `OPENAI_MODEL`로 변경 가능)
- 프롬프트는 서버에서만 조립합니다: "하나의 단순한 AAC 그림 상징, 흰 배경, 텍스트/글자 없음, 명사 또는 표현을 나타내는 한국어 단어" 형태의 안전한 영어 프롬프트를 생성합니다 (`src/promptBuilder.js`).
- 프롬프트 문구를 바꾸면 `PROMPT_TEMPLATE_VERSION`(코드) 또는 `PROMPT_VERSION`(env)을 올려서 캐시를 무효화하세요.

## 캐시

- 같은 `(model, promptVersion, label, sentence, kind)` 조합은 같은 이미지를 재사용합니다 (`sha256` 해시를 캐시 키로 사용, `src/hash.js`).
- 기본은 디스크 캐시(`CACHE_DIR`, 기본 `./.cache`)이며 파일명은 해시값뿐이라 라벨/문장 텍스트는 파일 시스템에 평문으로 남지 않습니다.
- `CACHE_ENABLED=false`로 끄면 매 요청마다 새로 생성합니다.

## 보호 장치

- **바디 크기 제한**: `MAX_BODY_BYTES` (기본 4096B). 스트리밍 중 초과 시 즉시 `413`.
- **레이트 리밋**: IP별 고정 윈도우 방식 (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`). 단일 프로세스 메모리 기반이라 다중 인스턴스 배포 시 분산 저장소로 교체가 필요합니다.
- **동시성 제한**: OpenAI 호출 동시 개수를 `MAX_CONCURRENCY`로 제한. 초과 시 `429`.
- **타임아웃**: OpenAI 호출은 `OPENAI_TIMEOUT_MS`(기본 85000ms)에서 중단됩니다. **앱(클라이언트) 쪽 타임아웃이 100초이므로 이 값을 100000ms보다 낮게 유지하세요.**
- **CORS**: `CORS_ORIGINS`에 등록된 출처만 브라우저 크로스오리진 요청을 허용합니다. 비워두면 크로스오리진 요청을 차단합니다 (개발용 Expo 웹은 `http://localhost:19006` 등을 추가).
- **로깅**: 이벤트/상태코드/해시 앞 12자/소요시간만 기록합니다. `label`, `sentence`, API 키, Authorization 헤더는 로그에 남기지 않습니다 (`src/logger.js`).

## 환경 변수

`.env.example` 참고. 요약:

| 변수 | 기본값 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` | (없음) | 필수. 없으면 생성 요청은 503 |
| `OPENAI_MODEL` | `gpt-image-1` | 이미지 모델 |
| `OPENAI_IMAGE_SIZE` | `1024x1024` | 이미지 크기 |
| `PROMPT_VERSION` | `v1` | 캐시 무효화용 프롬프트 버전 |
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

- `test/validate.test.js`: 입력 검증 (label 80자, sentence 160자, kind 값 등)
- `test/promptBuilder.test.js`: 프롬프트에 텍스트 금지/흰 배경 문구가 포함되는지 등
- `test/hash.test.js`: 캐시 키가 model/promptVersion/label/sentence/kind에 따라 달라지는지
- `test/cache.test.js`: 메모리/디스크/널 캐시 동작
- `test/rateLimiter.test.js`, `test/concurrencyLimiter.test.js`: 제한 로직 단위 테스트
- `test/server.test.js`: HTTP 서버 통합 테스트. `openaiClient.generateImage`를 **모킹**해서 성공/타임아웃/업스트림 에러/캐시 히트/레이트리밋/동시성 초과/CORS/바디 크기 초과를 검증합니다. 실제 네트워크 호출이나 OpenAI 키가 전혀 필요 없습니다.

## 배포 관련 주의 (아직 안 된 것)

이 서버는 **프로덕션 준비 상태가 아닙니다**. 최소한 다음을 직접 추가해야 합니다:

- **인증/인가**: 현재 이 서버 자체에는 클라이언트 인증이 없습니다. 외부에 노출하려면 앞단에 리버스 프록시(API 게이트웨이) + API 키/JWT/세션 등 적절한 인증을 반드시 두세요. 기본 바인드가 `127.0.0.1`인 것도 이 때문입니다 (같은 머신의 신뢰된 프로세스에서만 접근 가정).
- **레이트 리밋 저장소**: 현재는 프로세스 메모리 기반이라 다중 인스턴스/재시작 시 상태가 초기화됩니다. 여러 대로 스케일하려면 Redis 등 공유 저장소가 필요합니다.
- **캐시 공유**: 디스크 캐시는 로컬 파일 시스템 기준입니다. 다중 인스턴스라면 공유 스토리지(S3 등)나 별도 캐시 서비스가 필요합니다.
- **HTTPS/TLS**: 이 서버는 평문 HTTP만 제공합니다. TLS 종료는 앞단 프록시(nginx, Caddy, 클라우드 로드밸런서 등)에 맡기세요.
- **비용 상한/모니터링**: OpenAI 사용량/비용 알림, 예산 상한 설정은 OpenAI 대시보드에서 별도로 구성해야 합니다.

## 파일 구조

```
server/
  bin/start.js              실제 의존성을 조립해서 서버를 띄우는 진입점
  src/
    config.js                환경변수 로딩
    validate.js               요청 바디 검증 (label/sentence/kind)
    promptBuilder.js           안전한 AAC 프롬프트 생성 + 버전
    hash.js                    캐시 키(sha256) 계산
    cache.js                   디스크/메모리/널 캐시 구현
    openaiClient.js            OpenAI images API 호출 (fetch 기반, 타임아웃 포함)
    rateLimiter.js             IP별 고정 윈도우 레이트 리밋
    concurrencyLimiter.js      동시 생성 요청 수 제한
    cors.js                    CORS 허용 출처 처리
    logger.js                  민감정보 제외 최소 로깅
    server.js                  HTTP 라우팅 + 위 모듈 조립 (의존성 주입 가능)
  test/                        node:test 기반 단위/통합 테스트 (OpenAI 모킹, 실제 과금 요청 없음)
  .env.example                 환경 변수 예시
  .gitignore
  package.json
  README.md                    (이 문서)
```
