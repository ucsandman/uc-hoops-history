"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunItBackButton({
  draftA,
  draftB,
  mode,
}: {
  draftA: string;
  draftB: string;
  mode: "top" | "sicko";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/rematch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftA, draftB, mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Rematch failed");
      router.push(`/m/${json.matchId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={loading}
        className="sb-chip rounded-xl px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-white/5 transition-colors disabled:opacity-60"
      >
        {loading ? "Running" : "Run it back"}
      </button>
      {err ? <div className="mt-2 text-[11px] text-red-300">{err}</div> : null}
    </div>
  );
}
