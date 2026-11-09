import { createPublicKey, verify as nodeVerify } from 'node:crypto';

import { sha256Hex } from './canonical.js';
import { verifyEcdsaEip191 } from './secp256k1.js';

export type VerificationStatus = 'VERIFIED' | 'UNAVAILABLE' | 'HUMAN_DECISION' | 'PHYSICAL_CLAIM';

export interface NearAiSignature {
  text: string;
  signature: string;
  signing_address: string;
  signing_algo: string;
  signature_kind?: string;
  error_code?: string;
  message?: string;
  [key: string]: unknown;
}

export interface AttestationReportLike {
  signing_address?: string;
  signing_algo?: string;
  request_nonce?: string;
  model_name?: string;
  [key: string]: unknown;
}

export interface NearAiReportEvidence {
  gatewayAttestation?: AttestationReportLike;
  modelAttestations?: AttestationReportLike[];
}

export interface NearAiVerificationInput {
  /** Canonical model id used for the request. Aliases break provider_tee text. */
  modelId: string;
  requestBodyText: string;
  responseBodyText: string;
  signature?: NearAiSignature;
  reports?: NearAiReportEvidence;
  /** Client-established nonce retained from preflight. */
  nonce?: string;
}

export interface VerificationChecks {
  requestHashMatches: boolean;
  responseHashMatches: boolean;
  signedTextMatches: boolean;
  signatureValid: boolean;
  signerMatchesReport: boolean;
}

export interface AttestationAssessment {
  status: VerificationStatus;
  quoteVerified: false;
  reportsPresent: boolean;
  nonceMatches: boolean | null;
  reason: string;
}

export interface NearAiVerificationResult {
  status: VerificationStatus;
  ok: boolean;
  signatureKind?: string;
  signingAlgo?: string;
  requestHash: string;
  responseHash: string;
  checks: VerificationChecks;
  attestation: AttestationAssessment;
  reason?: string;
  limitations: string[];
}

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(value: string): Uint8Array {
  let number = 0n;
  for (const character of value) {
    const index = BASE58_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('invalid base58');
    number = number * 58n + BigInt(index);
  }
  let hex = number === 0n ? '' : number.toString(16);
  if (hex.length % 2 === 1) hex = `0${hex}`;
  let leadingZeros = 0;
  for (const character of value) {
    if (character !== '1') break;
    leadingZeros += 1;
  }
  return Buffer.concat([Buffer.alloc(leadingZeros), Buffer.from(hex, 'hex')]);
}

function decodeBytes(value: string, expectedLength: number): Uint8Array | null {
  const trimmed = value.trim();
  const noPrefix = trimmed.replace(/^0x/i, '');
  if (
    noPrefix.length === expectedLength * 2 &&
    /^[0-9a-fA-F]+$/.test(noPrefix)
  ) {
    return Buffer.from(noPrefix, 'hex');
  }
  try {
    const decoded = base58Decode(trimmed);
    if (decoded.length === expectedLength) return decoded;
  } catch {
    // fall through
  }
  try {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length === expectedLength) return decoded;
  } catch {
    // fall through
  }
  return null;
}

export function verifyEd25519(text: string, signature: string, signingAddress: string): boolean {
  const publicKey = decodeBytes(signingAddress, 32);
  const signatureBytes = decodeBytes(signature, 64);
  if (!publicKey || !signatureBytes) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, publicKey]),
      format: 'der',
      type: 'spki',
    });
    return nodeVerify(null, Buffer.from(text, 'utf8'), key, signatureBytes);
  } catch {
    return false;
  }
}

export function verifySignature(
  text: string,
  signature: string,
  signingAddress: string,
  signingAlgo: string,
): boolean {
  switch (signingAlgo.toLowerCase()) {
    case 'ed25519':
      return verifyEd25519(text, signature, signingAddress);
    case 'ecdsa':
      return verifyEcdsaEip191(text, signature, signingAddress);
    default:
      return false;
  }
}

function sameSigner(
  report: AttestationReportLike | undefined,
  signature: NearAiSignature,
): boolean {
  if (!report) return false;
  if (typeof report.signing_address !== 'string' || typeof report.signing_algo !== 'string') {
    return false;
  }
  return (
    report.signing_address.toLowerCase() === signature.signing_address.toLowerCase() &&
    report.signing_algo.toLowerCase() === signature.signing_algo.toLowerCase()
  );
}

export function assessAttestationReports(
  reports: NearAiReportEvidence | undefined,
  nonce: string | undefined,
): AttestationAssessment {
  const reportsPresent = Boolean(
    reports?.gatewayAttestation || (reports?.modelAttestations && reports.modelAttestations.length > 0),
  );
  let nonceMatches: boolean | null = null;
  if (nonce && reports) {
    const evidence = [
      reports.gatewayAttestation,
      ...(reports.modelAttestations ?? []),
    ].filter((item): item is AttestationReportLike => Boolean(item));
    if (evidence.length > 0) {
      nonceMatches = evidence.some((item) => item.request_nonce === nonce);
    }
  }
  return {
    status: 'UNAVAILABLE',
    quoteVerified: false,
    reportsPresent,
    nonceMatches,
    reason:
      'TEE quote (DCAP/ITA) verification is not implemented by this client; reports are only checked for signer/nonce consistency. Use a dedicated DCAP verifier for full-chain evidence.',
  };
}

