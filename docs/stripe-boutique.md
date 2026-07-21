# Boutique Stripe - mise en service securisee

La Boutique MYPRO - TENNIS est concue pour attribuer les gemmes uniquement apres la confirmation serveur de Stripe. Un retour du navigateur vers le jeu ne suffit jamais a valider un achat.

## Etat actuel attendu

Tant que les deux secrets Stripe ne sont pas renseignes, la Boutique affiche les offres mais bloque le paiement reel. La route publique suivante permet de verifier l'etat sans reveler les cles :

```text
https://votre-api-render.onrender.com/health
```

Configuration de test correcte :

```json
{
  "ok": true,
  "service": "MYPRO - TENNIS",
  "payments": {
    "stripe": {
      "ready": true,
      "mode": "TEST"
    }
  }
}
```

## 1. Configurer le bac a sable Stripe

1. Dans le Dashboard Stripe, ouvrez un bac a sable.
2. Copiez la cle secrete commencant par `sk_test_`.
3. Dans Render, ouvrez le service API, puis `Environment`.
4. Renseignez `STRIPE_SECRET_KEY` avec cette cle.
5. Gardez `STRIPE_LIVE_PAYMENTS_ENABLED=0`.

Les cles ne doivent jamais etre placees dans GitHub, Netlify ou dans le code du navigateur.

## 2. Creer le webhook de test

Dans Stripe, creez une destination webhook vers :

```text
https://votre-api-render.onrender.com/api/shop/stripe/webhook
```

Selectionnez ces evenements :

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
charge.refunded
refund.created
refund.updated
```

Copiez ensuite le secret commencant par `whsec_` dans la variable Render `STRIPE_WEBHOOK_SECRET`, puis relancez un deploiement de l'API.

## 3. Verifier la configuration

En local, apres avoir renseigne le fichier `.env` :

```text
npm run stripe:check
```

La commande ne montre jamais les valeurs des secrets. Tous les controles doivent afficher `[OK]`.

Sur Render, ouvrez `/health`. Le resultat doit indiquer `ready: true` et `mode: TEST`.

## 4. Parcours de recette obligatoire

1. Connectez-vous avec un compte joueur de test.
2. Notez le nombre de gemmes avant l'achat.
3. Ouvrez la Boutique et achetez le pack de 100 gemmes.
4. Sur la page Stripe de test, utilisez `4242 4242 4242 4242`, une date future et un CVC de trois chiffres.
5. Revenez dans le jeu et ouvrez `Mes achats`.
6. Verifiez que l'achat est `Paye`, que 100 gemmes ont ete ajoutees une seule fois et que le recu est disponible.
7. Rechargez la page plusieurs fois : les gemmes ne doivent pas etre ajoutees une seconde fois.
8. Dans Stripe, remboursez l'achat, puis verifiez que l'historique et le solde sont corriges. Si les gemmes ont deja ete depensees, la dette de gemmes doit apparaitre et etre absorbee par un prochain achat.

Effectuez aussi un paiement refuse et un paiement avec authentification 3D Secure depuis les cartes de test Stripe avant toute ouverture au public.

## 5. Passage en production

Le passage en production est une operation separee :

1. Activez votre compte Stripe et completez les informations bancaires et legales demandees.
2. Remplacez `sk_test_...` par la cle `sk_live_...` uniquement dans Render.
3. Creez un nouveau webhook en mode production et remplacez le secret `whsec_...` de test par le secret de production.
4. Verifiez d'abord que `/health` indique `mode: LIVE` et `ready: false`.
5. Quand les prix, les mentions legales, les remboursements et le compte bancaire sont verifies, passez `STRIPE_LIVE_PAYMENTS_ENABLED=1` puis redeployez l'API.
6. Realisez un achat reel de faible montant et un remboursement complet avant d'ouvrir la Boutique aux joueurs.

Ne reutilisez jamais les cles ou les webhooks du bac a sable en production.
