# @mend/ai-client

Server-side NEAR AI client plus browser-safe privacy/duplicate helpers for MEND
(F02, T02). No API key is required for the default test suite: every model
interaction is replayed from committed fixtures labeled `REPLAY / SIMULATION`.

## Entry points

| Import | Contents | Secret/network? |
|---|---|---|
| `@mend/ai-client` | location, duplicate engine, prompt guard, pHash helper | No |
| `@mend/ai-client/browser` | same browser-safe subset | No |
| `@mend/ai-client/server` | `nearAiClient`, recorded replay, verification, scope/review, protocol validation, privacy image transforms | Yes (live client only) |

`nearAiClient` is **not** exported from `.` or `./browser`. `assertServerRuntime()`
also rejects construction when a browser `window` exists.

## NEAR AI client

Environment variables (server only):

```text
NEAR_AI_BASE_URL   default https://cloud-api.near.ai/v1
NEAR_AI_API_KEY    required only for live calls; never logged or returned
NEAR_AI_MODEL      default z-ai/glm-5.3-flash
NEAR_AI_TIMEOUT_MS default 30000
```

```ts
import { createNearAiClient } from '@mend/ai-client/server';

const client = createNearAiClient();
const record = await client.chatJson({
  system: 'Return strict JSON only.',
  user: '...',
  schema: MyStrictZodSchema,
});
// record.data, record.requestHash, record.responseHash,
// record.requestBodyText, record.responseBodyText, record.responseId
```

- OpenAI-compatible `POST /chat/completions`, `response_format: json_object`,
  `x-no-aliasing: true`, `Accept-Encoding: identity` so hashes bind exact bytes.
- Response envelope, content JSON and the caller's zod schema are all validated.
  `.strict()` schemas reject extra keys.
- Shared records (`Report`, `EvidencePackage`) use the frozen
  `@mend/protocol` zod schemas (`src/protocol.ts`). AI-only output schemas are
  local because the protocol does not contract model output.
- Request/response hashes are SHA-256 over the exact UTF-8 bodies, ready for
  `verification.ts`.

## Privacy transforms

`src/privacy.ts`:

- `stripImageMetadata(bytes)` removes JPEG APP1/EXIF-XMP, APP13/IPTC and COM
  segments, and strips every non-essential PNG chunk (`tEXt`, `zTXt`, `iTXt`,
  `eXIf`, `tIME`, color profiles, etc.). Critical pixel chunks are preserved.
- `perceptualHash(bytes)` computes a deterministic 64-bit dHash (16 hex) for
  PNG. `perceptualHashFromRgba(w,h,rgba)` is available for browser canvases.
  JPEG pixel hashing is deliberately **not** faked; decode to RGBA first.
- `redactPng(bytes, boxes)` paints manual redaction boxes on pixels and drops
  all metadata. Only 8-bit non-interlaced PNG is supported for pixel edits.
- `splitLocation(precise, decimals=2)` returns a coarse public location
  (~1 km at 2 decimals) and a separate private coordinate record. The public
  object has no precise latitude/longitude fields.

Tests prove EXIF/text chunks are gone, hashes are stable across stripping, a
redaction changes the hash, and precise coordinates never appear in the public
object.

## Duplicate candidates

`duplicateEngine.ts` combines deterministic signals:

- geospatial proximity (haversine, radius default 250 m)
- perceptual-hash Hamming similarity
- character-trigram Dice text similarity

Weights are 3000/4000/3000 bps; confidence is integer round-half-up. A candidate
is only a **suggestion** when confidence >= 7000 bps, distance is inside the
radius and either pHash >= 8000 or text >= 5500 bps. Every result carries
`requiresHumanConfirmation: true`; there is no auto-merge function or field.
Optional model reasoning is a private rationale constrained to a strict schema
and never changes confidence.

## Scope generator and evidence reviewer

