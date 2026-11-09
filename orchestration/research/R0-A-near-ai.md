# R0-A — NEAR AI Cloud: inference + attestation, validated live

**Status:** complete (no credentials available; all anonymous/public endpoints tested)
**Research date / access date:** 2026-11-09
**Agent:** Wave 0 research (R0-A)
**Method:** live `curl` against `cloud-api.near.ai` + `docs.near.ai` markdown/`llms.txt`/OpenAPI + npm registry metadata. No packages installed. Repo untouched apart from this file.

**Evidence labels**

| Label | Meaning |
| - | - |
| `[VERIFIED-LIVE]` | I made the HTTP request on 2026-11-09 and observed the status/body shown |
| `[VERIFIED-DOC]` | Direct quote from a live docs page or live OpenAPI document (URL in Sources) |
| `[UNVERIFIED]` | Could not test (needs an API key, a funded org, or a client-side runtime) |
| `[ANNOUNCED]` | Described in docs but not observable as a stable/complete contract |

---

## 0. TL;DR for MEND

- Inference gateway is `https://cloud-api.near.ai/v1`, OpenAI-compatible, bearer auth. The old `api.near.ai` is **dead** (`410`, retired 2025-10-31). `[VERIFIED-LIVE]`
- Public, keyless endpoints exist for **models, pricing, attestation reports, Intel Trust Authority tokens, health** — enough to build preflight verification with zero credentials. `[VERIFIED-LIVE]`
- Verifiable private inference is real and currently operable for a subset of models: `18` of `64` listed models report `verifiable: true` in `/v1/model/list`. `[VERIFIED-LIVE]`
- Response signatures are **not** returned inline. You fetch them after the fact from `GET /v1/signature/{chat_id}` with your key, over a SHA-256 hash of the exact request/response bytes. `[VERIFIED-DOC]`
- Attestation is now split: **Gateway TEE** (`gateway_attestation`) and **model TEE** (`model_attestations[]`), plus optional ITA JWT. The docs explicitly warn this is **not yet a complete end-to-end chain**. `[VERIFIED-DOC]`
- Official JS/TS SDK exists: `@nearai/inference-sdk@0.3.0` (MIT, ESM). It requires **Node >= 24.22.1**, while MEND declares `node >= 22`. `[VERIFIED-LIVE]` (npm) + `[VERIFIED-DOC]`
- Structured output is advertised per-model (`json_mode`, `structured_outputs`) and claimed for Chat Completions in docs, but `response_format` is **not enumerated in the live OpenAPI request schema** and I could not test it without a key. `[VERIFIED-LIVE]` / `[UNVERIFIED]`
- Streaming (SSE) is documented; streamed completions are **gateway-signed by default** because the gateway rewrites bytes (strips per-chunk usage). `[VERIFIED-DOC]`
- Recommended primary triage model: `z-ai/glm-5.3-flash` — verifiable, `$0.08/$0.50` per 1M tokens, 1M context, tools + JSON/structured outputs. `[VERIFIED-LIVE]`

---

## 1. Base URLs and authentication

### 1.1 Base URLs

| Purpose | URL | Evidence |
| - | - | - |
| OpenAI-compatible API base | `https://cloud-api.near.ai/v1` | `[VERIFIED-DOC]` quickstart + JS SDK page; `[VERIFIED-LIVE]` SDK type constant `DEFAULT_NEAR_AI_CLOUD_BASE_URL = "https://cloud-api.near.ai/v1"` |
| Gateway host (non-`/v1` routes, e.g. health) | `https://cloud-api.near.ai` | `[VERIFIED-LIVE]` |
| Dashboard / key management | `https://cloud.near.ai` (redirects to `/signin` when unauthenticated) | `[VERIFIED-LIVE]` HTTP `307 -> /signin` |
| Docs | `https://docs.near.ai` (Mintlify; `llms.txt`, `llms-full.txt`, `/api-reference/openapi.json`) | `[VERIFIED-LIVE]` |
| **Retired** developer hub | `https://api.near.ai/v1/*` | `[VERIFIED-LIVE]` **HTTP 410** |

Raw 410 from the retired host `[VERIFIED-LIVE]`:

```http
HTTP/2 410
content-type: application/json
server: cloudflare

{
  "detail": "The NEAR AI Developer Hub and Completions API were retired on October 31, 2025. We recommend switching to our new private, confidential completions API at https://cloud.near.ai."
}
```

> Decision input: any doc/tutorial that points at `api.near.ai` or "NEAR AI Developer Hub" is stale. Only `cloud-api.near.ai` is valid.

### 1.2 Auth header

`[VERIFIED-DOC]` OpenAPI `securitySchemes.api_key`:

```yaml
api_key:
  type: http
  scheme: bearer
  bearerFormat: api_key
  description: 'API key for programmatic access (Authorization: Bearer sk-<api_key>)'
```

`[VERIFIED-LIVE]` — exact 401 bodies (no key vs. bad key):

```http
POST https://cloud-api.near.ai/v1/chat/completions        HTTP/2 401
{"error":{"message":"Missing authorization header","type":"missing_auth_header","param":null,"code":null}}
```

```http
POST https://cloud-api.near.ai/v1/chat/completions        HTTP/2 401
Authorization: Bearer sk-not-a-real-key
{"error":{"message":"Invalid or expired API key","type":"invalid_api_key","param":null,"code":null}}
```

Notes:
- API keys are created per **workspace** in the dashboard (`POST /v1/workspaces/{workspace_id}/api-keys` in OpenAPI). `[VERIFIED-DOC]`
- A newly created key can take **up to 10 seconds** to become active for auth due to caching. `[VERIFIED-DOC]`
- `Authorization` is the only credential header for `/v1/chat/completions`. `x-api-key` is *not* used there; `/v1/messages` accepts either (see §8). `[VERIFIED-LIVE]`

### 1.3 Request/response headers that matter

