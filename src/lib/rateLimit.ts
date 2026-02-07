type Bucket = { count: number; resetAt: number };

function store(): Map<string, Bucket> {
  const g = globalThis as unknown as { __uc_rl?: Map<string, Bucket> };
  if (!g.__uc_rl) g.__uc_rl = new Map();
  return g.__uc_rl;
}

export type RateLimitOpts = {
  key: string;
  limit: number;
  windowMs: number;
};

export function rateLimit(
  opts: RateLimitOpts
): { ok: true; remaining: number; resetAt: number } | { ok: false; retryAfterMs: number } {
  const s = store();
  const now = Date.now();

  const cur = s.get(opts.key);
  if (!cur || now >= cur.resetAt) {
    const b: Bucket = { count: 1, resetAt: now + opts.windowMs };
    s.set(opts.key, b);
    return { ok: true, remaining: opts.limit - 1, resetAt: b.resetAt };
  }

  if (cur.count >= opts.limit) {
    return { ok: false, retryAfterMs: cur.resetAt - now };
  }

  cur.count++;
  s.set(opts.key, cur);
  return { ok: true, remaining: opts.limit - cur.count, resetAt: cur.resetAt };
}

export function ipKey(req: Request, prefix: string) {
  const xf = req.headers.get("x-forwarded-for");
  const ip = (xf ? xf.split(",")[0] : req.headers.get("x-real-ip"))?.trim() || "unknown";
  return `${prefix}:${ip}`;
}
