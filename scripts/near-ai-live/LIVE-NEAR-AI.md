# Live NEAR AI triage, signature and attestation path

**Date:** 2026-11-13
**Provider:** NEAR AI Cloud (`https://cloud-api.near.ai/v1`)
**Model:** `z-ai/glm-5.3-flash`
**Mode:** local API, `REPLAY` chain adapter, live NEAR AI only; no funds and no on-chain action.

## Smoke test — PASS

`packages/ai-client/test/live.nearAi.test.ts` passed against the live provider
with `NEAR_AI_API_KEY` from `~/.mend/near-ai.env` (mode `600`). It returned a
strict JSON object and recorded request/response hashes.

## Live triage through the API — PASS_WITH_CAVEATS

An in-memory API was started with the live key. A bench report (`BENCH-901` /
`R-001`) was submitted and triaged by `POST /v1/reports/R-001/triage`.

- HTTP `201` in 119.7 s (two live model calls plus signature fetch)
- `available: true`
- `confidenceBps: 7600`
- `model: z-ai/glm-5.3-flash`
- Structured rationale and a generated repair scope were returned.
- `injectionScan.detected: false`
- Attestation: `ATT-0001` (`kind: NEAR_AI`)
- The raw response is in `triage-response.json`; the stored artifact is in
  `attestation-ATT-0001.json`.

### Signature checks — cryptographically valid

`verification.method` is `NEAR_AI_SIGNATURE`, `signatureFetched: true`, and:

```json
{
  "requestHashMatches": true,
  "responseHashMatches": true,
  "signedTextMatches": true,
  "signatureValid": true,
  "signerMatchesReport": false
}
```

The provider returned an ECDSA signature with `signature_kind: "provider_tee"`,
`signing_algo: "ecdsa"` and signer
`0x3b753b4406613c5e70ae640508632b600424fa0c`. The signed text binds
`model:requestHash:responseHash`. The signature verifies against the exact
request/response bytes.

### Honest limitation

`verification.status` is **`UNAVAILABLE`**, not `VERIFIED`, because no matching
attestation report was retained (`signerMatchesReport: false`). The TEE
DCAP/ITA quote and RTMR replay are not implemented by this client. The API
therefore labels this artifact **`UNVERIFIED_INFERENCE`**, and the public UI
renders it as **Unavailable evidence**, not verified inference. This is the
intended fail-closed behaviour.

The stored attestation has `verified: false` and still keeps the signature and
hashes. The UI's trust panel distinguishes verified inference, unavailable
evidence, human decisions and physical claims; it never promotes this artifact
to verified.

## Reproduce

```bash
set -a
. "$HOME/.mend/near-ai.env"
set +a
PORT=4011 MEND_MODE=REPLAY \
  NEAR_AI_MODEL=z-ai/glm-5.3-flash \
  NEAR_AI_TIMEOUT_MS=120000 \
  npx tsx apps/api/src/index.ts
```

Then create the asset/report and call triage as documented in
`scripts/near-ai-live/reproduce.sh`.

## Bugs found and fixed by this live run

1. The API default model `Qwen/Qwen3-235B-A22B-Instruct-2507` is not a valid
   NEAR AI model name. The default is now `z-ai/glm-5.3-flash`.
2. The JSON schema was not sent to the model; `json_object` mode alone let a
   reasoning model invent its own field names. `NearAiClient` now appends the
   Zod-derived JSON Schema to the trusted system message.
3. `maxTokens: 800` truncated a reasoning model to `content: null`. The triage
   call now allows `4096` tokens.

No API key is written to the repository, logs or these evidence files.
