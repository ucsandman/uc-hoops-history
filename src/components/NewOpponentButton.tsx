"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewOpponentButton({ draftId, mode }: { draftId: string; mode: "top" | "sicko" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftId, mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Match failed");
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
        className="rounded-xl bg-red-500/90 px-3 py-1.5 text-xs font-black text-black hover:bg-red-400 transition-colors disabled:opacity-60"
      >
        {loading ? "Matching" : "New matchup"}
      </button>
      {err ? <div className="mt-2 text-[11px] text-red-300">{err}</div> : null}
    </div>
  );
}
