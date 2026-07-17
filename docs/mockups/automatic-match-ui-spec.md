# Match automatique — spécification de reproduction

Référence visuelle : `automatic-match-mobile-first-v1.png` (1672 × 941, format paysage).

## Intention

L'écran doit donner l'impression d'assister à un match retransmis en direct, tout en expliquant clairement pourquoi chaque point est gagné. La lecture prioritaire est : score, action sur le court, résultat du point, puis détail du calcul.

## Grille verrouillée

- Écran plein : `100dvh`, sans en-tête global ni défilement de page.
- Marge de sécurité : 5 à 12 px selon la hauteur disponible.
- Lignes : tableau de score `16 %`, scène principale `61 %`, replay `23 %`.
- Scène principale : fil du match `23 %`, court `54 %`, analyse du point `23 %`.
- Les panneaux utilisent un fond bleu nuit presque opaque, une bordure cyan faible et un rayon de 6 à 8 px.
- Les titres condensés sont en capitales, blancs ; les informations du joueur A sont vert menthe, celles du joueur B jaune or.

## Palette et surfaces

- Fond : `#020b17`.
- Panneau : dégradé `rgba(7, 24, 38, .97)` vers `rgba(2, 12, 24, .96)`.
- Bordure : `rgba(103, 232, 249, .30)`.
- Joueur A / action positive : `#43e5b0`.
- Joueur B / opposition : `#f4c54e`.
- Texte secondaire : `#9caebe`.
- Erreur / point négatif : `#fb7185`.

## Ressources visuelles

- Court : `/visuals/coach-deck-stadium-v1.webp`.
- Joueur A en action : `/visuals/match/pp-02-forehand.png`.
- Joueur B en action : `/visuals/match/pp-01-backhand.png`.
- Pour les autres portraits, l'avatar du profil reste utilisé dans le tableau de score et les silhouettes d'action servent de représentation cinématique générique.
- La trajectoire, la balle et la mini-carte du terrain sont dessinées en CSS/SVG afin de rester nettes à toutes les résolutions.

## Correspondance des données

- `event.score.sets` → colonne Sets.
- `event.score.games` → colonne Jeux.
- `event.score.points` → colonne Points.
- `event.index` et `events.length` → point courant, progression et chronologie.
- `event.action`, `event.rallyLength`, `event.comment` → bandeau d'action central.
- `event.statKey`, `event.statLabel` → statistique décisive.
- `event.rawStatValues` → statistique de base.
- `event.statValues - event.rawStatValues` → bonus de forme.
- `event.statValues` → total du point.
- `event.position` → position des joueurs, de la balle et direction de trajectoire.
- `match.replay.momentum[index]` → dynamique du match.

Le rapport de force du point est calculé à partir des deux totaux : `A / (A + B)`. Il est uniquement explicatif et ne modifie pas le résultat reçu du serveur.

## États

- Chargement : stade visible, panneau central et progression animée.
- Lecture : avance automatique, son facultatif, vitesse x1/x2/x4.
- Pause : la scène reste affichée et le bouton lecture devient prioritaire.
- Fin : score final conservé, bandeau victoire/défaite, actions retour au hub ou revoir le match.
- Erreur : message lisible, bouton réessayer et retour au duel.

## Adaptation paysage

| Résolution  | Règle                                                                          |
| ----------- | ------------------------------------------------------------------------------ |
| 740 × 360   | Panneaux latéraux compacts, 3 événements visibles, textes secondaires masqués. |
| 844 × 390   | Composition complète, boutons en pictogrammes avec libellés courts.            |
| 915 × 412   | Cible mobile principale ; tous les contrôles sont tactiles (44 px minimum).    |
| 1280 × 720  | Panneaux plus respirants, 5 événements visibles.                               |
| 1672 × 941  | Fidélité 1:1 avec la maquette.                                                 |
| 1920 × 1080 | Contenu centré, proportions conservées, sans étirement des personnages.        |

En portrait étroit, un écran d'orientation demande de tourner l'appareil ; le match reste utilisable après rotation.

## Critères de validation

- Sets, jeux et points sont visibles simultanément.
- Le gagnant et la statistique du point sont compréhensibles sans ouvrir un autre écran.
- Les boutons répondent immédiatement et possèdent un état visuel pressé/focus.
- Aucun panneau ni contrôle ne déborde à 740 × 360, 844 × 390, 915 × 412 et 1920 × 1080.
- La lecture est suspendue lorsque l'onglet n'est plus visible.
- Les médias lourds sont chargés hors du bundle JavaScript et le composant est chargé à la demande.