| Header | Direction | Meaning | Evidence |
| - | - | - | - |
| `Authorization: Bearer <key>` | request | auth | `[VERIFIED-DOC]` / `[VERIFIED-LIVE]` 401s |
| `x-no-aliasing: true` | request | Fail instead of silently resolving a model alias. Required for `provider_tee` signature verification. | `[VERIFIED-DOC]` |
| `X-Request-Id` | response | Opaque support/debug correlation. **Not** billing, **not** W3C trace. Client may send a non-sensitive UUID. | `[VERIFIED-DOC]` |
| `inference-id` | response | **Billing request ID** for `/v1/chat/completions` and `/v1/messages`, streaming and non-streaming. UUIDv5 of body `id` in DNS namespace. Use this for per-request cost. | `[VERIFIED-DOC]` |
| `X-Org-Id`, `X-Workspace-Id` | internal | Public clients cannot set or override. | `[VERIFIED-DOC]` |
| `X-Client-Pub-Key`, `X-Model-Pub-Key`, `X-Encryption-Version: 2` | request | E2EE Chat only. | `[VERIFIED-DOC]` |
| `X-Generation-Id` | response | System One receipt ID (`decisionId`). | `[VERIFIED-DOC]` |
| `Retry-After` | response | On 429 (esp. anonymous attestation). | `[VERIFIED-DOC]` |

### 1.4 Keyless (public) endpoints — all tested

`[VERIFIED-LIVE]` unless noted.

| Endpoint | Status | Notes |
| - | - | - |
| `GET /v1/models` | `200`, 65,701 bytes, 64 models | `vary: Authorization` — the list can differ by key (unlisted org models) |
| `GET /v1/model/list` | `200`, 79,188 bytes, 64 models | Pricing in nano-USD + `metadata.verifiable` |
| `GET /v1/model/{url-encoded-name}` | `200` | Must URL-encode `/` (raw slash → `404`) |
| `GET /v1/attestation/report` | `200` | No key needed; non-billable |
| `GET /v1/attestation/ita-token` | `200`, 6,604 bytes (gateway only) | Intel Trust Authority JWT |
| `GET /v1/health` | `200` `{"status":"ok","version":"0.0.0"}` | `GET /health` is **404** |
| `GET /v1/services` | `200` | Platform service pricing (e.g. `web_search`) |
| `POST /v1/chat/completions` | `401` | key required |
| `GET /v1/signature/{id}` | `401` | key required (docs `security: api_key`) |

`GET /v1/models` response headers `[VERIFIED-LIVE]`:

```http
HTTP/2 200
server: nginx/1.29.1
content-type: application/json
content-length: 65701
vary: Authorization
vary: origin, access-control-request-headers
vary: accept-encoding
cache-control: no-store
access-control-expose-headers: *
x-request-id: 10db98c0-d763-4d9e-9126-e5d75aa7c3e9
alt-svc: h3=":8443"; ma=86400
```

---

## 2. Models

### 2.1 Catalog facts

- `GET /v1/models` returned **64** entries. `[VERIFIED-LIVE]`
- `GET /v1/model/list` returned **64** entries; **18** have `metadata.verifiable: true`. `[VERIFIED-LIVE]`
- `/v1/models` fields include: `id`, `object`, `created`, `owned_by`, `name`, `hugging_face_id`, `pricing` (USD per 1M tokens), `context_length`, `max_output_length`, `architecture`, `input_modalities`, `output_modalities`, `supported_sampling_parameters`, `supported_features`, `is_ready`, `description`, `datacenters`, `openrouter.slug`, `top_provider`. `[VERIFIED-LIVE]`
- `/v1/model/list` fields: `modelId`, `inputCostPerToken`/`outputCostPerToken`/`cacheReadCostPerToken`/`costPerImage` as `{amount, scale, currency}` (nano-USD: `amount / 10^scale` per token), and `metadata` with `verifiable`, `attestationSupported`, `providerType`, `aliases`, `contextLength`, `maxOutputLength`, `supportedFeatures`, `providerConfig`, `huggingFaceId`, `quantization`. `[VERIFIED-LIVE]`
- Privacy tiers are defined in docs: **Confidential TEE** (NEAR fleet), **3P Confidential TEE** (`Attested 3P`, e.g. Chutes), **Incognito** (external provider, no TEE guarantee). `[VERIFIED-DOC]`

**Important:** `/v1/models` has `is_ready`; `/v1/model/list` has `verifiable`/`attestationSupported`/`providerType`. You need **both** endpoints for a safe model selection. `[VERIFIED-LIVE]`

### 2.2 Recommended candidates for MEND (all data from live `/v1/models` + `/v1/model/list`)

| Model ID (canonical) | Verifiable | providerType | In $/1M | Out $/1M | Cache read | Context | Max out | Features | `is_ready` |
| - | - | - | - | - | - | - | - | - | - |
| `z-ai/glm-5.3-flash` | ✅ | `vllm` | 0.08 | 0.50 | 0.012 | 1,048,576 | 1,048,576 | tools, structured_outputs, json_mode, reasoning | true |
| `Qwen/Qwen3.8-27B` | ✅ | `vllm` | 0.04 | 1.35 | 0.018 | 262,144 | 65,536 | tools, structured_outputs, reasoning | true |
| `Qwen/Qwen3.6-35B-A3B-FP8` | ✅ | `vllm` | 0.17 | 1.10 | 0.056 | 262,144 | 8,192 | tools, json_mode, structured_outputs, logprobs, reasoning | true |
| `deepseek-ai/DeepSeek-V4.1-Flash-1017` | ✅ | `vllm` | 0.30 | 1.20 | 0.006 | 1,048,576 | 393,216 | tools, reasoning (no json_mode/structured_outputs advertised) | true |
| `moonshotai/kimi-k3` | ✅ | `chutes` (3P) | 3.30 | 16.50 | 0.33 | 1,048,576 | 65,535 | tools, json_mode, structured_outputs, reasoning | true |
| `openai/privacy-filter` | ✅ | `vllm` | 0.01 | 0.00 | — | 128,000 | 1,024 | PII span detection | (not flagged) |
| `Qwen/Qwen3-Embedding-0.6B` | ✅ | `vllm` | 0.01 | 0.01 | — | 32,768 | 1,024 | embeddings | (not flagged) |
| `Qwen/Qwen3-Reranker-0.6B` | ✅ | `vllm` | 0.01 | 0.01 | — | 40,960 | 1,024 | rerank | (not flagged) |
| `openai/gpt-6-luna` | ❌ | `external` | 0.10 | 0.50 | 0.01 | 1,050,000 | 128,000 | structured_outputs, json_mode, reasoning | true |
| `openai/gpt-6-sol` | ❌ | `external` | 2.00 | 10.00 | 0.20 | 1,050,000 | 128,000 | structured_outputs, json_mode, reasoning | true |

`[VERIFIED-LIVE]` for every cell above.

