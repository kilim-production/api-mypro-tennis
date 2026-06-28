import "dotenv/config";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const apiBase = "https://discord.com/api/v10";

if (!token || !guildId) {
  console.error("DISCORD_BOT_TOKEN et DISCORD_GUILD_ID doivent être renseignés dans .env.");
  process.exit(1);
}

const PERMISSIONS = {
  ADMINISTRATOR: 8n,
  VIEW_CHANNEL: 1024n,
  SEND_MESSAGES: 2048n
};

const roles = [
  { name: "Kilim Games", color: "#34D399", permissions: PERMISSIONS.ADMINISTRATOR },
  { name: "Administrateur", color: "#EF4444", permissions: PERMISSIONS.ADMINISTRATOR },
  { name: "Modérateur", color: "#38BDF8", permissions: 0n },
  { name: "Support", color: "#A78BFA", permissions: 0n },
  { name: "Testeur", color: "#FACC15", permissions: 0n },
  { name: "Créateur de contenu", color: "#F472B6", permissions: 0n },
  { name: "Président de club", color: "#22D3EE", permissions: 0n },
  { name: "Joueur", color: "#E5E7EB", permissions: 0n },
  { name: "Nouveau", color: "#94A3B8", permissions: 0n }
];

const categories = [
  {
    name: "Accueil",
    channels: [
      { name: "annonces", kind: "text", readOnly: true },
      { name: "règles", kind: "text", readOnly: true },
      { name: "bienvenue", kind: "text", readOnly: true },
      { name: "présentations", kind: "text" },
      { name: "faq", kind: "text", readOnly: true }
    ]
  },
  {
    name: "Jeu",
    channels: [
      { name: "discussion-générale", kind: "text" },
      { name: "progression-fft", kind: "text" },
      { name: "saison-en-cours", kind: "text" },
      { name: "duels", kind: "text" },
      { name: "classement", kind: "text" },
      { name: "palmarès", kind: "text" }
    ]
  },
  {
    name: "Clubs",
    channels: [
      { name: "recrutement-clubs", kind: "text" },
      { name: "présidents-de-club", kind: "text", presidentOnly: true },
      { name: "championnat-par-équipe", kind: "text" },
      { name: "marché-des-joueurs", kind: "text" }
    ]
  },
  {
    name: "Support et retours",
    channels: [
      { name: "bugs", kind: "text" },
      { name: "suggestions", kind: "text" },
      { name: "équilibrage", kind: "text" },
      { name: "aide", kind: "text" }
    ]
  },
  {
    name: "Développement",
    channels: [
      { name: "journal-des-mises-à-jour", kind: "text", readOnly: true },
      { name: "feuille-de-route", kind: "text", readOnly: true },
      { name: "votes-communauté", kind: "text" }
    ]
  },
  {
    name: "Vocal",
    channels: [
      { name: "Club-house", kind: "voice" },
      { name: "Duel en direct", kind: "voice" },
      { name: "Réunion de club", kind: "voice" },
      { name: "Support vocal", kind: "voice" }
    ]
  }
];

const pinnedMessages = {
  annonces: `Bienvenue dans les annonces officielles de MYPRO - TENNIS.

Les nouvelles versions, équilibrages, maintenances et grands changements seront publiés ici.`,
  règles: `# Règles MYPRO - TENNIS

1. Respect entre joueurs.
2. Pas d'insultes, harcèlement ou provocation personnelle.
3. Pas de spam.
4. Les bugs doivent être signalés proprement avec du contexte.
5. Les suggestions doivent rester constructives.
6. Aucun partage de données privées.
7. Pas de publicité sans accord de Kilim Games.
8. Les décisions de modération visent à protéger la communauté.`,
  bienvenue: `Bienvenue sur MYPRO - TENNIS.

Commencez par lire #règles, puis présentez-vous dans #présentations.
Vous pouvez ensuite rejoindre les salons de jeu, chercher un club, proposer une idée ou signaler un bug.`,
  présentations: `Présentez-vous avec ce format :

Pseudo :
Nom du joueur MYPRO :
Classement actuel :
Club actuel :
Objectif de saison :
Ce que vous aimez dans le jeu :`,
  faq: `# FAQ MYPRO - TENNIS

- Le jeu est jouable sur navigateur et PWA.
- Le Discord sert aux échanges communautaires, bugs, suggestions, clubs et annonces.
- Ne partagez jamais votre mot de passe ou données privées.`,
  bugs: `Merci de signaler un bug avec le format suivant :

Plateforme :
Page concernée :
Compte / joueur :
Ce qui s'est passé :
Ce qui était attendu :
Capture si possible :`,
  suggestions: `Proposez vos idées avec ce format :

Sujet :
Problème ou envie :
Solution proposée :
Impact gameplay :
Priorité ressentie :`,
  "recrutement-clubs": `Présidents et joueurs peuvent utiliser ce salon pour recruter, postuler et présenter leur projet de club.`,
  duels: `Organisez vos duels ici : classement, disponibilité, objectif et lien vers votre profil si besoin.`,
  "journal-des-mises-à-jour": `Journal officiel des mises à jour MYPRO - TENNIS.`
};

function hexColor(value) {
  return Number.parseInt(value.replace("#", ""), 16);
}

function permission(value) {
  return value.toString();
}

