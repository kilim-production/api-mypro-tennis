# Refonte de la page Saison en cours

Référence visuelle : `docs/mockups/season-mobile-first-v1.png`

Objectif : reproduire fidèlement la maquette validée en paysage mobile-first, conserver toutes les règles actuelles de la saison et obtenir exactement la même composition jusqu’en 1080p. La page doit ressembler à un écran de jeu MYPRO TENNIS, pas à un tableau de bord web générique.

## Principes non négociables

- La page est conçue d’abord pour un smartphone utilisé horizontalement.
- La version PC conserve les mêmes panneaux, leur ordre et leur hiérarchie ; seule l’échelle évolue.
- L’écran principal tient dans la hauteur utile du téléphone sans défilement global parasite.
- Les actions tactiles essentielles mesurent au moins 44 px avant mise à l’échelle.
- La direction artistique reprend le Hub, le Duel, la Collection, les Compétences et le Club : bleu nuit, panneaux denses, bordures cyan, vert menthe actif, or pour les récompenses et rouge uniquement pour les erreurs.
- Tous les montants utilisent `CR`. Aucun symbole euro ne doit apparaître.
- Les valeurs visibles dans la maquette sont dynamiques : jour, semaine, énergie, crédits, frais, dotation, tour, adversaire et progression ne doivent jamais être codés en dur.
- Une action serveur n’est jamais simulée uniquement dans l’interface.
- Après chaque étape de développement, une checklist `[x] / [ ]` doit être communiquée avant de passer à la suivante.

## Inventaire fonctionnel à conserver

- saison réelle de 30 jours, jour courant, semaine, progression et compte à rebours ;
- timeline des 30 récompenses quotidiennes ;
- états récupérée, disponible, manquée, verrouillée et récompense finale Mythique ;
- récupération des crédits, gemmes ou sacs et ouverture de la modale de récompense ;
- tournoi journalier, tournoi hebdomadaire et championnat individuel ;
- inscription, coût en énergie, frais en crédits et dotation ;
- statut de l’inscription et disponibilité de la période ;
- tableau de 16 joueurs pour les tournois ;
- parcours pyramidal FFT pour le championnat individuel ;
- prochain tour, prochain classement, historique, scores et replays ;
- lancement du prochain match ;
- états éliminé, vainqueur et champion national ;
- détail complet du tableau ou du parcours ;
- rafraîchissement des ressources du joueur après chaque action.

## Assets

### Assets existants à réutiliser

- stade : `apps/mypro-tennis-web/public/visuals/lobby-stadium.webp` ;
- logo MYPRO TENNIS existant ;
- portraits circulaires : `public/profile-pictures/pp-01.jpg` à `pp-10.jpg` ;
- héros détourés si nécessaires : `public/visuals/players/pp-01-hero.webp` à `pp-10-hero.webp` ;
- sac Mythique du jour 30 : `public/visuals/chests/tennis-bag-mythique.webp` ;
- icônes Lucide pour énergie, calendrier, trophée, cadeau, crédits, cadenas, validation, aide, réglages et fermeture.

### Éléments à construire en CSS/SVG

- emblème doré du parcours ;
- rail des récompenses quotidiennes ;
- rail de progression du tournoi ;
- mini-tableau à quatre colonnes ;
- écussons de note globale ;
- encadrements actif, disponible, terminé, verrouillé et éliminé ;
- panneaux tactiques vert et or ;
- squelettes de chargement ayant exactement les dimensions finales.

Aucun nouvel asset bitmap n’est nécessaire pour la première reproduction. Un visuel supplémentaire ne sera créé que si la comparaison finale démontre qu’un élément ne peut pas être obtenu fidèlement avec les ressources existantes.

## Étape 1 — Architecture dédiée et gel fonctionnel

Extraire la page actuellement contenue dans `App.tsx` vers :

