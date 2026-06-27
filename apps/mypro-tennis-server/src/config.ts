import "dotenv/config";

const defaultClientUrl = "http://localhost:5173";

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

const clientUrls = (process.env.CLIENT_URL ?? defaultClientUrl)
  .split(/[,\s]+/)
  .map((url) => url.trim())
  .filter(Boolean)
  .map(normalizeUrl)
  .filter((url): url is string => Boolean(url));

if (clientUrls.length === 0) clientUrls.push(defaultClientUrl);

export const config = {
  port: Number(process.env.SERVER_PORT ?? process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  clientUrl: clientUrls[0] ?? defaultClientUrl,
  clientUrls,
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ??
    `http://localhost:${Number(process.env.SERVER_PORT ?? 4000)}/api/auth/google/callback`
};
