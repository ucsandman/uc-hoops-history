export function setQueryParams(router: { replace: (url: string) => void }, params: Record<string, string | null | undefined>) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(params)) {
    if (!v) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  router.replace(url.pathname + url.search);
}
