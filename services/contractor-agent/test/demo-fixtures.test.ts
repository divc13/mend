import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FIXTURE_INSPECTORS, ReportSchema } from '@mend/protocol';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const REPORTS_PATH = fileURLToPath(new URL('../../../fixtures/demo/reports-25.json', import.meta.url));
const INSPECTORS_PATH = fileURLToPath(new URL('../../../fixtures/demo/inspectors.json', import.meta.url));
const SCRIPT_PATH = fileURLToPath(new URL('../../../scripts/demo/generate-demo-reports.mjs', import.meta.url));

const EXPECTED_IDS = Array.from({ length: 25 }, (_, index) => `R-${String(index + 1).padStart(3, '0')}`);
const EXPECTED_ASSETS = ['BENCH-001', 'RACK-002', 'DOOR-003', 'FENCE-004', 'PLAY-005'];
const PRIVATE_KEYS = [
  'preciseLocation',
  'preciseLocationRef',
  'preciseLat',
  'preciseLng',
  'rawMedia',
  'rawMediaUrl',
  'privateMediaHash',
  'reporterName',
  'reporterEmail',
  'reporterPhone',
  'gps',
  'deviceId',
];

interface ReportBundle {
  version: string;
  dataset: string;
  generated: boolean;
  generator: string;
  count: number;
  reports: unknown[];
}

interface InspectorsBundle {
  version: string;
  dataset: string;
  inspectors: Array<{
    account: string;
    role: string;
    canonical: boolean;
    human: boolean;
    independentOfContractor: boolean;
    permissions: string[];
  }>;
  disclosures: Array<{ id: string; text: string }>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function visitKeys(value: unknown, visit: (key: string) => void): void {
  if (Array.isArray(value)) {
    for (const entry of value) visitKeys(entry, visit);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      visit(key);
      visitKeys(entry, visit);
    }
  }
}

describe('demo reports fixture', () => {
  const bundle = readJson<ReportBundle>(REPORTS_PATH);
  const reports = bundle.reports as Array<Record<string, unknown>>;

  it('is a generated, versioned bundle of exactly 25 ordered unique reports', () => {
    expect(bundle.version).toBe('1.0.0');
    expect(bundle.dataset).toBe('mend-demo-reports-25');
    expect(bundle.generated).toBe(true);
    expect(bundle.generator).toBe('scripts/demo/generate-demo-reports.mjs');
    expect(bundle.count).toBe(25);
    expect(reports).toHaveLength(25);
    expect(reports.map((report) => report.id)).toEqual(EXPECTED_IDS);
    expect(new Set(reports.map((report) => report.id)).size).toBe(25);
  });

  it('has schema-valid report shapes with varied assets and statuses', () => {
    for (const report of reports) {
      expect(() => ReportSchema.parse(report)).not.toThrow();
    }

    expect(new Set(reports.map((report) => report.assetId))).toEqual(new Set(EXPECTED_ASSETS));
    expect(new Set(reports.map((report) => report.status))).toEqual(
      new Set(['SUBMITTED', 'TRIAGED', 'CLUSTERED', 'DUPLICATE', 'ACCEPTED']),
    );
    expect(new Set(reports.map((report) => report.description)).size).toBe(25);
  });

  it('contains coarse public locations, redacted media and synthetic case links only', () => {
    for (const report of reports) {
      const location = report.publicLocation as Record<string, unknown>;
      expect(typeof location.label).toBe('string');
      expect(typeof location.area).toBe('string');
      expect(Math.abs(location.coarseLat as number)).toBeLessThanOrEqual(90);
      expect(Math.abs(location.coarseLng as number)).toBeLessThanOrEqual(180);
      expect(report).not.toHaveProperty('preciseLocation');
      expect(report).not.toHaveProperty('preciseLocationRef');
      expect(report.redactedMediaHash).toMatch(/^[a-f0-9]{64}$/);
      expect(report.perceptualHash).toMatch(/^[a-f0-9]{32}$/);
      expect(report.reporterCaseLink).toMatch(/^case_[A-Za-z0-9]{16,}$/);
      expect(report.exifStripped).toBe(true);
    }

    visitKeys(bundle, (key) => {
      expect(PRIVATE_KEYS).not.toContain(key);
    });
    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toMatch(/https?:\/\//);
    expect(serialized).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  });

  it('has at least three duplicate perceptual-hash pairs and a prompt-injection-looking report', () => {
    const counts = new Map<string, number>();
    for (const report of reports) {
      const hash = report.perceptualHash as string;
      counts.set(hash, (counts.get(hash) ?? 0) + 1);
    }
    const duplicateGroups = [...counts.values()].filter((count) => count >= 2);
    expect(duplicateGroups.length).toBeGreaterThanOrEqual(3);

    const clusterIds = reports.map((report) => report.clusterId).filter(Boolean);
    expect(new Set(clusterIds).size).toBeGreaterThanOrEqual(3);
    expect(reports.filter((report) => report.status === 'DUPLICATE').length).toBeGreaterThanOrEqual(1);

    const injection = reports.find((report) => /ignore previous instructions/i.test(report.description as string));
    expect(injection).toBeDefined();
    expect(injection?.status).toBe('SUBMITTED');
  });
});

describe('demo inspectors fixture', () => {
  const bundle = readJson<InspectorsBundle>(INSPECTORS_PATH);

  it('lists exactly the two canonical inspector accounts', () => {
    expect(bundle.version).toBe('1.0.0');
    expect(bundle.dataset).toBe('mend-demo-inspectors');
    expect(bundle.inspectors).toHaveLength(2);
    expect(bundle.inspectors.map((inspector) => inspector.account)).toEqual([...FIXTURE_INSPECTORS]);
    expect(new Set(bundle.inspectors.map((inspector) => inspector.account)).size).toBe(2);
  });

  it('records inspector roles and human independence', () => {
    for (const inspector of bundle.inspectors) {
      expect(inspector.role).toBe('INSPECTOR');
      expect(inspector.canonical).toBe(true);
      expect(inspector.human).toBe(true);
      expect(inspector.independentOfContractor).toBe(true);
      expect(inspector.permissions).toEqual(
        expect.arrayContaining(['accept_completion', 'inspect_durability', 'record_remediation_decision']),
      );
    }
  });

  it('discloses that self-hire tests are not independent reputation', () => {
    const disclosureText = bundle.disclosures.map((disclosure) => disclosure.text).join(' ');
    expect(disclosureText).toMatch(/self-hire/i);
    expect(disclosureText).toMatch(/not independent reputation/i);
    expect(disclosureText).toMatch(/HUMAN ACCEPTED/);
  });

  it('contains no real personal data fields', () => {
    visitKeys(bundle, (key) => {
      expect(['name', 'fullName', 'email', 'phone', 'reporterName', 'reporterEmail']).not.toContain(key);
    });
  });
});

describe('demo report generator', () => {
  it('regenerates the committed 25-report file deterministically', () => {
    const output = execFileSync(process.execPath, [SCRIPT_PATH, '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(output).toContain('25 deterministic reports');
    expect(output).toContain('R-001..R-025');
  });
});