Other verified observations:
- Many listed OpenAI/Gemini models are **`is_ready: false`** (e.g. `openai/gpt-5.4`, `google/gemini-2.5-flash`). A model appearing in `/v1/models` does **not** mean it can serve. `[VERIFIED-LIVE]`
- `openai/gpt-6-*` descriptions say *"Tool calling is not currently advertised through NEAR AI Cloud."* `[VERIFIED-LIVE]`
- `Qwen/Qwen3.8-27B` description says "Served privately from NEAR AI's attested TEE infrastructure" (for the abliterated variant); `Qwen/Qwen3.8-27B` itself is `vllm` + verifiable. `[VERIFIED-LIVE]`
- `z-ai/glm-5.3-flash` aliases include `zai-org/GLM-5.3-Flash`, `zai-org/GLM-5.1-FP8`, `glm-latest`, `z-ai/glm-5.2`, `deepseek-ai/DeepSeek-V4-Flash`. `[VERIFIED-LIVE]`
- `z-ai/glm-5.3-flash` has `providerConfig.long_context.inference_url = https://glm-5-3-flash-long.completions.near.ai`, `base_max_context_tokens: 100000`, `max_context_tokens: 1048576`. Long-context requests are routed to a **direct completion host**, not the gateway. `[VERIFIED-LIVE]`

### 2.3 Model selection caveat (critical for signatures)

The docs quickstart example uses `zai-org/GLM-5.1-FP8`, which is **not a canonical model ID** — it is an alias of `z-ai/glm-5.3-flash` (confirmed in `metadata.aliases`). Sending an alias is valid for plain inference, but `provider_tee` signature text contains the **canonical** model ID, and the docs require the canonical ID plus `x-no-aliasing: true` for verification. `[VERIFIED-LIVE]` + `[VERIFIED-DOC]`

---

## 3. Inference

### 3.1 Chat Completions (the path MEND should use)

`[VERIFIED-DOC]` + `[UNVERIFIED]` (auth path not executed — no key):

```bash
curl https://cloud-api.near.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NEARAI_API_KEY" \
  -H "x-no-aliasing: true" \
  -H "Accept-Encoding: identity" \
  -d '{
    "model": "z-ai/glm-5.3-flash",
    "messages": [{"role": "user", "content": "Classify this repair report."}],
    "temperature": 0.1,
    "max_tokens": 512
  }'
```

Live proof that the endpoint exists and enforces auth `[VERIFIED-LIVE]`:

```http
HTTP/2 401
{"error":{"message":"Missing authorization header","type":"missing_auth_header","param":null,"code":null}}
```

Documented response shape `[VERIFIED-DOC]` (from quickstart; note `reasoning_content` and `usage.completion_tokens_details.reasoning_tokens` for reasoning models):

```json
{
  "id": "f47b4647911249f7a94468f6c2b95832",
  "object": "chat.completion",
  "created": 1780405025,
  "model": "zai-org/GLM-5.1-FP8",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "...", "reasoning_content": "..." },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 11,
    "completion_tokens": 70,
    "completion_tokens_details": { "reasoning_tokens": 21 },
    "reasoning_tokens": 21,
    "total_tokens": 81
  }
}
```

Request schema `[VERIFIED-LIVE]` from the live OpenAPI (`/api-reference/openapi.json`): `model`, `messages`, `frequency_penalty`, `max_tokens`, `n`, `presence_penalty`, `stop`, `stream`, `temperature`, `top_p`, plus `additionalProperties: {}`. Response `id` is required — that ID is the signature key later.

### 3.2 Streaming

- SSE supported: `stream: true`; docs show `for await (const chunk of stream)`. `[VERIFIED-DOC]`
- **Signature implication:** the gateway signs streamed completions itself by default because it removes per-chunk usage data (it changes the bytes). So streamed responses generally yield `signature_kind: "gateway"`, not `provider_tee`. `[VERIFIED-DOC]`
- You must consume the whole stream before calling `verifyResponse(id)`. `[VERIFIED-DOC]`
- Hash the **uncompressed raw bytes**, including stream framing and terminal events. Use `Accept-Encoding: identity` or hash after client decompression. `[VERIFIED-DOC]`

### 3.3 Structured output / JSON mode

- Docs claim Chat Completions supports "tool calling, structured outputs". `[VERIFIED-DOC]`
- Per-model capability is advertised in `/v1/models.supported_features` and `/v1/model/list.metadata.supportedFeatures`: `json_mode`, `structured_outputs`, `tools`. `[VERIFIED-LIVE]`
- **Gap:** the live OpenAPI `ChatCompletionRequest` does **not** list `response_format` / `json_schema`; it relies on `additionalProperties: {}`. `[VERIFIED-LIVE]`
- I could not execute a real structured-output request (key required). Treat the exact accepted `response_format` shape (OpenAI `json_schema` vs. `json_object`) as `[UNVERIFIED]` until a funded key test is run.

### 3.4 Other documented inference surfaces

| Surface | Status |
| - | - |
| `POST /v1/responses` | Live (`401` unauthenticated). Stateless only, `store: false`, custom `function` tools only. Responses are **Gateway-signed**. `[VERIFIED-LIVE]` + `[VERIFIED-DOC]` |
| `POST /v1/messages` | **Live but not in OpenAPI** (`401` with Anthropic-shaped error). Gateway-signed. `[VERIFIED-LIVE]` |
| `POST /v1/completions` | Live, legacy text completions. In OpenAPI. `[VERIFIED-LIVE]` |
| `POST /v1/embeddings` | Live (`401` unauthenticated) but **not in OpenAPI paths**. `[VERIFIED-LIVE]` |
| `POST /v1/rerank`, `POST /v1/score` | In OpenAPI. `[VERIFIED-DOC]` |
| `POST /v1/privacy/classify`, `POST /v1/privacy/redact` | In OpenAPI; TEE-hosted PII detection/redaction. `[VERIFIED-DOC]` |
| `POST /v1/audio/transcriptions`, `/v1/images/*` | In OpenAPI. `[VERIFIED-DOC]` |

### 3.5 E2EE (optional)

`[VERIFIED-DOC]`:
- E2EE is disabled by default; enabled with `e2ee: true` in the SDK.
- Requires a verified NEAR TEE model and a quote-bound model public key.
- Chat request headers: `X-Client-Pub-Key`, `X-Model-Pub-Key`, `X-Encryption-Version: 2`, plus `x-no-aliasing: true`.
- Flow: generate Ed25519 client keypair → fetch+verify model attestation → select `signing_public_key` from the *verified* report → encrypt → send → decrypt response.
- Not supported for Responses/Messages/System One; OHTTP incompatible with `signing_algo: 'ecdsa'`.

