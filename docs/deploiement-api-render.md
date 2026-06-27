# Deploiement de l'API MYPRO - TENNIS sur Render

Netlify sert uniquement l'application React. Pour le multijoueur web, il faut publier l'API Express + Socket.IO sur un hebergeur Node public. Ce projet est pret pour Render avec `render.yaml`.

La configuration par defaut utilise l'instance gratuite Render. Elle permet de tester le jeu en ligne sans carte bancaire, mais la base SQLite n'est pas persistante : les donnees peuvent etre perdues lors d'un redeploiement ou d'un redemarrage.

Pour une vraie persistance multijoueur, il faudra passer ensuite sur PostgreSQL ou ajouter un disque persistant payant.

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

## 3. Variables serveur

Dans Render, ajoutez :

```env
NODE_ENV=production
DATABASE_URL=file:./render-free.db
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

## 4. Initialiser la base la premiere fois

Au premier demarrage, `npm run api:start` applique les migrations Prisma automatiquement.

Pour ajouter les donnees de demonstration, ouvrez le shell Render du service et lancez :

```text
npm run db:seed
```

Attention : le seed actuel remet les donnees de jeu a zero. Lancez-le seulement sur une base neuve, avant d'ouvrir le jeu aux vrais joueurs.

Sur l'offre gratuite sans disque persistant, cette base sert surtout aux tests web. Elle n'est pas adaptee a une vraie saison multijoueur durable.

## 5. Verifier l'API

Quand le deploy est termine, ouvrez :

```text
https://votre-api-render.onrender.com/health
```

La reponse attendue est :

```json
{ "ok": true, "service": "MYPRO - TENNIS" }
```

## 6. Reconnecter Netlify a l'API

Dans Netlify, ouvrez `Site configuration > Environment variables` et renseignez :

```env
VITE_API_URL=https://votre-api-render.onrender.com/api
VITE_SOCKET_URL=https://votre-api-render.onrender.com
```

Redeployez ensuite le site Netlify.

## 7. Google OAuth

Si la connexion Google est active, ajoutez dans Google Cloud :

```text
https://votre-api-render.onrender.com/api/auth/google/callback
```

Cette URL doit pointer vers l'API Render, pas vers Netlify.

## 8. Notes multijoueur

Render peut faire tourner Express et Socket.IO, donc la presence en ligne et les notifications temps reel fonctionneront depuis le web.

Pour un serveur durable avec beaucoup de joueurs, il faudra remplacer SQLite par PostgreSQL manage ou utiliser un disque persistant payant. Le code Prisma est deja organise pour cette evolution.
