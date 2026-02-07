"use client";

import { useMemo, useState } from "react";

type SeriesResp = {
  n: number;
  a: { id: string; name: string; wins: number; avg: number };
  b: { id: string; name: string; wins: number; avg: number };
  meta: { avgMargin: number; blowouts: number; nailbiters: number; ots: number };
  sims: Array<{ a: number; b: number; winner: "A" | "B"; margin: number; hadOT: boolean }>;
};

export default function SeriesButton({
  mode,
  draftA,
  draftB,
  commit = true,
  label,
}: {
  mode: "top" | "sicko";
  draftA: string;
  draftB: string;
  commit?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<SeriesResp | null>(null);

  const title = useMemo(() => {
    if (!data) return label ?? "Run it 10 times";
    return `Series: ${data.a.wins}-${data.b.wins}`;
  }, [data, label]);

  async function run() {
    setOpen(true);
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, draftA, draftB, n: 10, commit: Boolean(commit) }),
      });

      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === "object" && json && "error" in json && typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : "Failed to simulate series";
        throw new Error(msg);
      }
      setData(json as SeriesResp);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to simulate series");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={run}
        className="rounded-xl border border-white/10 bg-red-500/90 px-3 py-1.5 text-sm font-semibold text-black hover:bg-red-400"
      >
        {title}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0e] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">series sim</div>
                <div className="truncate text-sm font-black tracking-tight text-zinc-100">Run it 10 times</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 p-4">
              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
                  Simulating…
                </div>
              ) : err ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  {err}
                </div>
              ) : data ? (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="text-xs text-zinc-400">{data.a.name}</div>
                      <div className="mt-1 text-2xl font-black tracking-tight text-zinc-100">
                        {data.a.wins}
                        <span className="text-zinc-500">–</span>
                        {data.b.wins}
                      </div>
                      <div className="mt-2 text-[11px] text-zinc-400">avg score: {data.a.avg}</div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="text-xs text-zinc-400">{data.b.name}</div>
                      <div className="mt-1 text-2xl font-black tracking-tight text-zinc-100">
                        {data.b.wins}
                        <span className="text-zinc-500">–</span>
                        {data.a.wins}
                      </div>
                      <div className="mt-2 text-[11px] text-zinc-400">avg score: {data.b.avg}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-[11px]">
                    <Stat label="Avg margin" value={data.meta.avgMargin} />
                    <Stat label="Nailbiters" value={data.meta.nailbiters} />
                    <Stat label="Blowouts" value={data.meta.blowouts} />
                    <Stat label="OT games" value={data.meta.ots} />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">sample results</div>
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      {data.sims.map((s, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                        >
                          <div className="text-sm text-zinc-200">
                            <span className={s.winner === "A" ? "font-black text-zinc-100" : "text-zinc-300"}>
                              {s.a}
                            </span>
                            <span className="mx-2 text-zinc-600">–</span>
                            <span className={s.winner === "B" ? "font-black text-zinc-100" : "text-zinc-300"}>
                              {s.b}
                            </span>
                            {s.hadOT ? <span className="ml-2 text-[11px] text-zinc-500">OT</span> : null}
                          </div>
                          <div className="text-[11px] text-zinc-500">margin {s.margin}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
                  Click the button again if it didn’t start.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-2">
      <div className="text-zinc-500">{label}</div>
      <div className="mt-0.5 font-black text-zinc-100">{value}</div>
    </div>
  );
}
