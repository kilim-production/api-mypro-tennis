# Discord communautaire MYPRO - TENNIS

Ce document définit le serveur Discord officiel de MYPRO - TENNIS. Il sert de cahier de création complet pour créer le serveur depuis le compte Kilim Games Production.

## Identité du serveur

Nom :

```text
MYPRO - TENNIS
```

Description :

```text
Communauté officielle de MYPRO - TENNIS, jeu navigateur et PWA de carrière tennis. Discutez clubs, duels, saisons, mises à jour, bugs et suggestions.
```

Ton :

- premium ;
- sportif ;
- clair ;
- bienveillant ;
- orienté progression et compétition saine.

## Rôles

Créer les rôles dans cet ordre :

1. `Kilim Games`
2. `Administrateur`
3. `Modérateur`
4. `Support`
5. `Testeur`
6. `Créateur de contenu`
7. `Président de club`
8. `Joueur`
9. `Nouveau`

Couleurs recommandées :

- `Kilim Games` : vert premium `#34D399`
- `Administrateur` : rouge profond `#EF4444`
- `Modérateur` : bleu `#38BDF8`
- `Support` : violet `#A78BFA`
- `Testeur` : jaune `#FACC15`
- `Créateur de contenu` : rose `#F472B6`
- `Président de club` : cyan `#22D3EE`
- `Joueur` : blanc cassé `#E5E7EB`
- `Nouveau` : gris `#94A3B8`

## Catégories et salons

### 1. Accueil

- `#annonces`
- `#règles`
- `#bienvenue`
- `#présentations`
- `#faq`

Permissions :

- `#annonces` : écriture Kilim Games, Administrateur, Modérateur uniquement.
- `#règles` : lecture uniquement pour tous.
- `#bienvenue` : lecture uniquement, messages automatiques.
- `#présentations` : écriture Joueur et plus.
- `#faq` : lecture uniquement pour tous.

### 2. Jeu

- `#discussion-générale`
- `#progression-fft`
- `#saison-en-cours`
- `#duels`
- `#classement`
- `#palmarès`

Objectif :

- échanges de gameplay ;
- suivi de progression ;
- recherche de duels ;
- discussions autour du classement.

### 3. Clubs

- `#recrutement-clubs`
- `#présidents-de-club`
- `#championnat-par-équipe`
- `#marché-des-joueurs`

Permissions :

- `#présidents-de-club` : visible pour `Président de club`, Modérateur et Kilim Games.
- Les autres salons sont visibles par tous les joueurs.

### 4. Support et retours

- `#bugs`
- `#suggestions`
- `#équilibrage`
- `#aide`

Format conseillé pour `#bugs` :

```text
Plateforme :
Page concernée :
Compte / joueur :
Ce qui s'est passé :
Ce qui était attendu :
Capture si possible :
```

Format conseillé pour `#suggestions` :

```text
Sujet :
Problème ou envie :
Solution proposée :
Impact gameplay :
Priorité ressentie :
```

### 5. Développement

- `#journal-des-mises-à-jour`
- `#feuille-de-route`
- `#votes-communauté`

Permissions :

- `#journal-des-mises-à-jour` : écriture Kilim Games uniquement.
- `#feuille-de-route` : lecture pour tous, écriture Kilim Games.
- `#votes-communauté` : réactions et sondages ouverts aux joueurs.

### 6. Vocal

- `Club-house`
- `Duel en direct`
- `Réunion de club`
- `Support vocal`

## Parcours nouveaux arrivants

Objectif : transformer un nouveau membre Discord en joueur communautaire actif.

### Étape 1 : Arrivée

Message automatique dans `#bienvenue` :

```text
Bienvenue sur MYPRO - TENNIS.

Commencez par lire #règles, puis présentez-vous dans #présentations.
Vous pouvez ensuite rejoindre les salons de jeu, chercher un club, proposer une idée ou signaler un bug.
```

### Étape 2 : Règles

Le nouveau membre lit `#règles`.

Règles recommandées :

1. Respect entre joueurs.
2. Pas d'insultes, harcèlement ou provocation personnelle.
3. Pas de spam.
4. Les bugs doivent être signalés proprement avec du contexte.
5. Les suggestions doivent rester constructives.
6. Aucun partage de données privées.
7. Pas de publicité sans accord de Kilim Games.
8. Les décisions de modération visent à protéger la communauté.

