export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type ApiState = {
  token: string | null;
  setToken: (token: string | null) => void;
};

type CachedApiResponse = {
  expiresAt: number;
  value: unknown;
};

const responseCache = new Map<string, CachedApiResponse>();
const pendingRequests = new Map<string, Promise<unknown>>();
const apiTimeoutMs = 45_000;

function cacheDuration(path: string) {
  if (path === "/rankings" || path === "/tournaments") return 30_000;
  if (path === "/matches" || path === "/clubs") return 15_000;
  if (path === "/clubs/me" || path === "/skills" || path === "/players/me/career") return 8_000;
  if (path === "/season" || path === "/chests" || path === "/matches/duel-pool") return 5_000;
  return 0;
}

export function clearApiCache() {
  responseCache.clear();
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("mypro-token");
  const method = (options.method ?? "GET").toUpperCase();
  const requestKey = `${token ?? "guest"}:${path}`;
  const duration = method === "GET" ? cacheDuration(path) : 0;
  const cached = duration ? responseCache.get(requestKey) : undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;

  if (method === "GET") {
    const pending = pendingRequests.get(requestKey);
    if (pending) return pending as Promise<T>;
  }

  const request = (async () => {
    const controller = new AbortController();
    let timeoutExpired = false;
    const timeoutId = setTimeout(() => {
      timeoutExpired = true;
      controller.abort();
    }, apiTimeoutMs);
    const relayAbort = () => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) relayAbort();
    else options.signal?.addEventListener("abort", relayAbort, { once: true });

    try {
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new ApiError(payload.message ?? "Action impossible.", response.status);

      if (method === "GET" && duration) {
        responseCache.set(requestKey, { expiresAt: Date.now() + duration, value: payload });
      } else if (method !== "GET") {
        clearApiCache();
      }
      return payload as T;
    } catch (error) {
      if (timeoutExpired) {
        throw new ApiError(
          "Le serveur ne répond pas. Vérifiez la connexion puis appuyez sur Réessayer.",
          408
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", relayAbort);
    }
  })();

  if (method === "GET") pendingRequests.set(requestKey, request);
  try {
    return await request;
  } finally {
    if (method === "GET" && pendingRequests.get(requestKey) === request) {
      pendingRequests.delete(requestKey);
    }
  }
}

export function saveToken(token: string) {
  clearApiCache();
  localStorage.setItem("mypro-token", token);
}

export function clearToken() {
  clearApiCache();
  localStorage.removeItem("mypro-token");
}
