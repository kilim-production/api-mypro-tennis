# Deploiement de l'API MYPRO - TENNIS sur Render

Netlify sert uniquement l'application React. Pour le multijoueur web, il faut publier l'API Express + Socket.IO sur un hebergeur Node public. Ce projet est pret pour Render avec `render.yaml`.

La configuration recommandee utilise Render pour l'API et Neon pour PostgreSQL. Cela permet de garder les comptes, les joueurs, les matchs et les clubs meme si Render redeploie le serveur.

Le lancement local Windows reste en SQLite. Le serveur public Render utilise `prisma/schema.postgres.prisma`.

## 1. Preparer le depot

Render deploie depuis un depot Git. Poussez le projet complet sur GitHub, GitLab ou Bitbucket, puis creez un service depuis ce depot.

Le dossier a connecter est la racine du projet, pas `apps/mypro-tennis-server`, car l'API utilise aussi les packages partages, Prisma et le moteur de match.

## 2. Creer le service Render

Option recommandee : `New > Blueprint`, puis selectionnez le depot. Render lira `render.yaml`.

Sinon, creez un `Web Service` manuel avec :

```text
Runtime: Node
Build command: npm install --include=dev && npm run api:build
Start command: npm run api:start
Health check path: /health
```

Ne creez pas de disque persistant si vous voulez rester sur l'offre gratuite.

## 3. Creer la base Neon

Dans Neon :

1. Creez un compte sur `https://neon.tech`.
2. Creez un projet, par exemple `mypro-tennis`.
3. Ouvrez `Connection Details`.
4. Choisissez une connexion Node.js ou Prisma.
5. Copiez l'URL PostgreSQL.

Elle ressemble a ceci :

```text
postgresql://user:password@host.neon.tech/mypro-tennis?sslmode=require
```

Gardez cette URL privee. Elle sera collee dans Render comme variable `DATABASE_URL`.

## 4. Variables serveur

Dans Render, ajoutez :

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host.neon.tech/mypro-tennis?sslmode=require
JWT_SECRET=une-cle-longue-et-secrete
CLIENT_URL=https://votre-site-netlify.netlify.app
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://votre-api-render.onrender.com/api/auth/google/callback
```

Render fournit automatiquement `PORT`, donc il n'est pas necessaire de le renseigner.

`CLIENT_URL` accepte plusieurs URLs separees par des virgules :

```env
CLIENT_URL=https://votre-site.netlify.app,https://deploy-preview-1--votre-site.netlify.app
```

## 5. Initialiser la base la premiere fois

Au premier demarrage, `npm run api:start` synchronise automatiquement le schema Prisma PostgreSQL avec Neon.

Pour ajouter les donnees de demonstration, ouvrez le shell Render du service et lancez :

```text
npm run db:seed
```

Attention : le seed actuel remet les donnees de jeu a zero. Lancez-le seulement sur une base neuve, avant d'ouvrir le jeu aux vrais joueurs.

## 6. Verifier l'API

Quand le deploy est termine, ouvrez :

```text
https://votre-api-render.onrender.com/health
```

La reponse attendue est :

```json
{ "ok": true, "service": "MYPRO - TENNIS" }
```

## 7. Reconnecter Netlify a l'API

Dans Netlify, ouvrez `Site configuration > Environment variables` et renseignez :

```env
VITE_API_URL=https://votre-api-render.onrender.com/api
VITE_SOCKET_URL=https://votre-api-render.onrender.com
```

Redeployez ensuite le site Netlify.

## 8. Google OAuth

Si la connexion Google est active, ajoutez dans Google Cloud :

```text
https://votre-api-render.onrender.com/api/auth/google/callback
```

Cette URL doit pointer vers l'API Render, pas vers Netlify.

## 9. Notes multijoueur

Render peut faire tourner Express et Socket.IO, donc la presence en ligne et les notifications temps reel fonctionneront depuis le web.

Neon garde la base separee du serveur Render. C'est beaucoup plus propre pour un jeu persistant que SQLite temporaire sur l'instance Render gratuite.
