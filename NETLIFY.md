# MYPRO TENNIS sur Netlify

## Déploiement manuel avec Netlify Drop

1. Double-cliquer sur `Preparer Netlify Drop.cmd`.
2. Attendre la fin de la construction.
3. L'explorateur Windows ouvre automatiquement le dossier :

   `apps/mypro-tennis-web/dist`

4. Glisser uniquement ce dossier `dist` dans la zone de dépôt Netlify.

Le dossier racine `MyPro-Tennis` et la copie `api-mypro-tennis` contiennent le code source, l'historique Git et parfois les dépendances. Ils ne doivent pas être envoyés dans Netlify Drop.

Le dossier `dist` contient déjà le site construit, les redirections de la SPA, les règles de cache et les fichiers de la PWA. Netlify doit donc le publier directement sans relancer un build distant.

## Déploiement depuis GitHub

Pour un déploiement automatique connecté au dépôt GitHub, les réglages sont :

```text
Build command: npm run build:netlify
Publish directory: apps/mypro-tennis-web/dist
Node version: 20
```

Variables utilisées :

```env
VITE_API_URL="https://mypro-tennis-api.onrender.com/api"
VITE_SOCKET_URL="https://mypro-tennis-api.onrender.com"
```

Netlify héberge uniquement le frontend. L'API Express et Socket.IO reste déployée séparément sur Render.