- `src/components/season/SeasonPage.tsx` pour l’orchestration ;
- `src/components/season/season.css` pour la scène mobile-first ;
- `src/components/season/types.ts` pour les données de saison, récompense et compétition ;
- `src/components/season/seasonUtils.ts` pour les tours, libellés, délais et états ;
- composants dédiés pour l’en-tête, le rail de récompenses, les onglets, le parcours, le prochain match, le mini-tableau et les détails.

Conserver les appels actuels :

- `GET /season` ;
- `POST /season/rewards/daily/claim` ;
- `POST /season/:type/register` ;
- `POST /season/entries/:entryId/play`.

Faire de `/season` une page plein écran dans le `Shell`, comme Collection, Compétences, Club et Duel. La route `/tournaments` continue d’ouvrir la même page tant qu’elle reste utilisée.

### Validation

- [x] Les données reçues sont identiques à celles de l’ancienne page.
- [x] Les quatre actions API conservent leur comportement.
- [x] Aucune règle de coût, de fréquence ou d’élimination n’est modifiée.
- [x] Les erreurs disposent d’un message visible et d’une action de réessai.

## Étape 2 — Shell plein écran et en-tête

Construire une scène `100dvw × 100dvh` avec safe areas Android/iOS, fond de stade assombri et grille verticale à hauteur contrôlée.

Reproduire l’en-tête :

- retour ;
- logo MYPRO TENNIS ;
- titre `SAISON 1` ;
- énergie ;
- gemmes ;
- crédits ;
- aide ;
- réglages ;
- fermeture.

L’énergie, les gemmes et les crédits proviennent du joueur connecté. Les contrôles ferment ou ouvrent les mêmes destinations que sur les autres pages cinématiques.

### Validation

- [x] L’en-tête tient sur une ligne à 740 × 360 et 915 × 412.
- [x] Les valeurs ne débordent jamais de leurs blocs.
- [x] Les safe areas ne masquent aucune action.
- [x] Les ressources se mettent à jour après inscription ou récompense.

## Étape 3 — Bandeau Saison et récompense du jour

Reproduire la grande bande horizontale sous l’en-tête.

### Bloc Saison

- `SAISON EN COURS` ;
- `JOUR x / 30` ;
- semaine réelle ;
- barre et pourcentage de progression ;
- compte à rebours jusqu’à la fin de saison.

### Bloc Récompenses

- nœuds reliés pour les jours récents et prochains ;
- jour actuel lumineux ;
- jours pris avec coche ;
- jours manqués distincts ;
- jours futurs verrouillés ;
- raccourci visuel vers le jour 30 Mythique ;
- type et valeur de la récompense actuelle ;
- bouton `RÉCUPÉRER` ou état déjà pris.

Le rail montre une fenêtre utile sur smartphone et permet d’ouvrir la timeline complète sans agrandir la page.

### Validation

- [x] Les cinq états de récompense sont exacts.
- [x] Une récompense ne peut être récupérée qu’une fois.
- [x] La modale existante affiche correctement crédits, gemmes et sacs.
- [x] Le jour 30 affiche toujours le sac Mythique.
- [x] Le compte à rebours évolue localement sans rappeler l’API chaque seconde.

## Étape 4 — Navigation des trois compétitions

Reproduire les trois onglets :

1. `TOURNOI JOURNALIER` ;
2. `TOURNOI HEBDOMADAIRE` ;
3. `CHAMPIONNAT INDIVIDUEL`.

Chaque onglet affiche l’état utile : inscrit, disponible, terminé ou coût en énergie. L’onglet actif utilise le halo menthe et le trait lumineux. Le changement d’onglet conserve les données déjà chargées et remplace uniquement les trois panneaux du corps.

### Validation

- [x] L’onglet actif est identifiable sans lire son texte.
- [x] Les coûts et statuts correspondent aux données serveur.
- [x] Le changement d’onglet ne relance pas inutilement `/season`.
- [x] Les trois onglets restent visibles simultanément sur smartphone.

## Étape 5 — Colonne Mon parcours

