"use client";

import { useState } from "react";

export default function ShareMatchButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const u = new URL(window.location.href);
    // cache-bust previews (some apps cache OG aggressively)
    u.searchParams.set("v", Date.now().toString());
    await navigator.clipboard.writeText(u.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  }

  return (
    <button
      onClick={copy}
      className="sb-chip rounded-xl px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/5"
    >
      {copied ? "Copied" : "Copy share link"}
    </button>
  );
}
