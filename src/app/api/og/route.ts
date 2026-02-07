import React from "react";
import { ImageResponse } from "next/og";

export const runtime = "edge";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function q(url: URL, k: string, fallback = "") {
  const v = url.searchParams.get(k);
  return (v ?? fallback).toString().slice(0, 80);
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const a = q(url, "a", "Team A");
  const b = q(url, "b", "Team B");
  const as = parseInt(url.searchParams.get("as") ?? "0", 10);
  const bs = parseInt(url.searchParams.get("bs") ?? "0", 10);
  const mode = q(url, "mode", "top") === "sicko" ? "sicko" : "top";
  const ot = q(url, "ot", "0") === "1";
  const pog = q(url, "pog", "");

  const aScore = clamp(Number.isFinite(as) ? as : 0, 0, 199);
  const bScore = clamp(Number.isFinite(bs) ? bs : 0, 0, 199);

  const sicko = mode === "sicko";

  const el = React.createElement;

  const chip = (text: string) =>
    el(
      "div",
      {
        style: {
          padding: "8px 12px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.04)",
        },
      },
      text
    );

  return new ImageResponse(
    el(
      "div",
      {
        style: {
          width: "1200px",
          height: "630px",
          display: "flex",
          background: "#07070a",
          color: "#fff",
          padding: 56,
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
        },
      },
      // background vibes
      el("div", {
        style: {
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(900px 700px at 20% 10%, rgba(239,68,68,0.22), transparent 60%), radial-gradient(800px 600px at 80% 70%, rgba(255,255,255,0.08), transparent 55%)",
        } satisfies React.CSSProperties,
      }),
      el("div", {
        style: {
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02) 40%, rgba(0,0,0,0.3))",
        } satisfies React.CSSProperties,
      }),

      el(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 22, width: "100%", zIndex: 2 } },
        el(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
          el(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 12 } },
            el("div", {
              style: {
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "rgba(239,68,68,0.95)",
                boxShadow: "0 0 0 6px rgba(239,68,68,0.12)",
              },
            }),
            el("div", { style: { fontSize: 22, fontWeight: 800, letterSpacing: -0.4 } }, "Bearcats Since 2012")
          ),
          el(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 18,
                color: "rgba(255,255,255,0.8)",
              },
            },
            chip(sicko ? "Sicko League" : "Top 5 League"),
            ot ? chip("OT") : null
          )
        ),

        el(
          "div",
          { style: { display: "flex", gap: 22, width: "100%", flex: 1 } },
          el(
            "div",
            {
              style: {
                flex: 1,
                borderRadius: 28,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.25)",
                padding: 28,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              },
            },
            el("div", { style: { fontSize: 18, color: "rgba(255,255,255,0.72)", fontWeight: 700 } }, "Team A"),
            el("div", { style: { fontSize: 48, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05 } }, a),
            el("div", { style: { fontSize: 86, fontWeight: 950, letterSpacing: -2 } }, String(aScore))
          ),
          el(
            "div",
            {
              style: {
                width: 96,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.35)",
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: 4,
              },
            },
            "VS"
          ),
          el(
            "div",
            {
              style: {
                flex: 1,
                borderRadius: 28,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.25)",
                padding: 28,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              },
            },
            el("div", { style: { fontSize: 18, color: "rgba(255,255,255,0.72)", fontWeight: 700 } }, "Team B"),
            el("div", { style: { fontSize: 48, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05 } }, b),
            el("div", { style: { fontSize: 86, fontWeight: 950, letterSpacing: -2 } }, String(bScore))
          )
        ),

        el(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
            },
          },
          el(
            "div",
            { style: { fontSize: 18, color: "rgba(255,255,255,0.7)", fontWeight: 700 } },
            pog ? `Player of the game: ${pog}` : "Share the matchup. Settle the argument."
          ),
          el("div", { style: { fontSize: 16, color: "rgba(255,255,255,0.55)" } }, "uc-hoops-history.vercel.app")
        )
      )
    ),
    { width: 1200, height: 630 }
  );
}
