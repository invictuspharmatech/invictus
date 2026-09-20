import { cookies } from "next/headers";

const BASE = process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000";

export class DjangoError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export function djangoUrl(path: string): string {
  return `${BASE}${path}`;
}

type DjangoInit = RequestInit & { token?: string | null };

export async function djangoFetch(path: string, init: DjangoInit = {}): Promise<Response> {
  const { token, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders);
  if (rest.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return fetch(djangoUrl(path), { cache: "no-store", ...rest, headers });
}

export async function djangoJson<T>(path: string, init: DjangoInit = {}): Promise<T> {
  const res = await djangoFetch(path, init);
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: string }).error)
        : `Django request failed (${res.status})`;
    throw new DjangoError(message, res.status, payload);
  }
  return payload as T;
}

export async function djangoJsonOptional<T>(path: string, init: DjangoInit = {}): Promise<T | null> {
  try {
    return await djangoJson<T>(path, init);
  } catch (error) {
    if (error instanceof DjangoError && error.status === 404) return null;
    throw error;
  }
}

export async function sessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get("invictus_session")?.value ?? null;
}

export async function djangoAuthed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await sessionToken();
  return djangoJson<T>(path, { ...init, token });
}
