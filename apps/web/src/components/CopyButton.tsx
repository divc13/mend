'use client';

import { useState } from 'react';
import { Check, Copy } from './Icons';

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="copy-button" onClick={copy} aria-label={copied ? `${label}: copied` : label}>
      {copied ? <Check size={15} /> : <Copy size={15} />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}