async function discord(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (response.status === 429) {
    const retryAfter = Math.ceil((payload?.retry_after ?? 2) * 1000);
    console.log(`Limite Discord atteinte, reprise dans ${Math.ceil(retryAfter / 1000)}s...`);
    await new Promise((resolve) => setTimeout(resolve, retryAfter + 500));
    return discord(path, options);
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function ensureRole(roleDefinitions) {
  const existingRoles = await discord(`/guilds/${guildId}/roles`);
  const byName = new Map(existingRoles.map((role) => [role.name, role]));
  const result = new Map();

  for (const role of roleDefinitions) {
    const existing = byName.get(role.name);
    if (existing) {
      result.set(role.name, existing);
      console.log(`Role existant : ${role.name}`);
      continue;
    }
    const created = await discord(`/guilds/${guildId}/roles`, {
      method: "POST",
      body: JSON.stringify({
        name: role.name,
        color: hexColor(role.color),
        permissions: permission(role.permissions),
        mentionable: false,
        hoist: role.name === "Kilim Games"
      })
    });
    result.set(role.name, created);
    console.log(`Role créé : ${role.name}`);
  }
  return result;
}

async function ensureChannel(name, type, parentId, overwrites = []) {
  const existingChannels = await discord(`/guilds/${guildId}/channels`);
  const existing = existingChannels.find((channel) => channel.name === name && channel.type === type);
  if (existing) {
    const patch = {};
    if (parentId && existing.parent_id !== parentId) patch.parent_id = parentId;
    if (overwrites.length) patch.permission_overwrites = overwrites;
    if (Object.keys(patch).length) {
      await discord(`/channels/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
    }
    console.log(`Salon existant : ${name}`);
    return existing;
  }
  const created = await discord(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name,
      type,
      parent_id: parentId,
      permission_overwrites: overwrites
    })
  });
  console.log(`Salon créé : ${name}`);
  return created;
}

async function createPermanentInvite(channel) {
  if (!channel || channel.type !== 0) return null;
  const invite = await discord(`/channels/${channel.id}/invites`, {
    method: "POST",
    body: JSON.stringify({
      max_age: 0,
      max_uses: 0,
      temporary: false,
      unique: false,
      reason: "Invitation permanente MYPRO - TENNIS"
    })
  });
  return `https://discord.gg/${invite.code}`;
}

function readOnlyOverwrites() {
  return [
    {
      id: guildId,
      type: 0,
      deny: permission(PERMISSIONS.SEND_MESSAGES)
    }
  ];
}

function presidentOnlyOverwrites(roleMap) {
  const allowedRoles = [
    roleMap.get("Kilim Games"),
    roleMap.get("Administrateur"),
    roleMap.get("Modérateur"),
    roleMap.get("Président de club")
  ].filter(Boolean);
  return [
    {
      id: guildId,
      type: 0,
      deny: permission(PERMISSIONS.VIEW_CHANNEL)
    },
    ...allowedRoles.map((role) => ({
      id: role.id,
      type: 0,
      allow: permission(PERMISSIONS.VIEW_CHANNEL | PERMISSIONS.SEND_MESSAGES)
    }))
  ];
}

async function ensurePinnedMessage(channel, content) {
  if (!content || channel.type !== 0) return;
  const messages = await discord(`/channels/${channel.id}/messages?limit=50`);
  const alreadyPosted = messages.some((message) => message.content.includes(content.slice(0, 40)));
  if (alreadyPosted) {
    console.log(`Message déjà présent : #${channel.name}`);
    return;
  }
  const message = await discord(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content })
  });
  await discord(`/channels/${channel.id}/pins/${message.id}`, { method: "PUT" }).catch(() => null);
  console.log(`Message épinglé : #${channel.name}`);
}

async function main() {
  const me = await discord("/users/@me");
  console.log(`Bot connecté : ${me.username}`);

  const roleMap = await ensureRole(roles);
  const channelMap = new Map();

  for (const category of categories) {
    const categoryChannel = await ensureChannel(category.name, 4, null);
    for (const channel of category.channels) {
      const type = channel.kind === "voice" ? 2 : 0;
      const overwrites = channel.presidentOnly
        ? presidentOnlyOverwrites(roleMap)
        : channel.readOnly
          ? readOnlyOverwrites()
          : [];
      const created = await ensureChannel(channel.name, type, categoryChannel.id, overwrites);
      channelMap.set(channel.name, created);
    }
  }

  for (const [channelName, content] of Object.entries(pinnedMessages)) {
    const channel = channelMap.get(channelName);
    if (channel) await ensurePinnedMessage(channel, content);
  }

  const inviteChannel =
    channelMap.get("bienvenue") ??
    channelMap.get("discussion-générale") ??
    [...channelMap.values()].find((channel) => channel.type === 0);
  const inviteUrl = await createPermanentInvite(inviteChannel);

  console.log("Configuration Discord terminée.");
  if (inviteUrl) {
    console.log(`Invitation permanente : ${inviteUrl}`);
    console.log("Ajoute cette URL dans VITE_DISCORD_INVITE_URL sur Netlify et dans .env si tu veux le bouton local.");
  }
  console.log("À faire manuellement dans Discord : activer/ajuster l'onboarding communautaire avec les questions du fichier docs/community-discord.md.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
