import "dotenv/config";
import { readFile } from "node:fs/promises";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const apiBase = "https://discord.com/api/v10";
const targetChannels = ["journal-des-mises-à-jour", "annonces"];

if (!token || !guildId) {
  console.error("DISCORD_BOT_TOKEN et DISCORD_GUILD_ID doivent être renseignés dans .env.");
  process.exit(1);
}

async function discord(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json; charset=utf-8",
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (response.status === 429) {
    const retryAfter = Math.ceil((payload?.retry_after ?? 2) * 1000);
    await new Promise((resolve) => setTimeout(resolve, retryAfter + 250));
    return discord(path, options);
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function assertValidUnicode(value) {
  const suspicious = ["�", "Ã©", "Ã¨", "Ãª", "Ã ", "Â", "â€™", "â€“", "ðŸ"];
  const found = suspicious.find((sequence) => value.includes(sequence));
  if (found) throw new Error(`Publication bloquée : séquence mal encodée détectée (${found}).`);
}

async function getChannels() {
  const channels = await discord(`/guilds/${guildId}/channels`);
  return new Map(channels.filter((channel) => channel.type === 0).map((channel) => [channel.name, channel]));
}

async function showLatest() {
  const channels = await getChannels();
  for (const name of targetChannels) {
    const channel = channels.get(name);
    if (!channel) continue;
    const messages = await discord(`/channels/${channel.id}/messages?limit=10`);
    console.log(`\n#${name}`);
    for (const message of messages) {
      const embedText = (message.embeds ?? [])
        .map((embed) => [embed.title, embed.description, ...(embed.fields ?? []).map((field) => `${field.name}\n${field.value}`)]
          .filter(Boolean)
          .join("\n"))
        .join("\n");
      const body = [message.content, embedText].filter(Boolean).join("\n").trim();
      console.log(`--- ${message.timestamp} | ${message.author?.username ?? "inconnu"}\n${body.slice(0, 6000)}`);
    }
  }
}

async function publish(filePath) {
  if (!filePath) throw new Error("Chemin du patch note manquant.");
  const raw = (await readFile(filePath, "utf8")).replace(/^\uFEFF/, "").trim();
  assertValidUnicode(raw);
  const [titleLine, ...bodyLines] = raw.split(/\r?\n/);
  const title = titleLine.replace(/^#\s*/, "").trim();
  const description = bodyLines.join("\n").trim();
  if (!title || !description) throw new Error("Le patch note doit contenir un titre et une description.");
  if (title.length > 256 || description.length > 4096) {
    throw new Error(`Patch note trop long pour Discord (${title.length}/256, ${description.length}/4096).`);
  }

  const channels = await getChannels();
  const channel = channels.get("journal-des-mises-à-jour") ?? channels.get("annonces");
  if (!channel) throw new Error("Aucun salon de publication trouvé.");

  const message = await discord(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title,
          description,
          color: 0x43e5b0,
          footer: { text: "MYPRO - TENNIS • Kilim Games Production" },
          timestamp: new Date().toISOString()
        }
      ]
    })
  });
  console.log(`Patch note publié dans #${channel.name} (message ${message.id}).`);
}

const [command = "latest", argument] = process.argv.slice(2);
if (command === "latest") await showLatest();
else if (command === "publish") await publish(argument);
else throw new Error(`Commande inconnue : ${command}`);
