# Refonte de la page Compétences

Référence visuelle : `docs/mockups/skills-mobile-first-v1.png`

Objectif : reproduire fidèlement la maquette en paysage mobile-first, conserver toutes les règles métier actuelles et obtenir une mise à l’échelle propre jusqu’en 1080p.

## Principes non négociables

- Toute l’interface utile tient dans un écran horizontal, sans défilement de page.
- La version smartphone conserve la même composition que la version PC.
- L’interface utilise la direction artistique du hub et de la Collection : bleu nuit, panneaux opaques, liserés cyan, vert menthe actif, or pour le prochain palier et violet pour les éléments verrouillés.
- Les textes, boutons et états restent lisibles sur une hauteur réduite de smartphone.
- Les données affichées proviennent exclusivement de l’API existante `/skills`.
- L’amélioration utilise l’API existante `/skills/spend` et conserve toutes ses limites : point disponible, statistique inférieure à 100 et maximum de 20 points investis par statistique.
- Le joueur représenté est le héros actuellement sélectionné par le compte, et non une image fixe.

## Inventaire visuel

### Assets déjà disponibles

- Fond de stade : `apps/mypro-tennis-web/public/visuals/lobby-stadium.webp`.
- Joueurs détourés : `apps/mypro-tennis-web/public/visuals/players/pp-01-hero.webp` à `pp-10-hero.webp`.
- Icônes des 12 statistiques : bibliothèque Lucide déjà utilisée par `statVisuals`.
- Icônes d’état : validation, verrou, aide, réglages, fermeture et retour déjà présentes dans le projet.
- Logo MYPRO TENNIS : composant graphique déjà reproduit dans la page Collection.

### Visuels à construire dans l’interface

Ces éléments ne nécessitent pas de nouvelles images bitmap. Ils seront créés en SVG/CSS afin de rester parfaitement nets à toutes les résolutions :

- badge hexagonal de niveau ;
- rail vertical des paliers 10, 25, 50, 75 et 100 ;
- lueur du prochain palier en or ;
- encadrements actifs, verrouillés et désactivés ;
- barres XP et investissement ;
- pictogrammes circulaires d’archétype et de bonus ;
- fond, bordure et reflet des panneaux ;
- toast de confirmation en bas de l’écran.

Un nouvel asset image ne sera créé que si une comparaison visuelle montre qu’un élément ne peut pas être reproduit proprement avec les ressources ci-dessus.

## Étape 1 — Architecture dédiée

Créer une page isolée, sur le modèle de la Collection :

- `src/components/skills/SkillsPage.tsx` ;
- `src/components/skills/skills.css` ;
- `src/components/skills/types.ts` si nécessaire ;
- import du CSS dans le composant ;
- remplacement du composant monolithique actuel dans `App.tsx` ;
- passage du résolveur de héros du joueur au nouveau composant.

La récupération des données, le rafraîchissement du joueur et l’appel de dépense restent inchangés.

### Validation

- [ ] `/skills` charge toujours les données réelles du joueur.
- [ ] Une amélioration modifie bien la statistique et le nombre de points.
- [ ] Aucun changement n’est apporté aux règles serveur.
- [ ] Les erreurs API sont visibles et compréhensibles.

## Étape 2 — Shell mobile-first et en-tête

Construire un conteneur plein écran basé sur `100dvh`, avec gestion des zones sûres du téléphone et sans défilement global.

Reproduire l’en-tête de la maquette :

- retour ;
- logo MYPRO TENNIS ;
- titre COMPÉTENCES ;
- badge de niveau ;
- compteur de points disponibles ;
- aide ;
- réglages ;
- fermeture.

Le compteur de points doit être l’élément prioritaire de l’en-tête.

### Validation

- [ ] Aucun élément ne déborde à 915 × 412.
- [ ] Les zones tactiles font au moins 44 px avant mise à l’échelle.
- [ ] L’en-tête reste sur une seule ligne.
- [ ] Le titre et les points disponibles restent lisibles sur les petits écrans.

## Étape 3 — Colonne Progression du joueur

Reproduire la colonne gauche :

- héros détouré dynamique ;
- badge NIV. ;
- XP courante et XP nécessaire ;
- barre de progression ;
- XP restante avant le prochain niveau ;
- points disponibles ;
- points dépensés ;
- archétype ;
- total des bonus actifs.

Le héros doit rester ancré en bas du panneau et s’adapter sans déformation ni recadrage du visage.

### Validation

- [ ] Le portrait correspond au choix du joueur connecté.
- [ ] Les valeurs niveau, XP, points et archétype correspondent à l’API.
- [ ] Le niveau maximum affiche un état spécifique.
- [ ] Le panneau conserve les proportions de la maquette sur mobile et PC.

## Étape 4 — Grille des 12 statistiques

