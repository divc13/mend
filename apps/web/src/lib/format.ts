const MICRO = 1_000_000n;

export function microToUsdc(micro: string | bigint, decimals = 2): string {
  const value = typeof micro === 'bigint' ? micro : BigInt(micro);
  const whole = value / MICRO;
  const frac = value % MICRO;
  const fracText = frac.toString().padStart(6, '0').slice(0, decimals).padEnd(decimals, '0');
  return decimals > 0 ? `${whole}.${fracText}` : whole.toString();
}

export function usdc(micro: string | bigint, decimals = 2): string {
  return `${microToUsdc(micro, decimals)} USDC`;
}

export function bpsToPercent(bps: number, decimals = 1): string {
  const value = bps / 100;
  return `${value.toFixed(decimals).replace(/\.0$/, '')}%`;
}

export function shortHash(hash: string, start = 8, end = 6): string {
  if (hash.length <= start + end + 1) return hash;
  return `${hash.slice(0, start)}…${hash.slice(-end)}`;
}

export function shortAccount(account: string, start = 12, end = 8): string {
  if (account.length <= start + end + 1) return account;
  return `${account.slice(0, start)}…${account.slice(-end)}`;
}

function formatWith(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return formatWith({
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })(date).replace(',', ' ·') + ' UTC';
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return formatWith({ day: '2-digit', month: 'short', year: 'numeric' })(date);
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return formatWith({ hour: '2-digit', minute: '2-digit', hour12: false })(date) + ' UTC';
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function isPast(iso: string, now = Date.now()): boolean {
  return new Date(iso).getTime() <= now;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
