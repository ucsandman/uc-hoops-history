"use client";

import { useMemo, useState } from "react";

type Pt = { t: string; a: number; b: number; wpA: number };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function WinProbChart({
  aName,
  bName,
  data,
}: {
  aName: string;
  bName: string;
  data: Pt[];
}) {
  const [idx, setIdx] = useState<number | null>(null);

  const w = 880;
  const h = 220;
  const pad = 14;

  const pts = useMemo(() => {
    if (!data.length) return "";
    return data
      .map((d, i) => {
        const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
        const y = pad + (1 - clamp(d.wpA, 0, 1)) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data]);

  const active = idx == null ? null : data[clamp(idx, 0, data.length - 1)];

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/30 via-white/5 to-black/20 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-black tracking-tight">Win probability</h2>
        <div className="text-xs text-zinc-500">scrub the line</div>
      </div>

      <div className="mt-2 text-xs text-zinc-400">
        {aName} win % over time (simple model, not Vegas). Hover/tap to inspect.
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/25">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          className="block h-[220px] w-full"
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = e.clientX - rect.left;
            const t = clamp(px / rect.width, 0, 1);
            const i = Math.round(t * (data.length - 1));
            setIdx(i);
          }}
          onMouseLeave={() => setIdx(null)}
          onTouchMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const touch = e.touches[0];
            if (!touch) return;
            const px = touch.clientX - rect.left;
            const t = clamp(px / rect.width, 0, 1);
            const i = Math.round(t * (data.length - 1));
            setIdx(i);
          }}
          onTouchEnd={() => setIdx(null)}
        >
          <defs>
            <linearGradient id="wpGrad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#ef4444" stopOpacity="0.85" />
              <stop offset="0.5" stopColor="#eab308" stopOpacity="0.55" />
              <stop offset="1" stopColor="#3b82f6" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="fillGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#ef4444" stopOpacity="0.20" />
              <stop offset="1" stopColor="#ef4444" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* midline */}
          <line x1={pad} x2={w - pad} y1={h / 2} y2={h / 2} stroke="rgba(255,255,255,0.10)" strokeWidth="2" />

          {/* subtle grid */}
          {[0.25, 0.75].map((p) => (
            <line
              key={p}
              x1={pad}
              x2={w - pad}
              y1={pad + (1 - p) * (h - pad * 2)}
              y2={pad + (1 - p) * (h - pad * 2)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          ))}

          {/* area under curve */}
          {data.length ? (
            <path
              d={`M ${pad},${h - pad} L ${pts} L ${w - pad},${h - pad} Z`}
              fill="url(#fillGrad)"
              stroke="none"
            />
          ) : null}

          {/* curve */}
          <polyline points={pts} fill="none" stroke="url(#wpGrad)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

          {/* active marker */}
          {active ? (
            (() => {
              const i = clamp(idx ?? 0, 0, data.length - 1);
              const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
              const y = pad + (1 - clamp(active.wpA, 0, 1)) * (h - pad * 2);
              return (
                <g>
                  <line x1={x} x2={x} y1={pad} y2={h - pad} stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
                  <circle cx={x} cy={y} r={6} fill="#ef4444" fillOpacity="0.95" />
                  <circle cx={x} cy={y} r={10} fill="#ef4444" fillOpacity="0.18" />
                </g>
              );
            })()
          ) : null}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-zinc-400">
          {active ? (
            <>
              <span className="font-black text-zinc-100">{Math.round(active.wpA * 100)}%</span> {aName} at {active.t}
              <span className="text-zinc-600"> • </span>
              <span className="text-zinc-300">
                {active.a}–{active.b}
              </span>
            </>
          ) : (
            <>
              Hover/tap the line.
              <span className="text-zinc-600"> • </span>
              <span className="text-zinc-500">
                {aName} vs {bName}
              </span>
            </>
          )}
        </div>
        <div className="text-zinc-500">0% {aName} • 100% {aName}</div>
      </div>
    </div>
  );
}
