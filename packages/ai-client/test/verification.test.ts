import { createHash, generateKeyPairSync, sign as nodeSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { sha256Hex } from '../src/canonical.js';
import { bytesToHex, keccak256 } from '../src/keccak.js';
import {
  ethereumAddressFromPublicKey,
  recoverPublicKeyFromDigest,
  verifyEcdsaDigest,
  verifyEcdsaEip191,
} from '../src/secp256k1.js';
import {
  classifyHumanDecision,
  classifyPhysicalClaim,
  verifyNearAiEvidence,
  verifySignature,
} from '../src/verification.js';

const SCOPE_FIXTURE = fileURLToPath(
  new URL('../../../fixtures/recorded-responses/near-ai/scope.json', import.meta.url),
);
const ECDSA_VECTOR = fileURLToPath(
  new URL('../../../fixtures/recorded-responses/near-ai/ecdsa-eip191-vector.json', import.meta.url),
);
const NONCE = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function fixtureParts(): { modelId: string; requestBodyText: string; responseBodyText: string } {
  const fixture = JSON.parse(readFileSync(SCOPE_FIXTURE, 'utf8')) as {
    request: unknown;
    response: { model: string };
  };
  return {
    modelId: fixture.response.model,
    requestBodyText: JSON.stringify(fixture.request),
    responseBodyText: JSON.stringify(fixture.response),
  };
}

describe('crypto primitives', () => {
  it('matches Ethereum Keccak-256 test vectors', () => {
    expect(bytesToHex(keccak256(Buffer.from('')))).toBe(
      'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
    );
    expect(bytesToHex(keccak256(Buffer.from('abc')))).toBe(
      '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45',
    );
  });
});

describe('NEAR AI response-signature verification', () => {
  it('verifies an ed25519 provider_tee signature and labels quote verification unavailable', () => {
    const parts = fixtureParts();
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
    const rawPublic = Buffer.from(jwk.x, 'base64url');
    const signingAddress = rawPublic.toString('hex');
    const requestHash = sha256Hex(parts.requestBodyText);
    const responseHash = sha256Hex(parts.responseBodyText);
    const signedText = `${parts.modelId}:${requestHash}:${responseHash}`;
    const signature = nodeSign(null, Buffer.from(signedText, 'utf8'), privateKey).toString('hex');

    const result = verifyNearAiEvidence({
      modelId: parts.modelId,
      requestBodyText: parts.requestBodyText,
      responseBodyText: parts.responseBodyText,
      nonce: NONCE,
      signature: {
        text: signedText,
        signature,
        signing_address: signingAddress,
        signing_algo: 'ed25519',
        signature_kind: 'provider_tee',
      },
      reports: {
        modelAttestations: [
          {
            signing_address: signingAddress,
            signing_algo: 'ed25519',
            request_nonce: NONCE,
            model_name: parts.modelId,
          },
        ],
      },
    });

    expect(result.status).toBe('VERIFIED');
    expect(result.ok).toBe(true);
    expect(result.checks).toEqual({
      requestHashMatches: true,
      responseHashMatches: true,
      signedTextMatches: true,
      signatureValid: true,
      signerMatchesReport: true,
    });
    expect(result.attestation.status).toBe('UNAVAILABLE');
    expect(result.attestation.quoteVerified).toBe(false);
    expect(result.attestation.nonceMatches).toBe(true);
    expect(result.limitations.join(' ')).toMatch(/DCAP/);
  });

  it('fails when request or response bytes are tampered', () => {
    const parts = fixtureParts();
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
    const signingAddress = Buffer.from(jwk.x, 'base64url').toString('hex');
    const requestHash = sha256Hex(parts.requestBodyText);
    const responseHash = sha256Hex(parts.responseBodyText);
    const signedText = `${parts.modelId}:${requestHash}:${responseHash}`;
    const signature = nodeSign(null, Buffer.from(signedText, 'utf8'), privateKey).toString('hex');
    const reports = {
      modelAttestations: [
        {
          signing_address: signingAddress,
          signing_algo: 'ed25519',
          request_nonce: NONCE,
        },
      ],
    };

    const tamperedRequest = verifyNearAiEvidence({
      modelId: parts.modelId,
      requestBodyText: `${parts.requestBodyText} `,
      responseBodyText: parts.responseBodyText,
      nonce: NONCE,
      signature: {
        text: signedText,
        signature,
        signing_address: signingAddress,
        signing_algo: 'ed25519',
        signature_kind: 'provider_tee',
      },
      reports,
    });
    expect(tamperedRequest.status).toBe('UNAVAILABLE');
    expect(tamperedRequest.ok).toBe(false);
    expect(tamperedRequest.reason).toMatch(/does not bind/);

    const tamperedResponse = verifyNearAiEvidence({
      modelId: parts.modelId,
      requestBodyText: parts.requestBodyText,
      responseBodyText: parts.responseBodyText.replace('bench', 'chair'),
      nonce: NONCE,
      signature: {
        text: signedText,
        signature,
        signing_address: signingAddress,
        signing_algo: 'ed25519',
        signature_kind: 'provider_tee',
      },
      reports,
    });
    expect(tamperedResponse.status).toBe('UNAVAILABLE');

    const tamperedSignature = verifyNearAiEvidence({
      modelId: parts.modelId,
      requestBodyText: parts.requestBodyText,
      responseBodyText: parts.responseBodyText,
      nonce: NONCE,
      signature: {
        text: signedText,
        signature: `00${signature.slice(2)}`,
        signing_address: signingAddress,
        signing_algo: 'ed25519',
        signature_kind: 'provider_tee',
      },
      reports,
    });
    expect(tamperedSignature.status).toBe('UNAVAILABLE');
    expect(tamperedSignature.checks.signatureValid).toBe(false);
  });

  it('labels missing signature or report evidence as UNAVAILABLE', () => {
    const parts = fixtureParts();
    const noSignature = verifyNearAiEvidence({
      modelId: parts.modelId,
      requestBodyText: parts.requestBodyText,
      responseBodyText: parts.responseBodyText,
    });
    expect(noSignature.status).toBe('UNAVAILABLE');
    expect(noSignature.reason).toMatch(/No response signature/);

    const noReport = verifyNearAiEvidence({
      modelId: parts.modelId,
      requestBodyText: parts.requestBodyText,
      responseBodyText: parts.responseBodyText,
      signature: {
        text: 'x',
        signature: '00',
        signing_address: '00',
        signing_algo: 'ed25519',
        signature_kind: 'provider_tee',
      },
    });
    expect(noReport.status).toBe('UNAVAILABLE');
    expect(noReport.attestation.reportsPresent).toBe(false);
  });

  it('recovers a secp256k1 public key from an independently produced digest signature', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
    const uncompressed = Buffer.concat([
      Buffer.from(jwk.x, 'base64url'),
      Buffer.from(jwk.y, 'base64url'),
    ]);
    const expectedAddress = ethereumAddressFromPublicKey(uncompressed);
    const message = Buffer.from('independent digest recovery check', 'utf8');
    const digest = createHash('sha256').update(message).digest();
    const rawSignature = nodeSign('sha256', message, {
      key: privateKey,
      dsaEncoding: 'ieee-p1363',
    });

    let verified = false;
    for (const recovery of [0, 1]) {
      const candidate = Buffer.concat([rawSignature, Buffer.from([recovery])]).toString('hex');
      const recovered = recoverPublicKeyFromDigest(digest, candidate);
      if (Buffer.from(recovered).equals(uncompressed)) {
        expect(verifyEcdsaDigest(digest, candidate, expectedAddress)).toBe(true);
        verified = true;
      }
    }
    expect(verified).toBe(true);
  });

  it('verifies a committed EIP-191 gateway signature vector', () => {
    const parts = fixtureParts();
    const vector = JSON.parse(readFileSync(ECDSA_VECTOR, 'utf8')) as {
      modelId: string;
      signatureKind: string;
      signingAlgo: string;
      signingAddress: string;
      requestHash: string;
      responseHash: string;
      text: string;
      signature: string;
    };

    expect(sha256Hex(parts.requestBodyText)).toBe(vector.requestHash);
    expect(sha256Hex(parts.responseBodyText)).toBe(vector.responseHash);
    expect(vector.text).toBe(`${vector.requestHash}:${vector.responseHash}`);
    expect(verifyEcdsaEip191(vector.text, vector.signature, vector.signingAddress)).toBe(true);
    expect(
      verifySignature(vector.text, vector.signature, vector.signingAddress, vector.signingAlgo),
    ).toBe(true);
    expect(verifyEcdsaEip191(`${vector.text} `, vector.signature, vector.signingAddress)).toBe(false);

    const result = verifyNearAiEvidence({
      modelId: parts.modelId,
      requestBodyText: parts.requestBodyText,
      responseBodyText: parts.responseBodyText,
      signature: {
        text: vector.text,
        signature: vector.signature,
        signing_address: vector.signingAddress,
        signing_algo: vector.signingAlgo,
        signature_kind: vector.signatureKind,
      },
      reports: {
        gatewayAttestation: {
          signing_address: vector.signingAddress,
          signing_algo: vector.signingAlgo,
        },
      },
    });
    expect(result.status).toBe('VERIFIED');
    expect(result.signatureKind).toBe('gateway');
  });

  it('keeps human decisions and physical claims visibly separate', () => {
    expect(classifyHumanDecision('inspector.mend.testnet', 'APPROVED', 'a'.repeat(64)).status).toBe(
      'HUMAN_DECISION',
    );
    expect(classifyHumanDecision('inspector.mend.testnet', 'APPROVED', 'a'.repeat(64)).physicalCertification).toBe(
      false,
    );
    expect(classifyPhysicalClaim('contractor', 'The plank is fixed').status).toBe('PHYSICAL_CLAIM');
    expect(classifyPhysicalClaim('contractor', 'The plank is fixed').independentlyVerified).toBe(false);
  });
});