---

## 4. Attestation and response-signature verification

This is the part MEND must get exactly right. Everything below is `[VERIFIED-DOC]` unless marked `[VERIFIED-LIVE]`.

### 4.1 Two separate pieces of evidence

| Piece | Endpoint | Field | What it proves |
| - | - | - | - |
| Gateway attestation | `GET /v1/attestation/report` | `gateway_attestation` | The TLS/gateway endpoint (`cloud-api.near.ai`) is a genuine TEE with a measured config. Not the model. |
| Model attestation | `GET /v1/attestation/report?model=<id>&provider=near` | `model_attestations[]` | A NEAR model-serving TEE, signer identity, optional GPU evidence. |
| ITA token (alternative/complement) | `GET /v1/attestation/ita-token` | `gateway.token`, `models[].token` | Intel Trust Authority-signed JWT evidence (PS384), verifiable against Intel JWKS. |
| Response signature | `GET /v1/signature/{chat_id}` | `text`, `signature`, `signing_address`, `signing_algo`, `signature_kind` | Binds the exact request/response bytes to a signer. |

Docs' own warning: *"Preflight Gateway and model evidence plus one response signature do not yet form a complete model-to-Gateway-to-final-response chain."* `[VERIFIED-DOC]`

### 4.2 Gateway preflight — exact request and fields

`[VERIFIED-DOC]` request (nonce = 32 random bytes as 64 hex chars, client-generated):

```bash
NONCE="$(openssl rand -hex 32)"

curl --fail-with-body -G 'https://cloud-api.near.ai/v1/attestation/report' \
  --data-urlencode 'signing_algo=ecdsa' \
  --data-urlencode "nonce=${NONCE}" \
  -H 'Accept: application/json'
```

`[VERIFIED-LIVE]` — I ran this (no key). Response `200`, `69,584` bytes, top-level keys:

```
gateway_attestation: {signing_address, signing_algo, intel_quote, event_log, report_data, request_nonce, info}
ohttp_key_config:     90-char hex
ohttp_attestation:    {signing_algo, signing_key, key_config, signature}
```

`gateway_attestation.info` keys observed `[VERIFIED-LIVE]`:
`app_id, instance_id, app_cert, tcb_info, app_name, device_id, mr_aggregated, os_image_hash, key_provider_info, compose_hash, vm_config`.

With `include_tls_fingerprint=true` `[VERIFIED-LIVE]`: adds `gateway_attestation.tls_cert_fingerprint` (64 hex = SHA-256 of cert SPKI) and a top-level `tls_certificate` (PEM).

**I independently verified the report_data layout** `[VERIFIED-LIVE]`:

| Case | Layout | My test |
| - | - | - |
| No TLS binding | `report_data[0:32]` = signer identity right-zero-padded to 32 bytes; `report_data[32:64]` = nonce | `first32 == addr + 0x00*pad` → **True**; `last32 == request_nonce` → **True** |
| With TLS binding | `report_data[0:32]` = `SHA-256(decoded_signing_identity || decoded_tls_fingerprint)`; `report_data[32:64]` = nonce | `first32 == sha256(addr||fp)` → **True**; `last32 == nonce` → **True** |

- ECDSA `signing_address` = 20-byte Ethereum-style address (42 chars with `0x`). Ed25519 = 32-byte key, 64 hex chars. `[VERIFIED-LIVE]`
- `info.tcb_info.app_compose` is the measured config. MRCONFIGID = `0x01 || SHA-256(app_compose UTF-8 bytes) || 15 zero bytes` (48 bytes). Hash raw bytes, do not parse/reserialize. `[VERIFIED-DOC]`
- RTMR3 replay: start from 48 zero bytes, `RTMR3 = SHA-384(RTMR3 || event.digest)` per event; require equality with the verified quote's RTMR3. `[VERIFIED-DOC]`
- Verify `intel_quote` with an Intel DCAP verifier (docs recommend `dcap-qvl`). **The quote is the source of truth; HTTP fields are only consistency checks.** `[VERIFIED-DOC]`

### 4.3 Model preflight — exact request and fields

`[VERIFIED-DOC]`:

```bash
curl --fail-with-body -G 'https://cloud-api.near.ai/v1/attestation/report' \
  --data-urlencode 'model=z-ai/glm-5.3-flash' \
  --data-urlencode 'provider=near' \
  --data-urlencode 'include_tls_fingerprint=false' \
  --data-urlencode 'signing_algo=ecdsa' \
  --data-urlencode "nonce=${NONCE}" \
  -H 'Accept: application/json' \
  -H 'x-no-aliasing: true'
```

`[VERIFIED-LIVE]` — I ran this (no key): `200`, `279,078` bytes, top-level `gateway_attestation`, `model_attestations` (len 1), `ohttp_*`.

`model_attestations[0]` keys observed `[VERIFIED-LIVE]`:

```
model_name, signing_address, signing_algo, signing_public_key, request_nonce,
intel_quote, nvidia_payload, event_log, info, ohttp_attestation,
compose_manager_attestation, ohttp_key_config
```

- **`report_data` is absent from model reports** — matches docs ("Not currently returned in model reports. Read report data from the verified quote."). `[VERIFIED-LIVE]` + `[VERIFIED-DOC]`
- `signing_public_key` is the E2EE key: with `signing_algo=ed25519` the Ed25519 key; with `ecdsa` the secp256k1 key. `[VERIFIED-DOC]`
- `provider=near` requests NEAR model evidence; it does **not** pin the serving provider for the later completion. `[VERIFIED-DOC]`
- If the model has no attestation (e.g. Incognito `openai/gpt-6-luna`) the endpoint returns **`503`** `[VERIFIED-LIVE]`:

```json
{"error":{"message":"Provider error: No provider found that supports attestation reports for model: openai/gpt-6-luna","type":"provider_error","param":null,"code":null}}
```

- Invalid nonce format → `400` `[VERIFIED-LIVE]`:

```json
{"error":{"message":"Invalid parameter: Invalid nonce format: Invalid character 'z' at position 0","type":"invalid_request_error","param":"nonce","code":null}}
```

- **If `nonce` is omitted, the server generates one and echoes it in `request_nonce`.** I observed this. That is not client-established freshness; MEND must always send its own nonce. `[VERIFIED-LIVE]`

### 4.4 Response signature