Reproduire la colonne gauche :

- emblème de compétition ;
- format `TABLEAU 16` ou `PYRAMIDE FFT` ;
- tour actuel ;
- nombre de victoires ;
- statut en course, éliminé ou vainqueur ;
- frais d’inscription payés ;
- dotation possible ou gagnée ;
- rail des tours ;
- bouton `HISTORIQUE`.

Le bouton Historique ouvre le détail de l’entrée avec scores, adversaires, dates et accès au replay lorsque disponible.

### Validation

- [x] Le tour affiché correspond à `currentRound`.
- [x] Le rail représente le nombre réel de tours.
- [x] Les statuts terminaux désactivent le lancement du match.
- [x] Les frais et gains ne sont jamais codés en dur.

## Étape 6 — Prochain match et prévisualisation de l’adversaire

Reproduire le panneau central, qui constitue l’action principale :

- compétition et tour ;
- joueur connecté, portrait, classement et note globale ;
- adversaire, portrait, classement et note globale ;
- avantage principal du joueur ;
- statistique adverse à surveiller ;
- disponibilité ;
- grand bouton `JOUER LE MATCH` ;
- bouton secondaire `VOIR LE TABLEAU` ou `VOIR LE PARCOURS`.

L’API actuelle expose seulement le classement et la note cible du prochain adversaire. Étendre la réponse de saison avec une prévisualisation déterministe : identité, avatar, classement, note et statistiques utiles. La même graine `entrée + tour` doit être utilisée lors de la création du match afin que l’adversaire affiché soit exactement celui qui est affronté.

Les blocs tactiques utilisent les 12 statistiques réelles : meilleur écart favorable du joueur et force adverse la plus dangereuse.

### Validation

- [x] L’adversaire affiché est le même que celui du match lancé.
- [x] Sa note est la moyenne de ses 12 statistiques.
- [x] L’avantage et le danger sont calculés, pas écrits en dur.
- [x] Le bouton empêche les doubles lancements.
- [x] Une énergie insuffisante ou un match indisponible produit un blocage explicite.

## Étape 7 — Mini-tableau et parcours complet

### Tournois journalier et hebdomadaire

- mini-tableau `1/8`, `1/4`, `1/2`, `FINALE` ;
- branche du joueur en vert ;
- prochain adversaire en or ;
- matchs futurs verrouillés ;
- vainqueurs et scores des tours terminés.

### Championnat individuel

- remplacer le tableau par le chemin pyramidal FFT ;
- afficher classement actuel, prochain palier et objectif `-15` ;
- différencier étapes gagnées, étape actuelle et étapes futures.

Les boutons `VOIR LE TABLEAU`, `VOIR LE PARCOURS COMPLET` et `HISTORIQUE` réutilisent une seule modale de détail adaptée au type de compétition.

### Validation

- [x] La branche du joueur est exacte.
- [x] Les scores et replays existants restent accessibles.
- [x] Le championnat n’utilise jamais un faux tableau 16.
- [x] La modale est lisible et contenue dans la safe area.

## Étape 8 — Inscription et états alternatifs

Créer les variantes de la même composition pour :

- non inscrit et inscription disponible ;
- période verrouillée avec prochain horaire ;
- inscrit mais prochain match différé ;
- compétition en cours ;
- éliminé ;
- vainqueur ;
- champion national ;
- saison terminée ;
- énergie insuffisante ;
- crédits insuffisants ;
- erreur réseau.

Sans inscription, le panneau central remplace le duel par les règles, la zone FFT, les frais, la dotation et le bouton `S’INSCRIRE`. La composition générale ne change pas.

### Validation

- [x] Chaque état explique clairement l’action disponible ou le blocage.
- [x] L’inscription débite exactement énergie et crédits côté serveur.
- [x] Les données sont actualisées sans rechargement global.
- [x] Les états terminaux n’offrent aucune action morte.

## Étape 9 — Responsive mobile-first et 1080p

