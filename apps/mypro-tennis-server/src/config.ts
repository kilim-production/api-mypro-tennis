import "dotenv/config";

const clientUrls = (process.env.CLIENT_URL ?? "http://localhost:5173")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

export const config = {
  port: Number(process.env.SERVER_PORT ?? process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  clientUrl: clientUrls[0] ?? "http://localhost:5173",
  clientUrls,
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ??
    `http://localhost:${Number(process.env.SERVER_PORT ?? 4000)}/api/auth/google/callback`
};
