import "dotenv/config";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const token = process.env.DISCORD_BOT_TOKEN?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();
const apiBase = "https://discord.com/api/v10";
const forumName = "tutoriel";

if (!token || !guildId) {
  throw new Error("DISCORD_BOT_TOKEN et DISCORD_GUILD_ID doivent être renseignés dans .env.");
}

const PERMISSIONS = {
  ADD_REACTIONS: 1n << 6n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n
};

const tutorialTags = [
  { name: "Premiers pas", emoji_name: "👋" },
  { name: "Compte", emoji_name: "👤" },
  { name: "Mon joueur", emoji_name: "🎾" },
  { name: "Duel", emoji_name: "⚔️" },
  { name: "Club", emoji_name: "🏆" },
  { name: "Boutique", emoji_name: "💎" }
];

async function discord(path, options = {}) {
  const multipart = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      ...(multipart ? {} : { "Content-Type": "application/json; charset=utf-8" }),
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (response.status === 429) {
    const retryAfter = Math.ceil((payload?.retry_after ?? 2) * 1000);
    await new Promise((resolveRetry) => setTimeout(resolveRetry, retryAfter + 250));
    return discord(path, options);
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function permission(value) {
  return value.toString();
}

function mergeEveryonePermissions(overwrites) {
  const managedMask =
    PERMISSIONS.ADD_REACTIONS |
    PERMISSIONS.VIEW_CHANNEL |
    PERMISSIONS.SEND_MESSAGES |
    PERMISSIONS.READ_MESSAGE_HISTORY |
    PERMISSIONS.CREATE_PUBLIC_THREADS |
    PERMISSIONS.CREATE_PRIVATE_THREADS |
    PERMISSIONS.SEND_MESSAGES_IN_THREADS;
  const existing = overwrites.find((overwrite) => overwrite.id === guildId && overwrite.type === 0);
  const allow =
    (BigInt(existing?.allow ?? 0) & ~managedMask) |
    PERMISSIONS.ADD_REACTIONS |
    PERMISSIONS.VIEW_CHANNEL |
    PERMISSIONS.READ_MESSAGE_HISTORY |
    PERMISSIONS.SEND_MESSAGES_IN_THREADS;
  const deny =
    (BigInt(existing?.deny ?? 0) & ~managedMask) |
    PERMISSIONS.SEND_MESSAGES |
    PERMISSIONS.CREATE_PUBLIC_THREADS |
    PERMISSIONS.CREATE_PRIVATE_THREADS;
  return [
    ...overwrites.filter((overwrite) => !(overwrite.id === guildId && overwrite.type === 0)),
    {
      id: guildId,
      type: 0,
      allow: permission(allow),
      deny: permission(deny)
    }
  ];
}

function mergeTags(existingTags) {
  const byName = new Map(existingTags.map((tag) => [tag.name.toLocaleLowerCase("fr"), tag]));
  return [
    ...existingTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      moderated: Boolean(tag.moderated),
      emoji_id: tag.emoji_id ?? null,
      emoji_name: tag.emoji_name ?? null
    })),
    ...tutorialTags
      .filter((tag) => !byName.has(tag.name.toLocaleLowerCase("fr")))
      .map((tag) => ({
        name: tag.name,
        moderated: false,
        emoji_id: null,
        emoji_name: tag.emoji_name
      }))
  ];
}

async function getTutorialForum() {
  const channels = await discord(`/guilds/${guildId}/channels`);
  const forum = channels.find((channel) => channel.name === forumName && channel.type === 15);
  if (!forum) {
    throw new Error(`Le salon forum « ${forumName} » est introuvable.`);
  }
  return forum;
}

