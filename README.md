# MYPRO - TENNIS

MYPRO - TENNIS est un MVP jouable de jeu navigateur et PWA de gestion de carrière de tennis. Le projet pose un socle réutilisable pour les futures déclinaisons MyPro : Football, Basketball, Rugby, Cycling et Motorsport.

L'univers sportif est entièrement fictif : joueurs, tournois, lieux, classements et rivalités ne reprennent aucun nom officiel de circuits ou compétitions réels.

## Fonctionnalités MVP

- Landing page premium en français.
- Inscription, connexion JWT et compte démo.
- Création de joueur avec archétypes.
- Parcours amateur FFT : départ à 12 ans, classement `15/1`, progression jusqu'à validation de `-15`.
- Énergie de carrière : 10 points maximum, recharge de 1 point toutes les 30 minutes, 1 point consommé par action.
- Tableau de bord de carrière, statistiques, jauges et crédits de jeu.
- Entraînements à durée réelle, calculés côté serveur.
- Infrastructures améliorables.
- Staff recrutable.
- Match contre IA, calculé point par point côté serveur.
- Replay 2D du match avec court, avatars, balle, score, momentum et fil d'actions.
- Historique des matchs.
- Classement mondial fictif Top 100.
- Trois tournois fictifs actifs avec tableau.
- Présence en ligne Socket.IO.
- Défis PvP asynchrones côté serveur.
- PWA installable avec mode hors ligne partiel.
- Seed de démonstration.

## Architecture

```text
apps/
  mypro-tennis-web/      Application React, Vite, PWA
  mypro-tennis-server/   API Express, Socket.IO, JWT
packages/
  core/                  Formules communes, progression, classement
  auth/                  Sessions JWT
  economy/               Transactions et économie partagée
  database/              Client Prisma
  realtime/              Présence et types temps réel
  notifications/         Types et helpers notifications
  ui/                    Primitives UI partagées
  shared/                Schémas Zod partagés
  sports-tennis/         Données, stats, entraînements, tournois tennis
  match-engine-tennis/   Moteur tennis déterministe et tests
prisma/
  schema.prisma
  migrations/
  seed.ts
```

Les systèmes mutualisables sont séparés des règles propres au tennis. Le moteur de match ne dépend ni de React ni d'Express.

## Prérequis

- Node.js 20 ou plus récent.
- npm 10 ou plus récent.

## Installation

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
```

Sous Windows PowerShell, créez `.env` à partir de `.env.example` avec votre méthode habituelle si `cp` n'est pas disponible.

## Lancement local

```bash
npm run dev
```

- Frontend : `http://localhost:5173`
- Backend : `http://localhost:4000`
- Santé API : `http://localhost:4000/health`

Lancement séparé :

```bash
npm run dev:server
npm run dev:web
```

## Compte démo

Email :

```text
demo@mypro-tennis.local
```

Mot de passe :

```text
demo1234
```

Le seed crée aussi au moins 30 joueurs IA, un rival principal, des matchs historiques, trois tournois, quelques clubs de démonstration, du staff de départ et des infrastructures.

## Parcours De Carrière

Le joueur commence en amateur à 12 ans avec le classement FFT `15/1`.

La progression amateur suit les échelons FFT depuis `15/1` jusqu'à `-15`, avec les nouveaux échelons bas prévus dans le modèle (`40/2`, `40/1`, `40`, `30/5`, etc.) pour les futures créations de joueurs débutants.

En amateur, le seul moyen de monter est de gagner des matchs officiels homologués. Le serveur enregistre un palmarès `FftResult`, recalcule les points de victoire selon l'écart entre l'échelon visé et le classement de l'adversaire, applique la logique V-E-2I-5G, puis valide ou non le nouvel échelon avec les normes de points et de victoires retenues.

Une saison sportive dure 30 jours réels dans MyPro - Tennis. Elle est globale : elle commence et se termine au même moment pour tous les joueurs, indépendamment de la date de création du compte. Le recalcul du classement du joueur ne tient compte que des résultats de cette saison active. Le circuit professionnel reste verrouillé tant que le classement `-15` n'est pas validé.

La date de départ de la première saison globale est configurable côté serveur avec `MYPRO_SEASON_START_AT`. Par défaut, elle correspond au 1er juillet 2026 à 00h00 heure de Paris.

## Saison En Cours

L'ancien onglet Tournois est remplacé par `Saison en cours`. Une saison dure 30 jours réels, synchronisés pour toute la communauté, et propose trois compétitions simultanément accessibles :

