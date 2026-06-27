export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export type ApiState = {
  token: string | null;
  setToken: (token: string | null) => void;
};

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("mypro-token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? "Action impossible.");
  return payload as T;
}

export function saveToken(token: string) {
  localStorage.setItem("mypro-token", token);
}

export function clearToken() {
  localStorage.removeItem("mypro-token");
}
