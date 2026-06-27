export function encodeJson(value: unknown) {
  return JSON.stringify(value);
}

export function decodeJson<T>(value: string | T): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value;
}
