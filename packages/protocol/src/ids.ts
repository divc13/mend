export const ASSET_ID_PATTERN = /^[A-Z]{2,12}-\d{3}$/;
export const REPORT_ID_PATTERN = /^R-\d{3}$/;
export const WORK_ORDER_ID_PATTERN = /^WO-[A-Z0-9-]+-\d{4}$/;
export const BID_ID_PATTERN = /^BID-[A-Z]-[A-Z0-9-]+$/;
export const CLUSTER_ID_PATTERN = /^CL-\d{4}$/;
export const DAO_PROPOSAL_ID_PATTERN = /^\d{1,10}$/;
export const NEAR_ACCOUNT_PATTERN = /^(([a-z\d]+[-_])*[a-z\d]+)(\.([a-z\d]+[-_])*[a-z\d]+)*$/;
export const HASH_PATTERN = /^[a-f0-9]{64}$/;
export const BASE64ISH_PATTERN = /^[A-Za-z0-9+/=_-]+$/;

export function isAssetId(value: string): boolean {
  return ASSET_ID_PATTERN.test(value);
}
export function isReportId(value: string): boolean {
  return REPORT_ID_PATTERN.test(value);
}
export function isWorkOrderId(value: string): boolean {
  return WORK_ORDER_ID_PATTERN.test(value);
}
export function isNearAccount(value: string): boolean {
  return value.length >= 2 && value.length <= 64 && NEAR_ACCOUNT_PATTERN.test(value);
}

export function canonicalWorkOrderId(assetId: string, sequence: number): string {
  if (!isAssetId(assetId)) throw new Error(`invalid asset id: ${assetId}`);
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) {
    throw new Error(`invalid work-order sequence: ${sequence}`);
  }
  return `WO-${assetId}-${String(sequence).padStart(4, '0')}`;
}
