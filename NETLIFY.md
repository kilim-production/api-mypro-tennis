# MYPRO - TENNIS sur Netlify

Le projet contient `netlify.toml`, donc Netlify peut construire directement la PWA.

Réglages utilisés :

```text
Build command: npm run build -w @mypro/tennis-web
Publish directory: apps/mypro-tennis-web/dist
Node version: 20
```

Variables à renseigner dans Netlify :

```env
VITE_API_URL="https://votre-api-mypro.example.com/api"
VITE_SOCKET_URL="https://votre-api-mypro.example.com"
```

Important : Netlify héberge le frontend. Pour le multijoueur web, l'API Express + Socket.IO doit être déployée sur un serveur Node public séparé.

Guides :

- Frontend Netlify : `docs/deploiement-netlify.md`
- API multijoueur Render : `docs/deploiement-api-render.md`
