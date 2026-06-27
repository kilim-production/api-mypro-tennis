import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { prisma } from "@mypro/database";
import { signSession } from "@mypro/auth";
import { loginSchema, signupSchema } from "@mypro/shared";
import { config } from "../config";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { publicPlayer } from "../services/playerMapper";

export const authRouter = Router();
const googleProvider = "google";

type GoogleOAuthState = {
  mode: "login" | "signup" | "link";
  userId?: string;
  nonce: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
};

function publicUser(user: {
  id: string;
  email: string;
  displayName: string;
  oauthAccounts?: Array<{ provider: string }>;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    googleLinked: Boolean(
      user.oauthAccounts?.some((account) => account.provider === googleProvider)
    )
  };
}

function googleConfigured() {
  return Boolean(config.googleClientId && config.googleClientSecret && config.googleRedirectUri);
}

function clientRedirect(path: string, params: Record<string, string>) {
  const url = new URL(path, config.clientUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function signGoogleState(state: GoogleOAuthState) {
  return jwt.sign(state, config.jwtSecret, {
    expiresIn: "10m",
    issuer: "mypro-tennis-google-oauth"
  });
}

function verifyGoogleState(token: string) {
  return jwt.verify(token, config.jwtSecret, {
    issuer: "mypro-tennis-google-oauth"
  }) as GoogleOAuthState;
}

function googleAuthUrl(state: GoogleOAuthState) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.googleClientId);
  url.searchParams.set("redirect_uri", config.googleRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", signGoogleState(state));
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

async function exchangeGoogleCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      grant_type: "authorization_code"
    })
  });
  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? "Connexion Google impossible.");
  }
  return payload.access_token;
}

async function fetchGoogleUser(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = (await response.json()) as GoogleUserInfo;
  if (!response.ok || !payload.sub || !payload.email) {
    throw new Error("Profil Google incomplet.");
  }
  if (payload.email_verified === false) throw new Error("Email Google non vérifié.");
  return payload;
}

authRouter.post("/signup", validateBody(signupSchema), async (request, response) => {
  const exists = await prisma.user.findUnique({ where: { email: request.body.email } });
  if (exists)
    return response.status(409).json({ message: "Un compte existe déjà avec cet email." });
  const passwordHash = await bcrypt.hash(request.body.password, 12);
  const user = await prisma.user.create({
    data: { email: request.body.email, passwordHash, displayName: request.body.displayName }
  });
  const token = signSession({ userId: user.id, email: user.email }, config.jwtSecret);
  return response.status(201).json({ token, user: publicUser(user) });
});

authRouter.post("/login", validateBody(loginSchema), async (request, response) => {
  const user = await prisma.user.findUnique({
    where: { email: request.body.email },
    include: { player: true, oauthAccounts: true }
  });
  if (!user || !(await bcrypt.compare(request.body.password, user.passwordHash))) {
    return response.status(401).json({ message: "Identifiants invalides." });
  }
  const token = signSession({ userId: user.id, email: user.email }, config.jwtSecret);
  return response.json({
    token,
    user: publicUser(user),
    player: user.player ? publicPlayer(user.player) : null
  });
});

authRouter.get("/google/start", async (request, response) => {
  if (!googleConfigured()) {
    return response.redirect(
      clientRedirect("/login", { oauthError: "Connexion Google non configurée." })
    );
  }
  const mode = request.query.mode === "signup" ? "signup" : "login";
  return response.redirect(googleAuthUrl({ mode, nonce: randomUUID() }));
});

authRouter.post("/google/link/start", requireAuth, async (request, response) => {
  if (!googleConfigured()) {
    return response.status(409).json({ message: "Connexion Google non configurée." });
  }
  return response.json({
    url: googleAuthUrl({
      mode: "link",
      userId: request.session!.userId,
      nonce: randomUUID()
    })
  });
});

authRouter.get("/google/callback", async (request, response) => {
  const code = typeof request.query.code === "string" ? request.query.code : "";
  const stateToken = typeof request.query.state === "string" ? request.query.state : "";
  try {
    if (!googleConfigured()) throw new Error("Connexion Google non configurée.");
    if (!code || !stateToken) throw new Error("Retour Google invalide.");
    const state = verifyGoogleState(stateToken);
    const accessToken = await exchangeGoogleCode(code);
    const googleUser = await fetchGoogleUser(accessToken);

    if (state.mode === "link") {
      if (!state.userId) throw new Error("Session de liaison invalide.");
      const existing = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: googleProvider,
            providerAccountId: googleUser.sub
          }
        }
      });
      if (existing && existing.userId !== state.userId) {
        throw new Error("Ce compte Google est déjà lié à un autre compte MYPRO.");
      }
      await prisma.oAuthAccount.upsert({
        where: { userId_provider: { userId: state.userId, provider: googleProvider } },
        create: {
          userId: state.userId,
          provider: googleProvider,
          providerAccountId: googleUser.sub,
          email: googleUser.email,
          displayName: googleUser.name ?? ""
        },
        update: {
          providerAccountId: googleUser.sub,
          email: googleUser.email,
          displayName: googleUser.name ?? ""
        }
      });
      return response.redirect(clientRedirect("/settings", { googleLinked: "1" }));
    }

    const oauthAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: googleProvider,
          providerAccountId: googleUser.sub
        }
      },
      include: { user: { include: { player: true, oauthAccounts: true } } }
    });
    let user = oauthAccount?.user ?? null;
    let created = false;
    if (!user) {
      const existingEmailUser = await prisma.user.findUnique({
        where: { email: googleUser.email }
      });
      if (existingEmailUser) {
        return response.redirect(
          clientRedirect("/login", {
            oauthError:
              "Un compte existe déjà avec cet email. Connectez-vous puis liez Google dans Réglages."
          })
        );
      }
      const passwordHash = await bcrypt.hash(`google:${googleUser.sub}:${randomUUID()}`, 12);
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          passwordHash,
          displayName: googleUser.name ?? googleUser.email.split("@")[0] ?? "Joueur MyPro",
          oauthAccounts: {
            create: {
              provider: googleProvider,
              providerAccountId: googleUser.sub,
              email: googleUser.email,
              displayName: googleUser.name ?? ""
            }
          }
        },
        include: { player: true, oauthAccounts: true }
      });
      created = true;
    }
    const token = signSession({ userId: user.id, email: user.email }, config.jwtSecret);
    return response.redirect(
      clientRedirect("/oauth/google", { token, created: created ? "1" : "0" })
    );
  } catch (error) {
    return response.redirect(
      clientRedirect("/login", {
        oauthError: error instanceof Error ? error.message : "Connexion Google impossible."
      })
    );
  }
});

authRouter.get("/me", requireAuth, async (request, response) => {
  const user = await prisma.user.findUnique({
    where: { id: request.session!.userId },
    include: {
      player: true,
      oauthAccounts: true,
      notifications: { orderBy: { createdAt: "desc" }, take: 8 }
    }
  });
  if (!user) return response.status(404).json({ message: "Compte introuvable." });
  return response.json({
    user: publicUser(user),
    player: user.player ? publicPlayer(user.player) : null,
    notifications: user.notifications
  });
});