`[VERIFIED-DOC]` + `[VERIFIED-LIVE]` (endpoint exists, `401` without key):

```bash
curl --fail-with-body -G 'https://cloud-api.near.ai/v1/signature/<CHAT_ID>' \
  --data-urlencode 'signing_algo=ecdsa' \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer <YOUR_NEAR_AI_CLOUD_API_KEY>'
```

Response schema `[VERIFIED-DOC]` (required fields): `text`, `signature`, `signing_address`, `signing_algo`; optional `signature_kind` (`"provider_tee"` | `"gateway"` | omitted for legacy records).

Signed payload `[VERIFIED-DOC]`:

| `signature_kind` | `text` | Preflight match required |
| - | - | - |
| `provider_tee` | `<MODEL_ID>:<request_hash>:<response_hash>` | exactly one verified model report with same `signing_address` + `signing_algo` |
| `gateway` | `<request_hash>:<response_hash>` | verified `gateway_attestation` with same signer + algo |

where `request_hash = SHA-256(exact request-body bytes)` and `response_hash = SHA-256(exact response-body bytes)`.

Verification rules `[VERIFIED-DOC]`:
- `ecdsa`: recover the Ethereum EIP-191 signer from `text`+`signature`, compare with `signing_address`.
- `ed25519`: verify UTF-8 bytes of `text` using `signing_address` as the public key.
- Reject unsupported algorithms.
- A `2xx` response that contains `error_code` + `message` is an **unavailable** result, not a signature. `404` = not found (retry with bounded backoff).
- `signature_kind` absent/unfamiliar → treat as unavailable. Do not infer from `text` shape.
- `provider_tee` requires the canonical model ID; aliases break the hash. `x-no-aliasing: true` prevents silent rewriting.
- Instances of the same model **share one signing key**, so a matching signer does not prove the exact serving instance.
- A report fetched after the completion cannot replace preflight evidence.

**Defaults differ** `[VERIFIED-DOC]`: `/v1/signature` defaults to `ecdsa`; `/v1/attestation/report` defaults to `ed25519` for the gateway report and `ecdsa` for model reports.

`[VERIFIED-LIVE]` caveat: on 2026-11-09 I saw a no-`signing_algo` gateway report return `ed25519` five times in a row, but one earlier no-param call returned `ecdsa` (`0xb98a…`). **Always send `signing_algo` explicitly** on both the report and signature request, and store which algo you used.

### 4.5 Intel Trust Authority (ITA) path

`[VERIFIED-LIVE]` — public, no key:

```bash
curl -G 'https://cloud-api.near.ai/v1/attestation/ita-token' \
  --data-urlencode 'model=z-ai/glm-5.3-flash' \
  --data-urlencode "nonce=$(openssl rand -hex 32)"
```

Response `200`, 36,064 bytes with model; 6,604 bytes without model. Top-level keys:

```
gateway: {token, token_type, attestation_type, token_signing_alg}
models:  [ {model, token, token_type, attestation_type, token_signing_alg} ]
jwks_url: "https://portal.trustauthority.intel.com/certs"
policy_ids: []
policy_must_match: false
nonce: "<echoed nonce>"
```

- JWT header alg = `PS384`; issuer `https://portal.trustauthority.intel.com`; includes `tdx_*` appraisal claims and `verifier_nonce`. `[VERIFIED-LIVE]`
- When no nonce is supplied, the server generates one (observed different from any input). Send your own for freshness. `[VERIFIED-LIVE]`
- The docs page lists this as a **public endpoint by explicit decision** (`nearai/infra#193`), carrying only ITA-signed TEE evidence, bounded by upstream ITA rate limits (`429`). `[VERIFIED-DOC]`
- `provider` is **not** a documented parameter for this endpoint; I passed it and it was ignored (model evidence was returned anyway). `[VERIFIED-LIVE]`

### 4.6 Verification flow MEND should implement

```
1. nonce = 32 random bytes (hex, 64 chars); retain it
2. GET /v1/attestation/report?signing_algo=ecdsa&nonce=...          -> gateway_attestation
3. GET /v1/attestation/report?model=<CANONICAL>&provider=near
       &signing_algo=ecdsa&nonce=<same>&include_tls_fingerprint=false
       &x-no-aliasing: true                                          -> model_attestations[]
4. Reject if model_attestations is missing/empty
5. Verify EVERY candidate: dcap quote, TCB policy, report_data binding,
   request_nonce echo, RTMR3 replay, MRCONFIGID == 01||sha256(app_compose)||0*15
6. Send completion with canonical model, x-no-aliasing: true,
   Accept-Encoding: identity; retain exact request/response bytes
7. GET /v1/signature/<body.id>?signing_algo=ecdsa  (Authorization: Bearer)
8. Recompute hashes; assert text == "<model_id>:<req>:<resp>" (or "<req>:<resp>")
9. Recover/verify signature; match signing_address+signing_algo against
   exactly one retained verified report (provider_tee) or the gateway report
10. Persist: report(s), nonce, request/response hashes, signature, signature_kind,
    model id, inference-id
```

---

## 5. SDK

`[VERIFIED-LIVE]` npm registry (2026-11-09):

| Field | Value |
| - | - |
| Package | `@nearai/inference-sdk` |
| Latest | `0.3.0` (published `2026-11-08T12:18:42Z`) |
| Dist-tags | `latest: 0.3.0`, `next: 0.3.0-rc.1` |
| License | MIT |
| Module type | ESM (`"type":"module"`) |
| Engines | **`node >=24.22.1`** |
| Exports | `.` (browser/default) and `./node` |
| Types | `./dist/index.d.ts`, `./dist/node.d.ts` |
| Repo | `https://github.com/nearai/inference-sdk` (`js/` directory) |
| Key deps | `openai`, `@anthropic-ai/sdk`, `@phala/dcap-qvl`, `ethers`, `jose`, `tweetnacl`, `@noble/*`, `ohttp-ts`, `valibot`, `hpke` |

Documented usage `[VERIFIED-DOC]`:

```javascript
import { InferenceClient } from '@nearai/inference-sdk/node';

const client = new InferenceClient({
  baseUrl: 'https://cloud-api.near.ai/v1',
  apiKey: process.env.NEARAI_API_KEY,
  e2ee: true,
});

const completion = await client.chat.completions.create({
  model: 'z-ai/glm-5.3-flash',
  messages: [{ role: 'user', content: 'Reply with the word ok.' }],
});

const verified = await client.verifyResponse(completion.id);
console.log(verified.signatureKind);
```

