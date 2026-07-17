# Spécification UI — Duel mobile-first

Référence visuelle : `duel-mobile-first-v1.png` (1672 × 941, paysage 16:9).

## 1. Objectif de fidélité

- Un seul écran plein cadre, sans en-tête générique, pied de page ou navigation mobile externe.
- Composition identique en paysage smartphone et en 1080p ; seules les tailles fluides changent.
- Aucun défilement horizontal. Les trois adversaires et les trois modes restent visibles ensemble.
- Touches principales d'au moins 44 × 44 px CSS.
- Les données, états et boutons existants de `/duel` restent fonctionnels.

## 2. Grille de référence

La scène occupe `100dvw × 100dvh` et utilise le stade du hub.

| Zone | Hauteur de référence | Structure |
| --- | ---: | --- |
| En-tête | 9 % | retour + marque + titre / ressources + actions |
| Onglets | 8 % | adversaires / amis / rafraîchir |
| Corps | 64 % | joueur 26 % / adversaires 44 % / analyse 30 % |
| Configuration | 19 % | trois modes / format et coût / lancement |

Espacement extérieur fluide : `clamp(6px, 0.75vw, 14px)`.
Espacement interne des panneaux : `clamp(7px, 0.9vw, 16px)`.
Rayon principal : 8 px. Bordure : 1 px.

## 3. Palette et matière

| Usage | Valeur |
| --- | --- |
| Fond profond | `#020b17` |
| Panneau haut | `rgba(8, 26, 40, .96)` |
| Panneau bas | `rgba(2, 12, 24, .94)` |
| Bordure | `rgba(108, 211, 208, .28)` |
| Bordure active | `rgba(70, 235, 187, .88)` |
| Menthe principale | `#43e5b0` |
| Cyan secondaire | `#67e8f9` |
| Or tactique | `#f4c54e` |
| Texte principal | `#f8fafc` |
| Texte secondaire | `#9caebe` |
| Erreur | `#fb7185` |

Panneaux : dégradé vertical bleu nuit, ombre extérieure légère et reflet intérieur de 1 px.
État actif : bordure menthe, halo discret et bande lumineuse inférieure.

## 4. Typographie

- Titres : `Arial Narrow`, `Roboto Condensed`, sans-serif ; gras 950–1000 ; capitales.
- Texte fonctionnel : `Inter`, sans-serif.
- Tailles via `clamp()` ; aucune taille dépendante d'un unique breakpoint.
- Les titres ne passent pas sur deux lignes dans les résolutions paysage prises en charge.

## 5. Assets

| Élément | Source |
| --- | --- |
| Stade | `/visuals/lobby-stadium.webp` |
| Silhouette du joueur | `/visuals/players/pp-XX-hero.webp` |
| Portraits adversaires | `/profile-pictures/pp-XX.jpg` |
| Icônes d'interface | Lucide React |
| Écusson de note | CSS/SVG, pas de bitmap |
| Jauges et comparaisons | CSS, pas de bitmap |

Les avatars personnalisés continuent d'utiliser les résolveurs existants. En cas d'avatar importé, le portrait reste affiché avec `object-fit: cover` tandis que la silhouette utilise le fallback de héros correspondant.

## 6. Correspondance données / maquette

### Votre joueur

- Identité : `firstName`, `lastName`, `avatar`.
- Classement : `fftRanking`.
- Niveau de carrière : `playerLevel`.
- Note : `overall`, moyenne des 12 statistiques.
- Bilan : `wins`, `losses`.
- Forme : proportion de `actionEnergy / actionEnergyMax`.
- Points forts : trois valeurs les plus élevées de `profileStatKeys`.
- Coach Deck : état récupéré depuis `/coach-decks`.

### Adversaires

- Pool : `GET /matches/duel-pool`.
- Recherche : `GET /matches/duel-search?q=...`.
- Réel / IA : `isAi`.
- Points forts : trois meilleures statistiques du profil.
- Style : dérivé de l'archétype et des statistiques dominantes.
- Une sélection persiste tant que le pool n'est pas rafraîchi.

### Analyse

- Comparaison des six statistiques les plus discriminantes.
- Avantage : plus grand écart positif pour le joueur.
- Danger : statistique adverse la plus haute parmi ses écarts favorables.
- Difficulté : écart entre les deux notes globales (`Favorable`, `Équilibré`, `Difficile`).
- Le bouton « Voir les 12 statistiques » ouvre une vue détaillée sans quitter la page.

### Modes de match

- Coach Deck : `/matches/interactive`, deck actif obligatoire.
- Automatique : `/matches/quick`, replay point par point.
- Résultat rapide : `/matches/quick`, ouverture directe du résultat.
- Format envoyé : `Deux sets gagnants`.
- Coût affiché : 1 énergie.

## 7. États obligatoires

- Chargement initial avec squelette conservant la grille.
- Pool disponible et adversaire sélectionné.
- Recherche d'ami vide, en cours, réussie et sans résultat.
- Coach Deck prêt, absent ou tutoriel requis.
- Énergie insuffisante.
- Match interactif déjà en cours avec action « Reprendre ».
- Erreur réseau avec action « Réessayer ».
- Boutons désactivés pendant le lancement pour empêcher un double match.

## 8. Matrice responsive

| Résolution | Règle |
| --- | --- |
| 740 × 360 | mode compact maximal, descriptions secondaires raccourcies |
| 844 × 390 | référence smartphone paysage |
| 915 × 412 | référence smartphone large |
| 1280 × 720 | mise à l'échelle fluide |
| 1920 × 1080 | fidélité complète à la maquette |

Sous 740 px de largeur ou en portrait, l'écran demande de tourner l'appareil afin de préserver l'expérience horizontale prévue pour le jeu.

## 9. Critères d'acceptation

- Écart visuel maximal de 4 px sur les alignements structurants à 1920 × 1080.
- Aucun bloc coupé à 740 × 360, 844 × 390, 915 × 412 et 1920 × 1080.
- Sélection de l'adversaire et du mode perceptible sans lire le texte.
- Les trois modes, le coût et le bouton de lancement restent visibles sans défilement.
- Aucun symbole euro ; les crédits utilisent toujours `CR`.
- Les images restent en WebP lorsque disponible et ne sont pas rechargées à chaque sélection.
- Navigation clavier, focus visible et libellés accessibles sur les actions.
