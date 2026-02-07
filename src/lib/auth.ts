import { cookies } from "next/headers";

export const USER_COOKIE = "uc_user";

export async function getUserId(): Promise<string | null> {
  const c = await cookies();
  return c.get(USER_COOKIE)?.value ?? null;
}
