"use client";

import { useRouter } from "next/navigation";

export default function BackButton({
  fallbackHref = "/",
  label = "Back",
  className = "",
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        // If the user navigated internally, router.back() is ideal.
        // If they landed directly on the page, back() can be a no-op, so we fall back.
        try {
          if (typeof window !== "undefined" && window.history.length > 1) router.back();
          else router.push(fallbackHref);
        } catch {
          router.push(fallbackHref);
        }
      }}
      className={
        "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-black/30 active:bg-black/40 " +
        className
      }
      aria-label={label}
    >
      <span className="text-base leading-none">←</span>
      <span>{label}</span>
    </button>
  );
}
