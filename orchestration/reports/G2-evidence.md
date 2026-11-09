# G2 — Local vertical slice evidence

Date: 2026-11-09
Mode: **REPLAY / SIMULATION** (all chain adapters replay; no real transaction claimed)
Stack: Postgres 16 (Docker, port 55432) + Fastify API (port 4000) + Next.js web (port 3000)

## Start

- `DATABASE_URL` migrations: `001_init.sql` applied.
- API `/health` → `status: ok`, `mode: REPLAY`, `repository: postgres`, `database: reachable`, `chainAdapter: replay`, demo reset enabled, durability 2 minutes.
- Web `/`, `/report`, `/dashboard`, `/demo`, `/cases/WO-BENCH-001-0001` → HTTP 200.
- Web proxy `/api/config` → `mode: REPLAY`, `mainnetEnabled: false`, `apiConfigured: true`.

## Demo reset (designated admin only)

`POST /v1/demo/reset {scenario:"successfulRepair"}` with `x-mend-role: ADMIN`, `x-mend-account: demo-admin.mend.testnet`
→ `reset: true`, fingerprint `2a37b36e51e74f808a555a9484766e92df417277921e033e2ae8383e66018d5f`.
No production reset route; audit events survive resets.

## Canonical lifecycle executed through the real API (no hand-editing DB)

| Step | Actor | Result |
|---|---|---|
| Seed | demo reset | WO-BENCH-001-0001 `AWARDED`, budget 100 USDC, winner BID-B-BENCH-001, refund 20 recorded |
| `start_work` | contractor-b | `IN_PROGRESS` |
| upload completion evidence | contractor-b | `EV-0001`, redacted hash `54a6f0…a70c`, 70 bytes, EXIF stripped |
| `submit_completion` | contractor-b | `COMPLETION_SUBMITTED` |
| inspection record | inspector | `INS-0001`, APPROVED |
| `accept_completion` | inspector | `DURABILITY_PENDING`, escrow completion 72.000000, holdback 8.000000 |
| upload durability evidence | inspector | `EV-0002` |
| durability inspection | inspector | `INS-0002`, APPROVED |
| `inspect_durability(passed=true)` | inspector | `CLOSED`, holdback released 8.000000 |

Final escrow:

```json
{"fundedMicro":"100000000","refundedMicro":"20000000","completionPaidMicro":"72000000","holdbackHeldMicro":"0","holdbackReleasedMicro":"8000000"}
```

Accounting: 20 refund + 72 completion + 8 released = 100. Exact. No double payment.
UI case page renders 100/20/72/8 and `CLOSED` with `REPLAY / SIMULATION` labels.

## Result

**G2 PASS** for the successful-repair scenario in replay mode. Testnet (G3) remains blocked on human accounts/funds.