- Tournoi journalier : 1 fois par jour, tableau de 16 joueurs, coût de 1 point d'énergie.
- Tournoi hebdomadaire : 1 fois par semaine, tableau de 16 joueurs, coût de 2 points d'énergie.
- Championnat individuel : 1 fois par saison, coût de 3 points d'énergie, parcours pyramidal FFT du classement du joueur jusqu'à `-15`.

Les bornes de tableau sont calculées côté serveur à partir du classement FFT du joueur. Le tournoi journalier va jusqu'à +2 rangs meilleurs et -2 rangs moins bons, borné de `15/1` à `-15`. Le tournoi hebdomadaire va jusqu'à +3 rangs meilleurs et -2 rangs moins bons. Le championnat individuel avance rang par rang jusqu'à `-15`; une défaite élimine, une victoire à `-15` donne le titre de champion national amateur.

La difficulté des matchs dépend du classement FFT de l'adversaire et d'un niveau général cohérent avec ce rang. Plus le joueur monte dans la pyramide, plus les statistiques adverses progressent.

## Clubs

La page Club permet de signer dans un club pour la saison. Le seed contient quelques clubs fictifs/démo. Pour charger un export complet de clubs FFT, préparer un CSV avec les colonnes `fftCode`, `name`, `city`, `league`, `department`, `postalCode`, puis lancer :

```bash
npm run clubs:import -- chemin/vers/clubs.csv
```

Le championnat par équipes apparaît dans le calendrier sous forme de cinq journées de saison, avec les phases Mars, Avril, Mai, Juin et Juillet compressées dans les 30 jours réels de la saison MyPro. L'orchestration avancée des équipes, compositions, feuilles de match et rencontres club contre club reste la prochaine étape serveur.

## Énergie Et Progression Longue Durée

Chaque joueur dispose de 10 points d'énergie de carrière.

- Les actions courantes coûtent 1 point ; les compétitions de saison peuvent coûter 1, 2 ou 3 points selon leur importance.
- 1 point revient toutes les 30 minutes.
- Les entraînements, matchs, recrutements de staff et améliorations d'infrastructures sont contrôlés côté serveur.
- Les coûts et durées augmentent avec la puissance de développement du joueur ou le niveau de l'infrastructure, dans une logique de progression longue durée inspirée des jeux de stratégie persistants.

## Base de données

Le développement local utilise SQLite :

```env
DATABASE_URL="file:./dev.db"
```

La production est prévue pour PostgreSQL. Le passage en production demandera de changer le provider Prisma et la variable `DATABASE_URL`.

Commandes utiles :

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run clubs:import -- chemin/vers/clubs.csv
```

## API

Routes principales :

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/players`
- `POST /api/players`
- `GET /api/training`
- `POST /api/training/start`
- `POST /api/training/:id/complete`
- `GET /api/facilities`
- `POST /api/facilities/:facilityId/upgrade`
- `GET /api/staff`
- `POST /api/staff/hire/:name`
- `GET /api/matches`
- `GET /api/matches/:id`
- `POST /api/matches/quick`
- `GET /api/tournaments`
- `GET /api/rankings`
- `POST /api/challenges`
- `GET /api/notifications`
- `GET /api/calendar`

Toutes les actions sensibles passent par JWT. Les données importantes sont validées avec Zod. Les statistiques, progressions et résultats de match sont calculés côté serveur.

## Tests

```bash
npm test
```

Les tests Vitest couvrent :

- score tennis ;
- tie-break ;
- victoire de set et de match ;
- effet de la fatigue ;
- effet de la surface ;
- effet du service ;
- déterminisme avec une seed ;
- progression FFT amateur ;
- calcul des points de victoire par écart de classement ;
- validations importantes.

## PWA

## Communauté Discord

La page `/community` prépare le lien vers le Discord officiel MYPRO - TENNIS.

Configuration :

```env
VITE_DISCORD_INVITE_URL="https://discord.gg/..."
```

Le plan complet du serveur est documenté dans `docs/community-discord.md`.
Un template structuré est disponible dans `docs/discord-server-template.json`.

La PWA est configurée avec `vite-plugin-pwa`. Elle fournit :

- manifeste ;
- icône MYPRO ;
- cache des ressources ;
- page hors ligne ;
- message clair pour les fonctions multijoueurs nécessitant Internet.

## Prochaines évolutions

- Orchestration complète des compositions et feuilles de match du championnat par équipes.
- Import d'un export officiel complet des clubs FFT quand la source de données autorisée est fournie.
- PvP live et spectateurs.
- Marché avancé du staff.
- Sponsors dynamiques.
- Blessures détaillées et plan médical.
- Administration du monde persistant.
- Adaptation du socle à MyPro - Football, Basketball, Rugby, Cycling et Motorsport.
