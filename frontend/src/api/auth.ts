const API_BASE = "/api";

export type AuthTokens = { access: string; refresh: string };
export type AuthUser = { id: string; email: string };

export async function authRegister(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "register failed");
  }
  return (await res.json()) as { user: AuthUser; tokens: AuthTokens };
}

export async function authLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "login failed");
  }
  return (await res.json()) as { user: AuthUser; tokens: AuthTokens };
}

export async function authRefresh(refresh: string) {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    throw new Error("refresh failed");
  }
  return (await res.json()) as { tokens: AuthTokens };
}