Exact API surface from the shipped `.d.ts` `[VERIFIED-LIVE]`:
- `new InferenceClient(options)`; options include `baseUrl`, `apiKey`, `e2ee?`, `ohttp?`, `signingAlgo?`, `attestationCacheTimeToLiveMs?`, `responseCacheTimeToLiveMs?`, `gatewayVerification?`, `modelVerification?`, `deploymentPolicy?`.
- `client.chat.completions.create(...)`, `client.responses.create(...)`, `client.messages.create(...)`, `client.systemone.create(...)`.
- `client.verify(model): Promise<AttestationResult>`, `client.verifyResponse(id): Promise<VerificationResult>`, `client.clearResponseCache()`.
- `VerifiedModelCompletionResult`: `{ id, completionId (deprecated), signatureKind: 'provider_tee', signature, attestations[], attestation (deprecated) }`.
- `VerifiedGatewayCompletionResult` has `signatureKind: 'gateway'`.
- `VerificationError` exposes `failure.code` and `retryable`; `ApiError` likewise.
- Defaults: `attestationCacheTimeToLiveMs` = 60 min; `responseCacheTimeToLiveMs` = 60 min. Set `0` to verify every request.
- Node entry captures the TLS peer certificate and pins SPKI; the browser entry (`@nearai/inference-sdk`) **cannot** bind TLS.
- `DEFAULT_NEAR_AI_CLOUD_BASE_URL = "https://cloud-api.near.ai/v1"`.
- Constants/helpers exported include `NO_ALIASING_HEADER`, `verifyGatewayAttestation`, `verifyModelAttestation`, `verifyGatewayResponse`, `verifyModelResponse`, `findModelAttestationsForSignature`, `createTdxQuoteVerifier`, `createGpuEvidenceVerifier`, `createOhttpFetch`, `prepareE2eeChatRequest`.

Docs note `[VERIFIED-DOC]`: the JS SDK verifies Chutes model attestation, while the Python SDK verifies the Gateway only.

**MEND mismatch:** local Node is `v26.0.0` (fine), but `package.json` declares `"engines": {"node": ">=22"}` and CI may use Node 22, which is below the SDK's `>=24.22.1`. An `npm install` under Node 22 will warn or fail depending on config. `[VERIFIED-LIVE]`

---

## 6. Pricing, credits, limits

`[VERIFIED-DOC]` + `[VERIFIED-LIVE]`:
- Pricing is **pay-per-use, per token**, quoted per 1M tokens in `/v1/models.pricing` and as nano-USD-per-token in `/v1/model/list` (`amount/10^scale`). Both agree (GLM 5.3 Flash: `0.08` / `0.50` per 1M ⇔ `80` / `500` nano-USD per token).
- Prompt-cache reads are discounted and reported as `pricing.input_cache_read` (GLM 5.3 Flash: `$0.012`/1M). `[VERIFIED-LIVE]`
- Credits are purchased in the dashboard ("Credits" section); API keys are generated per workspace. `[VERIFIED-DOC]`
- Staking-for-inference: stake NEAR, and **staking rewards** (not principal) convert to credits. *"One credit is worth one US dollar of usage... unused credits carry forward."* `[VERIFIED-DOC]`
- Per-request cost: `POST /v1/billing/costs` with body `{"requestIds": ["<inference-id>"]}` → `{"requests":[{"requestId","costNanoUsd"}]}`. Accepts up to 10,000 IDs. Costs can lag a few seconds. `[VERIFIED-DOC]`
- Limits:
  - Default **64 concurrent requests per model per organization**; excess → `429`. `[VERIFIED-DOC]`
  - Anonymous attestation requests share a **small concurrency limit**; on `429` honor `Retry-After` or send a key. `[VERIFIED-DOC]`
  - `402` = insufficient credits. `[VERIFIED-DOC]`
  - `429` error types: `rate_limit_exceeded`, `service_overloaded`. `[VERIFIED-DOC]`
- Attestation report retrieval is **non-billable** and creates no usage/billing record. `[VERIFIED-DOC]`

No free tier was found in the docs or endpoints. `[UNVERIFIED]` (absence of evidence, not a tested denial)

---

## 7. Limitations and failure modes

### 7.1 Verification limitations (documented)

1. **No complete chain yet.** Gateway evidence + model evidence + one signature do not form a model→gateway→client chain. A `gateway` signature proves the gateway signed the bytes, not that the model produced them. A `provider_tee` signature does not bind its bytes to gateway/TLS evidence. `[VERIFIED-DOC]`
2. **Streaming defaults to gateway signatures** because the gateway rewrites bytes (strips usage). `[VERIFIED-DOC]`
3. **Responses and Messages use gateway signatures only** — no `provider_tee`. `[VERIFIED-DOC]`
4. **Signing key is shared per model**, not per instance; matching signer ≠ same serving instance. `[VERIFIED-DOC]`
5. **Model attestation says nothing about which instance served your request**, and `model_attestations[]` is not an inventory. `[VERIFIED-DOC]`
6. **Signatures can be unavailable**: `404`, or `200` with `error_code`+`message` (e.g. disconnected stream). Must be treated as unverified, with a short bounded retry. `[VERIFIED-DOC]`
7. **Legacy signatures may omit `signature_kind`** → provenance unknown → must reject if policy requires it. `[VERIFIED-DOC]`
8. **Signature retrieval is post-hoc and keyed**: requires the completion `id` (or `resp_*`), a valid API key, and (in the SDK) the same client instance within the 60-minute response cache. `[VERIFIED-DOC]`
9. **Attestation is non-billable but rate-limited** and can `503`/`429`/`502`/`504` (ITA path). `[VERIFIED-LIVE]` / `[VERIFIED-DOC]`
10. **Aliasing silently changes the canonical ID**, breaking `provider_tee` text unless `x-no-aliasing: true` is sent. `[VERIFIED-DOC]`
11. **Long-context routes may bypass the gateway** (`providerConfig.long_context.inference_url` is a direct model host). Direct verification is documented as **experimental**. `[VERIFIED-LIVE]` + `[VERIFIED-DOC]`
12. **3P/Chutes models** (`kimi-k3`, `qwen3.5-397b-a17b`) use provider attestation; verify via Chutes docs; JS SDK supports it, Python does not. `[VERIFIED-DOC]`

### 7.2 Operational failure modes (tested or documented)

