import { shortHash } from '@/lib/format';
import { explorerTxUrl } from '@/lib/testnet';
import { CopyButton } from './CopyButton';
import { Badge } from './ui';
import { ExternalLink, ShieldCheck } from './Icons';

/**
 * Renders a transaction hash only when the API supplied one. Explorer links
 * are built here from a shape-checked testnet hash; a replay fixture or an
 * arbitrary string never becomes a "live" link.
 */
export function TxHashRow({
  hash,
  label = 'Transaction hash',
  compact = false,
}: {
  hash: string;
  label?: string;
  compact?: boolean;
}) {
  const explorerUrl = explorerTxUrl(hash);

  return (
    <div className={`tx-hash-row${compact ? ' tx-hash-row--compact' : ''}`}>
      <span className="tx-hash-row__label">{label}</span>
      <code title={hash}>{compact ? shortHash(hash, 10, 6) : shortHash(hash, 16, 10)}</code>
      <div className="tx-hash-row__actions">
        <CopyButton value={hash} label="Copy hash" />
        {explorerUrl ? (
          <a className="tx-link" href={explorerUrl} target="_blank" rel="noopener noreferrer">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>Testnet explorer</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        ) : (
          <Badge tone="warning">Hash format not linkable</Badge>
        )}
      </div>
    </div>
  );
}