- `generateScope(client, input)` returns strict `summary`, `tasks`,
  `safetyExclusions`, `requiredEvidence`, integer `budgetRecommendationMicro`,
  `assumptions` and `humanReviewRequired: true`. Electrical, gas, structural,
  roof, asbestos and similar scopes are rejected before inference.
- `sealScope(...)` is the human sealing step and the only source of a
  `scopeHash`. Model output cannot contain a `scopeHash` (strict schema).
- `reviewEvidence(client, input)` returns **only** missing trusted checklist
  items plus limitations and `humanDecisionRequired: true`. It rejects invented
  checklist items and any output containing physical-safety certification
  language ("certified", "physically safe", "passed inspection", etc.).

## Verification states

`verification.ts` implements the R0-A response-signature flow:

1. SHA-256 the exact request/response bodies.
2. Build the signed text: `<model>:<req>:<resp>` for `provider_tee`, or
   `<req>:<resp>` for `gateway`.
3. Verify `ed25519` (SPKI-wrapped raw key) or `ecdsa` (EIP-191 + secp256k1
   public-key recovery; Keccak-256 implementation included).
4. Require exactly one retained attestation report with the same
   `signing_address` + `signing_algo`.

Visible states: `VERIFIED`, `UNAVAILABLE`, `HUMAN_DECISION`, `PHYSICAL_CLAIM`.
Missing signature/report, unknown algorithm/kind, tampered bytes and failed
cryptography are all `UNAVAILABLE` with a reason — never `VERIFIED`. Human
decisions and physical claims are emitted only by explicit helpers and are
always `physicalCertification: false` / `independentlyVerified: false`.

Honest limitation: DCAP/ITA quote verification and RTMR replay are **not**
implemented here. Attestation reports are only checked for signer/nonce
consistency and the result is labeled unavailable for quote verification. Use a
dedicated DCAP verifier for the full chain. The client also documents that TEE
instances share signing keys and that post-hoc reports cannot substitute for
preflight evidence.

## Prompt injection

`promptGuard.ts`:

- `scanPromptInjection` detects (but never obeys) instruction/recipient/role/
  payout/acceptance/fund-movement attempts and returns categories for logging.
- `wrapUntrustedText` / `buildUntrustedUserPrompt` sanitize delimiter breakouts
  and wrap public text in explicit untrusted blocks.
- `enforceTrustedAction` rejects any output that tries to set recipient, role,
  scope hash, payout rule, acceptance, winner/award fields or certification
  language, and returns the unchanged trusted context.

Tests use malicious report and evidence fixtures plus adversarial model-output
fixtures. No recipient, role, scope hash, payout rule or acceptance changes can
pass strict schemas + guard.

## Recorded fixtures and live smoke

- `fixtures/recorded-responses/near-ai/*.json` — scope, evidence review,
  duplicate reasoning, EIP-191 verification vector. All labeled
  `REPLAY / SIMULATION`; no credentials.
- `fixtures/attacks/prompt-injection/*` — malicious text and adversarial model
  output.
- `test/live.nearAi.test.ts` is skipped unless `NEAR_AI_API_KEY` is set. It is
  the only network-touching test.

## Rust ↔ TypeScript parity

`fixtures/recorded-responses/bid-rules/canonical-input.json` is scored by the
Rust artifact; the committed `canonical-output.json` is the Rust test output.
`test/parity.test.ts` loads the same fixtures, runs `@mend/protocol` `scoreBids`,
and asserts:

- ranking `B 9270 > C 5200 > A 2873`,
- identical dimension bps,
- `scoreInputHash(...)` equals the Rust `inputHash`,
- `scoreOutputHash(...)` equals the Rust `outputHash` using the documented
  canonical ranking field order.

## Commands

```bash
cd packages/ai-client
npm test
npm run typecheck
```

No default test performs network I/O. Do not put `NEAR_AI_API_KEY` in fixtures,
logs, source or bundles.