| Condition | Observed/expected | Evidence |
| - | - | - |
| No `Authorization` | `401` `missing_auth_header` | `[VERIFIED-LIVE]` |
| Invalid/expired key | `401` `invalid_api_key` | `[VERIFIED-LIVE]` |
| New key not yet active | up to 10 s propagation | `[VERIFIED-DOC]` |
| Insufficient credits | `402` | `[VERIFIED-DOC]` |
| Concurrency/rate | `429` + `Retry-After` | `[VERIFIED-DOC]` |
| Attestation for non-attested model | `503` `provider_error` | `[VERIFIED-LIVE]` |
| Invalid nonce | `400` `invalid_request_error`, `param: "nonce"` | `[VERIFIED-LIVE]` |
| `GET /health` (no `/v1`) | `404` | `[VERIFIED-LIVE]` |
| `GET /v1/models/<name>` | `401` before routing (undocumented path) | `[VERIFIED-LIVE]` |
| Raw `/` in `/v1/model/{name}` | `404` | `[VERIFIED-LIVE]` |
| `GET /v1/models/pricing` | `401` (does not exist; path is `/v1/model/list`) | `[VERIFIED-LIVE]` |
| Signature not found | `404`, retry bounded | `[VERIFIED-DOC]` |
| Stream disconnected | `200` + unavailable body | `[VERIFIED-DOC]` |
| E2EE on non-NEAR model | error (requires model evidence) | `[VERIFIED-DOC]` |

### 7.3 Ambiguities that remain

- Whether `response_format` (`json_schema` / `json_object`) is accepted verbatim, and whether strict schema validation is enforced. `[UNVERIFIED]`
- Exact latency/throughput and cold-start behavior. `[UNVERIFIED]`
- Whether signatures are always available for every `provider_tee` model (docs imply best-effort). `[UNVERIFIED]`
- Whether `nvidia_payload` is present for all GPU models (it was present in the one model report I fetched). `[UNVERIFIED]`
- Budget/quota semantics for a brand-new org (whether $0 balance blocks the first request with `402`). `[UNVERIFIED]`

---

## 8. Contradictions: docs vs. live behavior

| # | Docs say | Live observation | Impact |
| - | - | - | - |
| 1 | `GET /v1/models` is public; models page directs you there for pricing | `200` public, but `vary: Authorization` — output can differ with a key (unlisted org models) | Cache keys must include auth context if you ever send a key |
| 2 | Quickstart/streaming examples use `zai-org/GLM-5.1-FP8` | Not a model ID; it is an **alias** of `z-ai/glm-5.3-flash` | Aliases break `provider_tee` signature text |
| 3 | OpenAI Compatibility says Chat Completions supports "structured outputs" | Live OpenAPI `ChatCompletionRequest` does **not** enumerate `response_format`; only `additionalProperties: {}` | Contract is undocumented; capability must be probed |
| 4 | Docs say `/v1/messages` exists and SDK exposes `client.messages` | Endpoint is **live** (`401` Anthropic-shaped error) but **absent from the 93-path OpenAPI spec** | Treat Messages as supported-but-unspecified |
| 5 | Docs list `GET /v1/embeddings` in supported features | Live endpoint responds (`401`) but is **absent from OpenAPI paths** | Same |
| 6 | Health check documented as "Health check ... no auth" | `GET /health` → `404`; `GET /v1/health` → `200` | Use `/v1/health` |
| 7 | Docs: `/v1/attestation/report` defaults to `ed25519` for the gateway | I observed `ed25519` 5×, but one no-param call returned `ecdsa` (`0xb98a…`) | Always pass `signing_algo` explicitly |
| 8 | Docs: model reports omit `report_data` | Confirmed absent in live `model_attestations[0]` | Read report data from the verified quote only |
| 9 | Docs: `model_attestations[]` requested with `model` + `provider=near` | Confirmed; but `provider` is undocumented for `/v1/attestation/ita-token` and is silently ignored there | Don't rely on `provider` for ITA |
| 10 | Docs imply a complete verification story | Docs themselves state the chain is incomplete; `gateway` vs `provider_tee` have different guarantees | Product copy must not overclaim |
| 11 | Package docs say Node 24.22.1; MEND declares Node >=22 | SDK `engines` is `>=24.22.1` | CI/runtime must be bumped or verification hand-rolled |
| 12 | `api.near.ai` historically documented | `410 Gone`, retired 2025-10-31 | Remove any stale URLs/keys |

Additional live observations worth noting:
- `GET /v1/models/z-ai%2Fglm-5.3-flash` returns `401` (auth) while `GET /v1/model/z-ai%2Fglm-5.3-flash` returns `200` public. The plural path has an auth-guarded fallback; don't use it. `[VERIFIED-LIVE]`
- `GET /v1/models/pricing` is `401`, not `404`; the real pricing list is `GET /v1/model/list`. `[VERIFIED-LIVE]`

---

## 9. Implementation decisions for MEND

Concrete, ordered, and compatible with the "no key in the browser" constraint.

1. **Transport**: one server-only module (e.g. `services/ai/nearai.ts`) targeting `https://cloud-api.near.ai/v1`. Read `NEARAI_API_KEY` from server env only. Never import `@nearai/inference-sdk` in a client bundle — its browser entry point exists and will silently skip TLS binding, which is a verification downgrade.

2. **Model choice**: primary `z-ai/glm-5.3-flash` (verifiable, `$0.08/$0.50`, 1M ctx, structured outputs/json_mode, `is_ready: true`); fallback `Qwen/Qwen3.8-27B` (`$0.04/$1.35`, structured outputs). Do **not** use Incognito models (`verifiable: false`) for triage if attestation is a product claim. Always send **canonical IDs** and `x-no-aliasing: true`.

3. **Capability gate at startup**: fetch `/v1/models` (for `is_ready`, `supported_features`, context) **and** `/v1/model/list` (for `verifiable`, `attestationSupported`, `providerType`, aliases). Cache ~10 min. Refuse to route to a model that is not `is_ready`; mark responses from `verifiable: false` models as "unattested" in the UI.

4. **Structured triage output**: attempt OpenAI-style `response_format: {type:"json_schema", json_schema:{name, strict:true, schema}}` behind a feature flag **only after** a funded-key probe proves it works. Until then, use "JSON-only" prompting + schema validation (`valibot` is already an SDK dep; `zod` is fine) + one repair retry. Never trust unvalidated model JSON.

