import { describe, expect, it } from 'vitest';
import { FIXTURE_ACCOUNTS, sha256Hex } from '@mend/protocol';
import { createEvidenceStore, stripImageMetadata } from '../src/services/evidence.js';
import { auth, call, jpegWithExif, makeTestApp, seedDemo, strippedJpeg } from './helpers.js';

function pngWithExif(): { png: Buffer; stripped: Buffer } {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type, 'latin1');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(0, 0); // CRC is not validated by the metadata stripper.
    return Buffer.concat([length, typeBuffer, data, crc]);
  };
  const exif = chunk('eXIf', Buffer.from('MM\0*exif-payload', 'latin1'));
  const ihdr = chunk('IHDR', Buffer.alloc(13, 1));
  const idat = chunk('IDAT', Buffer.from('fake-image-bytes'));
  const iend = chunk('IEND', Buffer.alloc(0));
  return {
    png: Buffer.concat([signature, ihdr, exif, idat, iend]),
    stripped: Buffer.concat([signature, ihdr, idat, iend]),
  };
}

describe('Evidence service — EXIF removal, private storage and signed access', () => {
  it('removes JPEG EXIF/XMP and PNG eXIf before hashing', () => {
    const jpeg = jpegWithExif();
    const stripped = stripImageMetadata(jpeg, 'image/jpeg');
    expect(stripped.stripped).toBe(true);
    expect(stripped.bytes.equals(strippedJpeg())).toBe(true);
    expect(stripped.sha256).toBe(sha256Hex(strippedJpeg()));

    const png = pngWithExif();
    const result = stripImageMetadata(png.png, 'image/png');
    expect(result.stripped).toBe(true);
    expect(result.bytes.equals(png.stripped)).toBe(true);
    expect(result.sha256).toBe(sha256Hex(png.stripped));
  });

  it('reports the S3 adapter as unavailable instead of faking storage', async () => {
    const store = createEvidenceStore({
      adapter: 's3',
      dir: '/tmp/mend-unused',
      maxBytes: 1024,
      signedUrlTtlSeconds: 60,
      signingSecret: 'test',
      s3: {},
    });
    expect(store.available).toBe(false);
    expect(store.unavailableReason).toContain('S3');
    await expect(store.put('evidence/x', Buffer.from('x'))).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    await expect(store.get('evidence/x')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('grants signed time-limited private access and keeps public metadata URL-free', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      await target.deps.repo.updateWorkOrder('WO-BENCH-001-0001', { status: 'IN_PROGRESS' });

      const uploaded = await call(target.app, 'POST', '/v1/evidence', {
        headers: auth('CONTRACTOR', FIXTURE_ACCOUNTS.contractorB),
        body: {
          workOrderId: 'WO-BENCH-001-0001',
          kind: 'COMPLETION',
          contentType: 'image/jpeg',
          dataBase64: jpegWithExif().toString('base64'),
          checklist: { beforePhoto: true, afterPhoto: true },
        },
      });
      expect(uploaded.status).toBe(201);
      const evidenceId = uploaded.body.id;
      expect(uploaded.body.evidenceHashes[0]).toBe(sha256Hex(strippedJpeg()));
      expect(uploaded.body.redacted).toBe(true);

      const publicView = await call(target.app, 'GET', `/v1/evidence/${evidenceId}`);
      expect(publicView.status).toBe(200);
      expect(JSON.stringify(publicView.body)).not.toContain('storageKey');
      expect(JSON.stringify(publicView.body)).not.toContain('/download');

      const workOrderEvidence = await call(target.app, 'GET', '/v1/work-orders/WO-BENCH-001-0001/evidence');
      expect(workOrderEvidence.status).toBe(200);
      expect(JSON.stringify(workOrderEvidence.body)).not.toContain('storageKey');
      expect(JSON.stringify(workOrderEvidence.body)).not.toContain('token=');

      const wrongContractor = await call(target.app, 'GET', `/v1/evidence/${evidenceId}/access`, {
        headers: auth('CONTRACTOR', FIXTURE_ACCOUNTS.contractorA),
      });
      expect(wrongContractor.status).toBe(403);
      expect(wrongContractor.body.error.code).toBe('FORBIDDEN_ROLE');

      const access = await call(target.app, 'GET', `/v1/evidence/${evidenceId}/access`, {
        headers: auth('CONTRACTOR', FIXTURE_ACCOUNTS.contractorB),
      });
      expect(access.status).toBe(200);
      expect(access.body.url).toContain('/v1/evidence/');
      expect(access.headers['cache-control']).toBe('no-store');

      const inspectorAccess = await call(target.app, 'GET', `/v1/evidence/${evidenceId}/access`, {
        headers: auth('INSPECTOR'),
      });
      expect(inspectorAccess.status).toBe(200);

      const downloadPath = new URL(access.body.url).pathname + new URL(access.body.url).search;
      const downloaded = await target.app.inject({ method: 'GET', url: downloadPath });
      expect(downloaded.statusCode).toBe(200);
      expect(Buffer.from(downloaded.rawPayload).equals(strippedJpeg())).toBe(true);

      const tampered = await target.app.inject({
        method: 'GET',
        url: downloadPath.replace(/token=[^&]+/, 'token=not-the-token'),
      });
      expect(tampered.statusCode).toBe(401);

      target.clock.advance(301_000);
      const expired = await target.app.inject({ method: 'GET', url: downloadPath });
      expect(expired.statusCode).toBe(401);

      const afterExpiry = await call(target.app, 'GET', `/v1/evidence/${evidenceId}/access`, {
        headers: auth('INSPECTOR'),
      });
      expect(afterExpiry.status).toBe(200);
      expect(new Date(afterExpiry.body.expiresAt * 1000).getTime()).toBeGreaterThan(target.clock.now().getTime());
    } finally {
      await target.close();
    }
  });

  it('prevents contractors from supplying their own durability evidence', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      await target.deps.repo.updateWorkOrder('WO-BENCH-001-0001', { status: 'DURABILITY_PENDING' });
      const contractorAttempt = await call(target.app, 'POST', '/v1/evidence', {
        headers: auth('CONTRACTOR', FIXTURE_ACCOUNTS.contractorB),
        body: {
          workOrderId: 'WO-BENCH-001-0001',
          kind: 'DURABILITY',
          contentType: 'image/jpeg',
          dataBase64: jpegWithExif().toString('base64'),
        },
      });
      expect(contractorAttempt.status).toBe(403);
      expect(contractorAttempt.body.error.code).toBe('FORBIDDEN_ROLE');

      const inspectorAttempt = await call(target.app, 'POST', '/v1/evidence', {
        headers: auth('INSPECTOR'),
        body: {
          workOrderId: 'WO-BENCH-001-0001',
          kind: 'DURABILITY',
          contentType: 'image/jpeg',
          dataBase64: jpegWithExif().toString('base64'),
        },
      });
      expect(inspectorAttempt.status).toBe(201);
    } finally {
      await target.close();
    }
  });
});
