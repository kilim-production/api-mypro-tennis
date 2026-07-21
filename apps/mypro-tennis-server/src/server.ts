import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { PresenceRegistry } from "@mypro/realtime";
import { verifySession } from "@mypro/auth";
import { prisma } from "@mypro/database";
import { config } from "./config";
import { authRouter } from "./routes/auth";
import { playersRouter } from "./routes/players";
import { trainingRouter } from "./routes/training";
import { clubsRouter } from "./routes/clubs";
import { gameRouter } from "./routes/game";
import { stripeShopWebhook } from "./routes/stripeWebhook";
import { stripeShopConfiguration } from "./services/stripeShop";

const app = express();
const server = http.createServer(app);
const corsOptions = {
  origin(origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) {
    if (!origin || config.clientUrls.includes(origin)) return callback(null, true);
    return callback(new Error("Origine non autorisée par MYPRO - TENNIS."));
  },
  credentials: true,
  maxAge: 86_400,
  optionsSuccessStatus: 204
};
const io = new Server(server, { cors: { origin: config.clientUrls, credentials: true } });
const presence = new PresenceRegistry();

app.use(cors(corsOptions));
app.post(
  "/api/shop/stripe/webhook",
  express.raw({ type: "application/json", limit: "256kb" }),
  stripeShopWebhook
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_request, response) => {
  const stripe = stripeShopConfiguration();
  response.json({
    ok: true,
    service: "MYPRO - TENNIS",
    payments: {
      stripe: {
        ready: stripe.enabled,
        mode: stripe.mode
      }
    }
  });
});
app.use("/api/auth", authRouter);
app.use("/api/players", playersRouter);
app.use("/api/training", trainingRouter);
app.use("/api/clubs", clubsRouter);
app.use("/api", gameRouter);

io.on("connection", (socket) => {
  socket.on("presence:join", async (token: string) => {
    try {
      const claims = verifySession(token, config.jwtSecret);
      const user = await prisma.user.findUnique({
        where: { id: claims.userId },
        include: { player: true }
      });
      if (!user) return;
      await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
      presence.upsert(socket.id, {
        userId: user.id,
        ...(user.player ? { playerId: user.player.id } : {}),
        displayName: user.player
          ? `${user.player.firstName} ${user.player.lastName}`
          : user.displayName,
        connectedAt: new Date().toISOString()
      });
      io.emit("presence:list", presence.list());
    } catch {
      socket.emit("presence:error", "Session invalide.");
    }
  });
  socket.on("disconnect", () => {
    presence.remove(socket.id);
    io.emit("presence:list", presence.list());
  });
});

server.listen(config.port, () => {
  const stripe = stripeShopConfiguration();
  console.log(`MYPRO - TENNIS serveur prêt sur http://localhost:${config.port}`);
  console.log(
    `Boutique Stripe : ${stripe.enabled ? `prete (${stripe.mode})` : `inactive (${stripe.mode})`}`
  );
});