5. **Attestation per request (not per session)** for high-value actions (dispute filing, warranty issuance): client-generated 32-byte nonce, `GET /v1/attestation/report` for gateway + model with the same nonce, `signing_algo=ecdsa` explicit, `x-no-aliasing: true`, and reject empty `model_attestations`. Store the raw report JSON (it is non-billable and public).

6. **Verification engine**: prefer `@nearai/inference-sdk@0.3.0` (`/node` entry) and bump MEND to Node `>=24.22.1` in `package.json` + CI. If the Node bump is blocked, hand-roll using the same primitives: `@phala/dcap-qvl` for the quote, `ethers` for EIP-191 recovery, `@noble/hashes` for SHA-256/SHA-384, and the exact report_data/MRCONFIGID/RTMR3 rules in §4. Budget this as real work — do not ship "verified" UI on a partial implementation.

7. **Signature capture**: force `Accept-Encoding: identity`, retain the exact request bytes and raw response bytes (Buffer, not parsed JSON), then `GET /v1/signature/{id}?signing_algo=ecdsa`. Store `{completionId, requestHash, responseHash, text, signature, signingAddress, signingAlgo, signatureKind, modelId, nonce, reportIds, inferenceId}`. Verify before rendering "verified". Treat `404`, `200`+`error_code`, and missing `signature_kind` as **unverified**, with at most a few short retries.

8. **Use Chat Completions for anything that must be `provider_tee`-verifiable.** Do not use `/v1/responses`, `/v1/messages`, or streaming if model-level response binding is a requirement — those are gateway-signed. If streaming UX is required, label the receipt "gateway-verified", not "model-verified".

9. **Billing/audit**: read the `inference-id` response header (not `x-request-id`) and persist it with the attestation receipt. Use `POST /v1/billing/costs` with `{"requestIds":[…]}` for per-report cost attribution; tolerate `costNanoUsd: 0` for a few seconds after completion.

10. **Privacy guardrail**: run `/v1/privacy/redact` (or the `openai/privacy-filter` model) on report text before any non-verifiable/external model call. Keep raw text only in the encrypted app DB. E2EE is a later phase; if added, use the SDK and Ed25519, and never expose the model public key selection logic to the browser.

11. **Tests**: a contract test suite that runs only when `NEARAI_API_KEY` is set — models list shape, `is_ready`, one completion, signature fetch, report fetch, and a negative test (signature for an unknown ID → `404`). Snapshot the exact verification fields so a NEAR API change fails CI rather than silently weakening guarantees.

---

## 10. What I could not verify

- Any authenticated call (chat completion, signature fetch, billing costs, key validity) — **no API key was provided, and none was invented.**
- `response_format` acceptance and strictness.
- Actual response header `inference-id` presence (documented, not tested).
- Latency, throughput, TTFT.
- Whether every `verifiable: true` model actually returns a signature for every response.
- Real signature `text`/`signature` values (only the documented format).
- E2EE round-trip.
- Whether `nvidia_payload` appears for all GPU-backed model reports.

---

## Sources (all accessed 2026-11-09)

### Live endpoints tested
- `https://cloud-api.near.ai/v1/models`
- `https://cloud-api.near.ai/v1/model/list`
- `https://cloud-api.near.ai/v1/model/z-ai%2Fglm-5.3-flash`
- `https://cloud-api.near.ai/v1/attestation/report` (plain, `model`+`provider=near`, `include_tls_fingerprint=true`, invalid nonce, non-attested model)
- `https://cloud-api.near.ai/v1/attestation/ita-token`
- `https://cloud-api.near.ai/v1/health`, `https://cloud-api.near.ai/health`
- `https://cloud-api.near.ai/v1/services`
- `https://cloud-api.near.ai/v1/chat/completions` (401 only)
- `https://cloud-api.near.ai/v1/signature/none` (401 only)
- `https://cloud-api.near.ai/v1/messages`, `/v1/embeddings`, `/v1/completions`, `/v1/responses` (401/OPTIONS only)
- `https://api.near.ai/v1/models` (410)
- `https://cloud.near.ai/` (307 → `/signin`)
- `https://registry.npmjs.org/@nearai%2Finference-sdk`
- `https://unpkg.com/@nearai/inference-sdk@0.3.0/dist/node.d.ts`
- `https://unpkg.com/@nearai/inference-sdk@0.3.0/dist/index-DmgN998U.d.ts`

### Documentation
- https://docs.near.ai/llms.txt
- https://docs.near.ai/llms-full.txt
- https://docs.near.ai/api-reference/openapi.json
- https://docs.near.ai/cloud/quickstart
- https://docs.near.ai/cloud/models
- https://docs.near.ai/cloud/private-inference
- https://docs.near.ai/cloud/verification
- https://docs.near.ai/cloud/verification/cloud-api/gateway-attestation
- https://docs.near.ai/cloud/verification/cloud-api/model-attestations
- https://docs.near.ai/cloud/verification/cloud-api/response-signatures
- https://docs.near.ai/cloud/verification/cloud-api/tls
- https://docs.near.ai/cloud/verification/cloud-api/image-provenance
- https://docs.near.ai/cloud/verification/reference/quote-nonce-signer
- https://docs.near.ai/cloud/verification/reference/response-signature-verification
- https://docs.near.ai/cloud/verification/reference/verification-policy
- https://docs.near.ai/cloud/inference-sdk
- https://docs.near.ai/cloud/inference-sdk/javascript
- https://docs.near.ai/cloud/guides/openai-compatibility
- https://docs.near.ai/cloud/guides/stateless-responses
- https://docs.near.ai/cloud/guides/prompt-caching
- https://docs.near.ai/cloud/guides/e2ee-chat-completions
- https://docs.near.ai/cloud/guides/usage-reporting
- https://docs.near.ai/cloud/staking-for-inference/overview
- https://docs.near.ai/api-reference/attestation/get-attestation-report
- https://docs.near.ai/api-reference/attestation/get-intel-trust-authority-attestation-token
- https://docs.near.ai/api-reference/attestation/get-completion-or-responses-api-signature
- https://docs.near.ai/api-reference/models/list-models-with-pricing
- https://docs.near.ai/api-reference/models/get-model-details
- https://docs.near.ai/api-reference/chat/create-chat-completion
- https://github.com/nearai/inference-sdk
- https://github.com/nearai/nearai-cloud-verifier
- https://github.com/near-examples/nearai-cloud-verification-example
- https://github.com/Phala-Network/dcap-qvl
- https://github.com/chutesai/chutes-api/blob/main/docs/tee-verification.md