Utiliser une grille de référence 16:9 et des tailles fluides avec variables CSS et `clamp()`.

Résolutions de contrôle :

- 740 × 360 : smartphone compact ;
- 844 × 390 : référence mobile principale ;
- 915 × 412 : smartphone large ;
- 1080 × 480 : smartphone haute définition ;
- 1280 × 720 : petit PC ;
- 1920 × 1080 : PC Full HD.

En faible hauteur, réduire dans cet ordre : marges, espacements, textes secondaires, taille des portraits. Ne jamais supprimer les boutons principaux, changer l’ordre des colonnes ou convertir la page en empilement vertical.

### Validation

- [x] Aucun défilement horizontal.
- [x] Aucun panneau sous les contrôles système.
- [x] Les trois colonnes restent visibles sur smartphone horizontal.
- [x] Aucun titre, score, coût ou bouton n’est coupé.
- [x] La version 1080p remplit l’espace sans agrandir excessivement les textes.

## Étape 10 — Fluidité, chargement et accessibilité

- charger `/season` une seule fois à l’entrée puis utiliser les compteurs locaux ;
- conserver les trois compétitions en mémoire pendant le changement d’onglet ;
- invalider uniquement la saison et le joueur après inscription, récompense ou match ;
- précharger les portraits du prochain adversaire ;
- afficher des squelettes aux dimensions exactes des panneaux ;
- limiter les animations à `opacity` et `transform` ;
- respecter `prefers-reduced-motion` ;
- ajouter les noms accessibles aux boutons d’icône, onglets et rails ;
- assurer un focus clavier visible ;
- éviter les flous coûteux sur smartphone.

### Validation

- [x] Aucun écran blanc pendant le chargement.
- [x] Les onglets déjà ouverts réapparaissent instantanément.
- [x] Les actions bloquent les doubles requêtes.
- [x] Les images ne sont pas rechargées à chaque changement d’onglet.
- [x] La page reste fluide sur smartphone et PC.

## Étape 11 — Tests et comparaison finale

### Tests fonctionnels

- jours 1, 13, 29 et 30 ;
- récompense prise, disponible, manquée et verrouillée ;
- récompense crédits, gemmes et sac ;
- trois compétitions non inscrites ;
- trois compétitions en cours ;
- inscription réussie et ressources insuffisantes ;
- prochain match immédiat et différé ;
- victoire, défaite, élimination, titre et championnat national ;
- tableau complet, historique et replay ;
- erreur API et reconnexion.

### Contrôle visuel

- captures aux six résolutions de référence ;
- comparaison côte à côte avec `season-mobile-first-v1.png` ;
- correction des écarts de taille, alignement, couleur, rayon, contraste et densité ;
- contrôle des textes longs avec différents noms de joueurs ;
- test tactile sur smartphone réel ;
- test clavier et souris sur PC.

### Définition de terminé

- [x] La vue Tournoi journalier reproduit fidèlement la maquette.
- [x] Les vues Hebdomadaire et Championnat conservent exactement la même composition.
- [x] Toutes les fonctionnalités de l’ancienne page Saison sont conservées.
- [x] L’adversaire prévisualisé est celui du match.
- [x] Aucun symbole euro n’est présent.
- [x] Aucun débordement n’apparaît sur smartphone horizontal.
- [x] La page reste nette, dense et proportionnée en 1080p.
- [x] Les tests, le typecheck et le build Netlify passent.
- [x] La copie GitHub Desktop est synchronisée après validation.

## Ordre d’exécution recommandé

1. extraction technique et types ;
2. shell plein écran et en-tête ;
3. bandeau saison et récompenses ;
4. onglets des compétitions ;
5. colonne parcours ;
6. prévisualisation serveur et prochain match ;
7. mini-tableau et parcours complet ;
8. états alternatifs et modales ;
9. responsive, fluidité et accessibilité ;
10. comparaison visuelle, tests, build et synchronisation.
