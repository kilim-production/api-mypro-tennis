const productionApiOrigin = "https://mypro-tennis-api.onrender.com";

function isLocalServiceUrl(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function resolveServiceUrl(
  configured: string | undefined,
  productionUrl: string,
  localUrl: string
) {
  if (import.meta.env.PROD && (!configured || isLocalServiceUrl(configured))) return productionUrl;
  return configured ?? localUrl;
}

export const API_URL = resolveServiceUrl(
  import.meta.env.VITE_API_URL,
  `${productionApiOrigin}/api`,
  "http://localhost:4000/api"
);

export const SOCKET_URL = resolveServiceUrl(
  import.meta.env.VITE_SOCKET_URL,
  productionApiOrigin,
  "http://localhost:4000"
);

const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

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
  if (path === "/rankings") return 120_000;
  if (path === "/tournaments") return 60_000;
  if (path === "/matches" || path === "/clubs") return 30_000;
  if (
    path === "/clubs/me" ||
    path === "/clubs/team-championship" ||
    path === "/skills" ||
    path === "/players/me/career"
  )
    return 15_000;
  if (path === "/chests" || path === "/coach-decks" || path === "/matches/duel-pool")
    return 60_000;
  if (path === "/season") return 10_000;
  if (path === "/shop/catalog") return 10_000;
  return 0;
}

export function clearApiCache() {
  responseCache.clear();
}

function invalidateCachedPaths(paths: string[]) {
  for (const key of responseCache.keys()) {
    const separator = key.indexOf(":");
    const cachedPath = separator >= 0 ? key.slice(separator + 1) : key;
    if (
      paths.some(
        (path) => cachedPath === path || cachedPath.startsWith(path.endsWith("/") ? path : `${path}/`)
      )
    ) {
      responseCache.delete(key);
    }
  }
}

function invalidateAfterMutation(path: string) {
  if (path.startsWith("/notifications")) return invalidateCachedPaths(["/auth/me"]);
  if (path.startsWith("/clubs"))
    return invalidateCachedPaths(["/clubs", "/auth/me"]);
  if (path.startsWith("/chests") || path.startsWith("/cards") || path.startsWith("/cosmetics"))
    return invalidateCachedPaths(["/chests", "/players/me/career", "/skills", "/auth/me"]);
  if (path.startsWith("/skills") || path.startsWith("/training"))
    return invalidateCachedPaths(["/skills", "/players/me/career", "/auth/me"]);
  if (path.startsWith("/season"))
    return invalidateCachedPaths(["/season", "/matches", "/chests", "/auth/me"]);
  if (path.startsWith("/shop"))
    return invalidateCachedPaths([
      "/shop/catalog",
      "/season",
      "/chests",
      "/players/me/career",
      "/skills",
      "/auth/me"
    ]);
  if (path.startsWith("/matches"))
    return invalidateCachedPaths([
      "/matches",
      "/matches/duel-pool",
      "/season",
      "/chests",
      "/auth/me"
    ]);
  if (path.startsWith("/players"))
    return invalidateCachedPaths(["/players", "/rankings", "/skills", "/auth/me"]);
  clearApiCache();
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
          ...(options.body ? { "Content-Type": "application/json" } : {}),
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
        invalidateAfterMutation(path);
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

export function warmApi() {
  return fetch(`${API_ORIGIN}/health`, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  }).then(() => undefined);
}
