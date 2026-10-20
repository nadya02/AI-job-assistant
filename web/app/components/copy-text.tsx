'use client';

import { useState } from 'react';

export function CopyText({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt('Copy this text', text);
    }
  }

  return (
    <button type="button" className="btn small" onClick={copy}>
      {copied ? 'Copied' : label}
    </button>
  );
}