async function configureForum() {
  const forum = await getTutorialForum();
  const configured = await discord(`/channels/${forum.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      topic:
        "Guides officiels MYPRO TENNIS. Consultez les étapes illustrées et posez vos questions dans le tutoriel correspondant.",
      default_auto_archive_duration: 10080,
      default_thread_rate_limit_per_user: 5,
      default_sort_order: 0,
      default_forum_layout: 1,
      default_reaction_emoji: { emoji_name: "✅" },
      available_tags: mergeTags(forum.available_tags ?? []),
      permission_overwrites: mergeEveryonePermissions(forum.permission_overwrites ?? [])
    })
  });
  console.log(`Forum configuré : #${configured.name} (${configured.id}).`);
  return configured;
}

async function findExistingTutorial(forumId, title) {
  const active = await discord(`/guilds/${guildId}/threads/active`);
  const activeThread = (active.threads ?? []).find(
    (thread) => thread.parent_id === forumId && thread.name === title
  );
  if (activeThread) return activeThread;

  const archived = await discord(`/channels/${forumId}/threads/archived/public?limit=100`);
  return (archived.threads ?? []).find((thread) => thread.name === title) ?? null;
}

async function publishCreateAccountTutorial(forum) {
  const title = "Créer un compte utilisateur";
  const existing = await findExistingTutorial(forum.id, title);
  if (existing) {
    console.log(`Tutoriel déjà présent : ${title} (${existing.id}).`);
    return existing;
  }

  const imagePaths = [
    resolve("docs/discord/tutorials/creer-compte-01-commencer.png"),
    resolve("docs/discord/tutorials/creer-compte-02-formulaire.png")
  ];
  const images = await Promise.all(imagePaths.map((imagePath) => readFile(imagePath)));
  const tags = new Map((forum.available_tags ?? []).map((tag) => [tag.name, tag.id]));

  const payload = {
    name: title,
    auto_archive_duration: 10080,
    rate_limit_per_user: 5,
    applied_tags: [tags.get("Premiers pas"), tags.get("Compte")].filter(Boolean),
    message: {
      content:
        "📘 **Tutoriel officiel MYPRO TENNIS**\nSuivez ces étapes pour créer votre compte et démarrer votre première carrière.",
      allowed_mentions: { parse: [] },
      attachments: imagePaths.map((imagePath, index) => ({
        id: index,
        filename: basename(imagePath),
        description: `Étape ${index + 1} du tutoriel de création de compte MYPRO TENNIS`
      })),
      embeds: [
        {
          title: "Étape 1 — Ouvrir l’inscription",
          description:
            "1. Rendez-vous sur **https://my-pro-tennis.netlify.app**.\n2. Sélectionnez **Commencer l’aventure**.\n3. L’écran **Créer votre compte joueur** s’ouvre.",
          color: 0x43e5b0,
          image: { url: `attachment://${basename(imagePaths[0])}` }
        },
        {
          title: "Étape 2 — Créer votre compte",
          description:
            "Vous pouvez utiliser votre adresse e-mail ou Google.\n\n**Avec une adresse e-mail :**\n• choisissez un nom affiché de 2 à 40 caractères ;\n• indiquez une adresse e-mail valide ;\n• choisissez un mot de passe d’au moins 8 caractères ;\n• appuyez sur **Démarrer ma carrière**.\n\n**Avec Google :** appuyez sur **Créer mon compte avec Google**, puis suivez la fenêtre de connexion.",
          color: 0x43e5b0,
          image: { url: `attachment://${basename(imagePaths[1])}` }
        },
        {
          title: "Étape 3 — Créer votre joueur",
          description:
            "Après l’inscription, le jeu vous conduit vers la création de votre joueur. Choisissez son identité, sa main dominante, son revers, son archétype et son portrait.\n\n⚠️ Utilisez une adresse e-mail à laquelle vous avez accès et ne communiquez jamais votre mot de passe.",
          color: 0x43e5b0,
          footer: { text: "MYPRO TENNIS • Tutoriel officiel" }
        }
      ]
    }
  };

  const body = new FormData();
  body.append("payload_json", JSON.stringify(payload));
  images.forEach((image, index) => {
    body.append(`files[${index}]`, new Blob([image]), basename(imagePaths[index]));
  });

  const thread = await discord(`/channels/${forum.id}/threads`, {
    method: "POST",
    body
  });
  console.log(`Tutoriel publié : ${thread.name} (${thread.id}).`);
  return thread;
}

async function publishGettingStartedTutorial(forum) {
  const title = "Comment bien débuter";
  const existing = await findExistingTutorial(forum.id, title);
  if (existing) {
    console.log(`Tutoriel déjà présent : ${title} (${existing.id}).`);
    return existing;
  }

  const imagePaths = [
    resolve("docs/discord/tutorials/bien-debuter-01-hub.png"),
    resolve("docs/discord/tutorials/bien-debuter-02-collection.png"),
    resolve("docs/discord/tutorials/bien-debuter-03-competences.png"),
    resolve("docs/discord/tutorials/bien-debuter-04-duel.png"),
    resolve("docs/discord/tutorials/bien-debuter-05-saison.png"),
    resolve("docs/discord/tutorials/bien-debuter-06-club.png")
  ];
  const images = await Promise.all(imagePaths.map((imagePath) => readFile(imagePath)));
  const tags = new Map((forum.available_tags ?? []).map((tag) => [tag.name, tag.id]));
  const imageUrl = (index) => `attachment://${basename(imagePaths[index])}`;

  const payload = {
    name: title,
    auto_archive_duration: 10080,
    rate_limit_per_user: 5,
    applied_tags: [
      tags.get("Premiers pas"),
      tags.get("Mon joueur"),
      tags.get("Duel"),
      tags.get("Club")
    ].filter(Boolean),
    message: {
      content:
        "🎾 **Guide officiel MYPRO TENNIS**\nVoici le parcours conseillé pour construire une carrière solide dès vos premiers jours.",
      allowed_mentions: { parse: [] },
      attachments: imagePaths.map((imagePath, index) => ({
        id: index,
        filename: basename(imagePath),
        description: `Illustration ${index + 1} du guide Comment bien débuter sur MYPRO TENNIS`
      })),
      embeds: [
        {
          title: "1 — Commencez par le Hub",
          description:
            "Le Hub résume votre carrière. À chaque connexion :\n• récupérez la **récompense du jour** ;\n• vérifiez votre énergie, vos crédits et vos gemmes ;\n• regardez les sacs prêts à ouvrir ;\n• repérez vos points de compétence disponibles.\n\n💡 **Tip :** l’énergie revient normalement à raison de **1 point toutes les 30 minutes**, jusqu’à 10. Utilisez-en régulièrement pour éviter de rester bloqué au maximum.",
          color: 0x43e5b0,
          image: { url: imageUrl(0) }
        },
        {
          title: "2 — Équipez votre joueur dans Collection",
          description:
            "Les sacs donnent des objets et des cartes de statistiques. Équipez jusqu’à **4 objets**, améliorez ceux que vous utilisez et consultez **Détails** pour voir tous leurs bonus. Les cartes de statistiques apportent une progression permanente.\n\n💡 **Tip :** ne regardez pas seulement la rareté. Un objet qui renforce une faiblesse importante peut être plus utile qu’un bonus supplémentaire dans votre meilleure statistique.",
          color: 0x43e5b0,
          image: { url: imageUrl(1) }
        },
        {
          title: "3 — Dépensez vos points de compétence",
          description:
            "Chaque montée de niveau permet de faire progresser vos **12 statistiques**. Votre note globale correspond à leur moyenne. Les paliers de carrière débloquent aussi des bonus passifs liés à votre archétype.\n\n💡 **Tip :** construisez une identité forte, mais ne négligez pas le retour, l’endurance et la récupération. Un joueur très puissant avec une grosse faiblesse devient facile à cibler.",
          color: 0x43e5b0,
          image: { url: imageUrl(2) }
        },
        {
          title: "4 — Choisissez intelligemment vos Duels",
          description:
            "Le jeu propose des adversaires proches de votre note globale. Comparez leurs 12 statistiques et choisissez le mode :\n• **Coach Deck** pour jouer vos cartes et intervenir ;\n• **Automatique** pour regarder le match point par point ;\n• **Résultat rapide** pour obtenir immédiatement le score.\n\nUn duel coûte **1 énergie**. Vérifiez que votre Coach Deck contient bien 12 cartes.\n\n💡 **Tip :** ciblez la faiblesse adverse avec votre point fort et évitez de dépenser toutes vos ressources de coaching trop tôt.",
          color: 0x43e5b0,
          image: { url: imageUrl(3) }
        },
        {
          title: "5 — Inscrivez-vous aux compétitions de Saison",
          description:
            "Ouvrez **Saison en cours**, choisissez une compétition puis vérifiez les conditions affichées en vert.\n• Tournoi journalier : **1 énergie**, une fois par jour ;\n• Tournoi hebdomadaire : **2 énergies**, une fois par semaine ;\n• Championnat individuel : **3 énergies**, une fois par saison.\n\nDes frais d’inscription en crédits s’ajoutent selon votre classement. Une défaite élimine du tableau.\n\n💡 **Tip :** commencez par le tournoi journalier. Gardez toujours assez d’énergie et de crédits pour l’inscription avant de lancer vos autres matchs.",
          color: 0x43e5b0,
          image: { url: imageUrl(4) }
        },
        {
          title: "6 — Rejoignez un Club",
          description:
            "Dans **Mon Club**, filtrez les structures ayant des places et acceptant votre classement, puis envoyez une demande. Le président doit la valider. Créer son propre club coûte **5 000 crédits**.\n\nLes clubs donnent accès au championnat par équipes et à des infrastructures : le centre de soins accélère le retour de l’énergie et le centre d’entraînement améliore les chances de sacs non-Bronze.\n\n💡 **Tip :** rejoignez d’abord un club actif avec un objectif adapté à votre classement. Consultez le calendrier, payez la cotisation demandée et restez disponible pour la composition d’équipe.",
          color: 0x43e5b0,
          image: { url: imageUrl(5) }
        },
        {
          title: "La routine conseillée",
          description:
            "✅ Récupérer la récompense quotidienne\n✅ Ouvrir les sacs et contrôler l’équipement\n✅ Dépenser les points de compétence\n✅ Jouer un duel adapté à votre note\n✅ S’inscrire au tournoi disponible\n✅ Vérifier les activités et le calendrier du club\n\nGardez quelques crédits pour les inscriptions et améliorations utiles. La progression la plus régulière est souvent plus efficace qu’une dépense immédiate de toutes vos ressources.",
          color: 0xf2c94c,
          footer: { text: "MYPRO TENNIS • Guide officiel pour bien débuter" }
        }
      ]
    }
  };

  const body = new FormData();
  body.append("payload_json", JSON.stringify(payload));
  images.forEach((image, index) => {
    body.append(`files[${index}]`, new Blob([image]), basename(imagePaths[index]));
  });

  const thread = await discord(`/channels/${forum.id}/threads`, {
    method: "POST",
    body
  });
  console.log(`Tutoriel publié : ${thread.name} (${thread.id}).`);
  return thread;
}

async function verifyTutorial(thread, expectedEmbeds, expectedImages) {
  const messages = await discord(`/channels/${thread.id}/messages?limit=10`);
  const starter = messages.find((message) => message.id === thread.id) ?? messages.at(-1);
  const illustratedSteps = starter?.embeds?.filter((embed) => embed.image?.url).length ?? 0;
  console.log(
    `Contrôle Discord : ${messages.length} message(s), ${starter?.embeds?.length ?? 0} encadré(s), ${illustratedSteps} capture(s) intégrée(s).`
  );
  if (
    !starter ||
    illustratedSteps < expectedImages ||
    (starter.embeds?.length ?? 0) < expectedEmbeds
  ) {
    throw new Error("Le tutoriel existe, mais ses captures ou ses étapes sont incomplètes.");
  }
  console.log(
    `Tutoriel vérifié : ${starter.embeds.length} étapes et ${illustratedSteps} captures.`
  );
}

const forum = await configureForum();
const accountTutorial = await publishCreateAccountTutorial(forum);
await verifyTutorial(accountTutorial, 3, 2);
const gettingStartedTutorial = await publishGettingStartedTutorial(forum);
await verifyTutorial(gettingStartedTutorial, 7, 6);