Afficher les douze statistiques dans une grille fixe de 3 colonnes × 4 lignes :

- Service ;
- Retour ;
- Coup droit ;
- Revers ;
- Volée ;
- Smash ;
- Amortie ;
- Endurance ;
- Vitesse ;
- Explosivité ;
- Force ;
- Récupération.

Chaque carte contient l’icône, le nom, la valeur, l’investissement `x/20`, sa barre et le contrôle `+1 / 1 PT`.

Interaction retenue pour rendre l’action explicite :

1. un premier toucher sélectionne la statistique et allume son contour ;
2. le bandeau inférieur affiche l’aperçu, par exemple `SERVICE 64 → 65` ;
3. le bouton `AMÉLIORER · 1 POINT` confirme la dépense ;
4. le succès met à jour les valeurs et affiche le toast ;
5. un état distinct couvre absence de point, maximum 100, limite 20/20 et requête en cours.

### Validation

- [ ] Les 12 statistiques sont visibles simultanément.
- [ ] La sélection est évidente avant confirmation.
- [ ] Un double toucher accidentel ne dépense pas deux points.
- [ ] Les quatre états bloquants sont visuellement différents.
- [ ] La grille reste lisible à 915 × 412 et à 1920 × 1080.

## Étape 5 — Paliers de carrière

Reproduire la colonne droite :

- rappel de l’archétype ;
- total des bonus actifs ;
- mention des bonus automatiques en match ;
- rail vertical 10 / 25 / 50 / 75 / 100 ;
- paliers acquis avec coche verte ;
- prochain palier en or ;
- paliers futurs avec verrou violet ;
- détail du prochain avantage et de ses bonus ;
- information indiquant que ces bonus ne consomment aucun point.

Le prochain palier est calculé dynamiquement. Au niveau 100, le panneau passe en état `TOUS LES PALIERS DÉBLOQUÉS`.

### Validation

- [ ] Les cinq avantages API sont présents et dans le bon ordre.
- [ ] Les états acquis, prochain et verrouillé sont exacts.
- [ ] Les bonus affichés correspondent aux bonus réellement actifs en match.
- [ ] Le cas niveau 100 est couvert.

## Étape 6 — Adaptation smartphone et 1080p

Utiliser une scène de référence proche de 1844 × 853, puis une mise à l’échelle fluide avec `clamp()`, unités de viewport et ratios de colonnes stables.

Résolutions de contrôle :

- 915 × 412 : smartphone horizontal compact ;
- 1080 × 480 : smartphone horizontal large ;
- 1280 × 720 : petit PC ;
- 1920 × 1080 : PC 1080p.

En cas de hauteur extrêmement réduite, seule la densité interne baisse. L’ordre des trois colonnes et la composition générale ne changent pas.

### Validation

- [ ] Aucun défilement vertical ou horizontal parasite.
- [ ] Aucun texte ni bouton n’est coupé.
- [ ] Les trois colonnes restent visibles sur smartphone.
- [ ] La version 1080p n’ajoute pas de grands espaces vides.
- [ ] Les safe areas Android et iOS sont respectées.

## Étape 7 — Fluidité et accessibilité

- mémoriser la sélection localement sans recharger la page ;
- ne rafraîchir que les données nécessaires après une dépense ;
- utiliser uniquement des animations courtes sur opacité et transformation ;
- désactiver les animations non essentielles avec `prefers-reduced-motion` ;
- ajouter les libellés accessibles aux boutons à icône ;
- conserver un contraste suffisant dans les états verrouillés ;
- éviter tout effet de flou coûteux sur la grille des 12 cartes.

### Validation

- [ ] Aucun saut de mise en page pendant le chargement.
- [ ] Le bouton de confirmation empêche les requêtes multiples.
- [ ] Le retour visuel apparaît immédiatement.
- [ ] L’interface reste fluide sur smartphone.

## Étape 8 — Tests et comparaison finale

Tests fonctionnels :

- chargement normal ;
- API lente ;
- erreur API ;
- zéro point ;
- amélioration réussie ;
- statistique à 100 ;
- investissement à 20/20 ;
- niveaux 9, 10, 24, 25, 49, 50, 74, 75, 99 et 100.

Contrôle visuel :

- capture aux quatre résolutions de référence ;
- comparaison côte à côte avec la maquette ;
- correction des écarts de taille, espacement, couleur, alignement et contraste ;
- validation finale sur navigateur PC et smartphone réel.

### Définition de terminé

- [ ] Fidélité visuelle validée par comparaison directe avec la maquette.
- [ ] Toutes les fonctionnalités de l’ancienne page sont conservées.
- [ ] Les 12 statistiques et les cinq paliers sont entièrement dynamiques.
- [ ] La page fonctionne sans débordement sur mobile horizontal.
- [ ] La page reste nette et proportionnée en 1080p.
- [ ] Le build et les tests passent.

