# Déploiement Netlify de MYPRO - TENNIS

Netlify héberge la PWA React. Pour que le jeu soit réellement multijoueur sur le web, l'API Express + Socket.IO doit être publiée sur un serveur Node public séparé.

Netlify ne permet pas de faire tourner durablement un serveur Socket.IO persistant dans ses fonctions serverless. Il faut donc :

1. Déployer le frontend sur Netlify.
2. Déployer l'API `apps/mypro-tennis-server` sur un hébergeur Node compatible WebSocket.
3. Renseigner dans Netlify les URLs publiques de cette API.

## Importer le projet dans Netlify

Dans Netlify :

1. Créez un nouveau site depuis votre dépôt ou en important le dossier.
2. Netlify détectera `netlify.toml`.
3. Les réglages attendus sont :

```text
Build command: npm run build -w @mypro/tennis-web
Publish directory: apps/mypro-tennis-web/dist
Node version: 20
```

## Variables Netlify

Dans `Site configuration > Environment variables`, ajoutez :

```env
VITE_API_URL="https://votre-api-mypro.example.com/api"
VITE_SOCKET_URL="https://votre-api-mypro.example.com"
```

Ces deux variables doivent pointer vers l'API publique, pas vers Netlify.

## Déployer l'API multijoueur

L'API à publier est `apps/mypro-tennis-server`.

Elle doit exposer :

```text
https://votre-api-mypro.example.com/health
https://votre-api-mypro.example.com/api
https://votre-api-mypro.example.com/socket.io
```

Variables serveur recommandées :

```env
NODE_ENV=production
DATABASE_URL="file:./prod.db"
JWT_SECRET="une-cle-longue-et-secrete"
CLIENT_URL="https://votre-site-netlify.netlify.app"
SERVER_PORT=4000
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="https://votre-api-mypro.example.com/api/auth/google/callback"
```

`CLIENT_URL` accepte plusieurs domaines séparés par des virgules, utile pour ajouter les previews Netlify :

```env
CLIENT_URL="https://votre-site.netlify.app,https://deploy-preview-1--votre-site.netlify.app"
```

## Base de données

Le projet utilise SQLite pour le MVP local. Pour un premier test web jouable, l'API peut fonctionner avec un disque persistant sur l'hébergeur Node.

Pour une vraie production MMO, il faudra passer Prisma sur PostgreSQL et héberger la base sur un service managé.

## Google OAuth

Dans Google Cloud, ajoutez l'URI de redirection de l'API :

```text
https://votre-api-mypro.example.com/api/auth/google/callback
```

Le site Netlify n'est pas l'URL de callback Google. La callback doit pointer vers l'API.

## Vérification

Après déploiement :

1. Ouvrez `https://votre-api-mypro.example.com/health`.
2. Ouvrez le site Netlify.
3. Connectez-vous.
4. Vérifiez que `Joueurs en ligne` se remplit via Socket.IO.
5. Installez la PWA depuis le navigateur.

## Guide API public

Le guide detaille pour publier l'API Express + Socket.IO sur Render est disponible ici :

```text
docs/deploiement-api-render.md
```

Pour Render, connectez la racine du depot complet. Ne connectez pas uniquement `apps/mypro-tennis-server`, car le serveur depend aussi des packages partages et du schema Prisma.
