/**
 * Report form options and the safe route from a UI category to a protocol
 * category / known asset. The protocol only accepts its existing category
 * values; a more specific UI label such as "Pothole / path surface" is
 * normalised back to `other` before anything is submitted.
 */

export interface ReportAreaOption {
  value: string;
  label: string;
}

export interface ReportCategoryOption {
  value: string;
  label: string;
  /** Protocol-safe category value. Defaults to `value` when omitted. */
  protocolValue?: string;
}

export const REPORT_AREAS: readonly ReportAreaOption[] = [
  { value: 'bench', label: 'Riverside Park — east gate bench area' },
  { value: 'rack', label: 'Community Centre — north entrance' },
  { value: 'door', label: 'Community Centre — side entrance' },
  { value: 'fence', label: 'Allotment gardens — west boundary' },
  { value: 'playground', label: 'Playground — south corner' },
  { value: 'path', label: 'Riverside path — north gate' },
];

export const REPORT_CATEGORIES: readonly ReportCategoryOption[] = [
  { value: 'bench', label: 'Bench / seating' },
  { value: 'bicycle_rack', label: 'Bicycle rack' },
  { value: 'fence', label: 'Fence' },
  { value: 'door', label: 'Door / closer' },
  { value: 'playground', label: 'Non-electrical playground fixture' },
  { value: 'pothole', label: 'Pothole / path surface', protocolValue: 'other' },
  { value: 'other', label: 'Other low-risk community asset' },
];

const ASSET_BY_ROUTE: Record<string, string> = {
  'bench:bench': 'BENCH-001',
  'bicycle_rack:rack': 'RACK-002',
  'door:door': 'DOOR-003',
  'fence:fence': 'FENCE-004',
  'playground:playground': 'PLAY-005',
};

export const PATH_ASSET_ID = 'PATH-006';

export function protocolCategoryFor(category: string): string {
  return REPORT_CATEGORIES.find((item) => item.value === category)?.protocolValue ?? category;
}

export function assetIdForReport(category: string, area: string): string {
  const direct = ASSET_BY_ROUTE[`${category}:${area}`];
  if (direct) return direct;
  if (protocolCategoryFor(category) === 'other' && area === 'path') return PATH_ASSET_ID;
  return 'UNASSIGNED';
}