/**
 * Verify a NEAR AI response signature against the exact request/response bytes.
 *
 * Honest states:
 * - VERIFIED: signature cryptographically binds these bytes and matches exactly
 *   one retained attestation report signer.
 * - UNAVAILABLE: missing signature/report, unknown algorithm/kind, tampered
 *   bytes, or a failed cryptographic check.
 * - HUMAN_DECISION / PHYSICAL_CLAIM are emitted only by the explicit helpers
 *   below, never inferred from model text.
 */
export function verifyNearAiEvidence(input: NearAiVerificationInput): NearAiVerificationResult {
  const requestHash = sha256Hex(input.requestBodyText);
  const responseHash = sha256Hex(input.responseBodyText);
  const attestation = assessAttestationReports(input.reports, input.nonce);
  const limitations = [
    'Signature verification proves possession of the signing key, not that the key belongs to a uniquely identifiable serving instance.',
    'DCAP/ITA quote verification and RTMR replay are out of scope here and must be performed separately.',
    'A report fetched after the completion cannot substitute for preflight evidence.',
  ];

  const unavailable = (reason: string, checks: Partial<VerificationChecks> = {}): NearAiVerificationResult => ({
    status: 'UNAVAILABLE',
    ok: false,
    signatureKind: input.signature?.signature_kind,
    signingAlgo: input.signature?.signing_algo,
    requestHash,
    responseHash,
    checks: {
      requestHashMatches: checks.requestHashMatches ?? true,
      responseHashMatches: checks.responseHashMatches ?? true,
      signedTextMatches: checks.signedTextMatches ?? false,
      signatureValid: checks.signatureValid ?? false,
      signerMatchesReport: checks.signerMatchesReport ?? false,
    },
    attestation,
    reason,
    limitations,
  });

  const signature = input.signature;
  if (!signature) return unavailable('No response signature evidence was supplied.');
  if (signature.error_code || signature.message) {
    return unavailable('Signature endpoint returned an unavailable/error result, not a signature.');
  }

  const kind = signature.signature_kind;
  let expectedText: string;
  if (kind === 'provider_tee') {
    expectedText = `${input.modelId}:${requestHash}:${responseHash}`;
  } else if (kind === 'gateway') {
    expectedText = `${requestHash}:${responseHash}`;
  } else {
    return unavailable('signature_kind is missing or unfamiliar; refusing to infer it from text shape.');
  }

  const signedTextMatches = signature.text === expectedText;
  let signatureValid = false;
  if (typeof signature.signature === 'string' && typeof signature.signing_address === 'string') {
    signatureValid = verifySignature(
      signature.text,
      signature.signature,
      signature.signing_address,
      signature.signing_algo,
    );
  }

  const report =
    kind === 'provider_tee'
      ? input.reports?.modelAttestations?.find((item) => sameSigner(item, signature))
      : input.reports?.gatewayAttestation;
  const signerMatchesReport = sameSigner(report, signature);

  if (!signedTextMatches) {
    return unavailable(
      'Signed text does not bind the supplied request/response bytes (tampered or mismatched).',
      { signedTextMatches, signatureValid, signerMatchesReport },
    );
  }
  if (!signatureValid) {
    return unavailable('Signature did not verify against signing_address/signing_algo.', {
      signedTextMatches,
      signatureValid,
      signerMatchesReport,
    });
  }
  if (!signerMatchesReport) {
    return unavailable(
      'No retained attestation report matches the signature signer and algorithm.',
      { signedTextMatches, signatureValid, signerMatchesReport },
    );
  }

  return {
    status: 'VERIFIED',
    ok: true,
    signatureKind: kind,
    signingAlgo: signature.signing_algo,
    requestHash,
    responseHash,
    checks: {
      requestHashMatches: true,
      responseHashMatches: true,
      signedTextMatches,
      signatureValid,
      signerMatchesReport,
    },
    attestation,
    limitations,
  };
}

export interface HumanDecisionRecord {
  status: 'HUMAN_DECISION';
  actor: string;
  decision: string;
  subjectHash: string;
  physicalCertification: false;
}

export function classifyHumanDecision(
  actor: string,
  decision: string,
  subjectHash: string,
): HumanDecisionRecord {
  return {
    status: 'HUMAN_DECISION',
    actor,
    decision,
    subjectHash,
    physicalCertification: false,
  };
}

export interface PhysicalClaimRecord {
  status: 'PHYSICAL_CLAIM';
  source: string;
  claim: string;
  independentlyVerified: false;
}

export function classifyPhysicalClaim(source: string, claim: string): PhysicalClaimRecord {
  return {
    status: 'PHYSICAL_CLAIM',
    source,
    claim,
    independentlyVerified: false,
  };
}