### Étape 3 : Rôle

Rôles à proposer dans l'onboarding Discord :

- `Joueur`
- `Président de club`
- `Testeur`
- `Créateur de contenu`

Questions d'onboarding :

```text
Quel est votre profil ?
- Joueur
- Président de club
- Testeur
- Créateur de contenu
```

```text
Que voulez-vous suivre en priorité ?
- Mises à jour
- Clubs
- Duels
- Bugs et support
- Suggestions
```

### Étape 4 : Présentation

Message épinglé dans `#présentations` :

```text
Présentez-vous avec ce format :

Pseudo :
Nom du joueur MYPRO :
Classement actuel :
Club actuel :
Objectif de saison :
Ce que vous aimez dans le jeu :
```

### Étape 5 : Orientation

Message épinglé dans `#bienvenue` :

```text
Où aller maintenant ?

- Chercher un club : #recrutement-clubs
- Organiser un duel : #duels
- Voir les nouveautés : #journal-des-mises-à-jour
- Signaler un bug : #bugs
- Proposer une idée : #suggestions
- Parler classement : #progression-fft
```

## Messages à épingler

### `#annonces`

```text
Bienvenue dans les annonces officielles de MYPRO - TENNIS.
Les nouvelles versions, équilibrages, maintenances et grands changements seront publiés ici.
```

### `#bugs`

```text
Merci de signaler un bug avec le format suivant :

Plateforme :
Page concernée :
Compte / joueur :
Ce qui s'est passé :
Ce qui était attendu :
Capture si possible :
```

### `#suggestions`

```text
Proposez vos idées avec ce format :

Sujet :
Problème ou envie :
Solution proposée :
Impact gameplay :
Priorité ressentie :
```

## Configuration dans le jeu

Quand le serveur Discord est créé, générer une invitation permanente puis renseigner :

```env
VITE_DISCORD_INVITE_URL="https://discord.gg/..."
```

Sur Netlify :

1. Ouvrir le site Netlify du frontend.
2. Aller dans `Configuration du projet`.
3. Ouvrir `Environment variables`.
4. Ajouter `VITE_DISCORD_INVITE_URL`.
5. Relancer un déploiement.

## Création automatique avec un bot

Le projet contient un script local :

```bash
npm run discord:setup
```

Il crée automatiquement :

- rôles ;
- catégories ;
- salons texte ;
- salons vocaux ;
- permissions de base ;
- messages épinglés.

### Étapes Discord Developer Portal

1. Aller sur <https://discord.com/developers/applications>.
2. Cliquer sur `New Application`.
3. Nommer l'application :

```text
MYPRO Setup Bot
```

4. Aller dans `Bot`.
5. Cliquer sur `Add Bot`.
6. Réinitialiser ou copier le token du bot.
7. Ne jamais envoyer ce token dans un chat.
8. Dans `OAuth2 > URL Generator`, cocher :
   - `bot`
   - `applications.commands`
9. Permissions du bot :
   - `Administrator` pour l'installation initiale.
10. Ouvrir l'URL générée et inviter le bot sur `MYPRO - TENNIS`.

### Variables locales

Dans `.env`, ajouter :

```env
DISCORD_BOT_TOKEN="token-du-bot"
DISCORD_GUILD_ID="id-du-serveur"
```

Pour récupérer l'ID du serveur :

1. Discord > Paramètres utilisateur > Avancé.
2. Activer `Mode développeur`.
3. Clic droit sur le serveur `MYPRO - TENNIS`.
4. Cliquer sur `Copier l'identifiant du serveur`.

### Lancement

Une fois le bot invité :

```bash
npm run discord:setup
```

Après la création, il est conseillé de retirer la permission `Administrator` au bot ou de le retirer du serveur.

## Checklist de création dans Discord

1. Créer le serveur `MYPRO - TENNIS`.
2. Activer le mode communauté.
3. Créer les rôles.
4. Créer les catégories et salons.
5. Configurer les permissions.
6. Coller les messages épinglés.
7. Configurer le parcours d'accueil Discord.
8. Générer une invitation permanente.
9. Ajouter l'invitation dans Netlify.
10. Tester le bouton `Rejoindre le Discord` depuis la page Communauté du jeu.
