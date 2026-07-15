# Plan de développement — Mode Coach Deck

## Vision validée

Le mode **Coach Deck** devient la version stratégique du match interactif. Il reste proposé à côté des modes **Automatique** et **Résultat rapide**.

Le joueur ne remplace pas les qualités de son tennisman par des cartes : il exploite temporairement ses qualités, protège ses faiblesses et répond au plan adverse. Les 12 statistiques du profil restent le socle du calcul de chaque point.

Principes retenus pour la première version jouable :

- deck de 12 cartes avant le match ;
- main de 4 cartes à chaque fenêtre de coaching ;
- 5 points de Focus au début de chaque set ;
- une carte maximum par fenêtre de coaching ;
- action gratuite **Laisser jouer** ;
- une carte jouée part dans la défausse ;
- après la décision, la main est renouvelée ;
- quand la pioche est vide, la défausse est mélangée de façon déterministe ;
- les cartes actives durent un nombre clair de points ou de jeux ;
- l’intention adverse est annoncée avant la décision ;
- tous les effets sont prévisualisés avant confirmation.

## Les quatre familles de cartes

### BOOST — renforcer une qualité du joueur

Effet principal sur une ou plusieurs des 12 statistiques, avec une conséquence directe et limitée sur les points concernés.

Exemples : Coup droit puissant, Revers solide, Service canon, Retour agressif, Prendre le filet, Smash autoritaire, Amortie précise, Jambes rapides.

### CONTRE — répondre à l’intention adverse

Ces cartes sont les plus efficaces lorsque le joueur lit correctement le plan affiché. Elles ne donnent jamais une victoire automatique.

Exemples : Protéger le revers, Verrouiller le coup droit, Lire le service, Punir la seconde balle, Fermer le filet, Casser le rythme.

### ÉTAT — agir sur le physique et le mental

Effets sur l’énergie de match, la confiance, le momentum ou le coût des efforts futurs.

Exemples : Second souffle, Rester calme, Hausser l’intensité, Point par point, Gérer l’effort, Repartir de zéro.

### DECK — préparer les prochaines décisions

Effets de pioche, conservation, recherche ou combinaison. Ils créent la profondeur du deckbuilding sans modifier directement le score.

Exemples : Lire le jeu, Préparer le prochain point, Conserver le plan, Recomposer la main.

Le catalogue initial comportera **24 cartes** : 8 Boost, 6 Contre, 6 État et 4 Deck. Un deck de départ équilibré de 12 cartes sera attribué automatiquement à chaque joueur.

## Relation avec le joueur

### Les 12 statistiques

Chaque carte indique ses statistiques principales et secondaires. Sa puissance finale est calculée à partir des valeurs réelles du joueur au début du match, puis figée dans la session afin d’empêcher toute incohérence lors d’une reprise.

Les statistiques utilisées sont : Service, Retour, Coup droit, Revers, Volée, Smash, Amortie, Endurance, Vitesse, Explosivité, Force et Récupération.

Règles d’équilibrage :

- une carte ne masque jamais une grosse faiblesse statistique ;
- une bonne statistique améliore la fiabilité ou la durée, pas seulement la valeur brute ;
- le calcul de base du point et le bonus de la carte ne doivent pas compter deux fois la même qualité ;
- l’écran affiche le gain exact et une estimation **avant / après** de la probabilité du prochain point ;
- une carte standard doit généralement déplacer la probabilité du point de 2 à 6 points de pourcentage ;
- aucune carte seule ne peut déplacer cette probabilité de plus de 12 points.

### Niveau d’expérience

- tous les joueurs reçoivent immédiatement un deck de départ jouable ;
- les niveaux débloquent de nouvelles cartes et des variantes tactiques, jamais un achat de puissance obligatoire ;
- l’usage des cartes accorde de la maîtrise ;
- les paliers de maîtrise ouvrent des variantes latérales : plus courte et forte, plus longue et modérée, ou moins coûteuse mais conditionnelle ;
- la taille du deck et la main restent identiques pour tous.

### Classement

Le classement ne donne pas artificiellement de meilleures cartes. Il détermine :

- la qualité du deck adverse ;
- la profondeur de ses combinaisons ;
- sa capacité à exploiter les faiblesses visibles ;
- la précision de son intention affichée ;
- la diversité des récompenses et de la maîtrise gagnée.

Même à haut niveau, l’intention adverse reste compréhensible. Une éventuelle feinte sera annoncée comme une incertitude, jamais cachée dans le calcul.

## Déroulement d’une fenêtre Coach Deck

1. Le moteur termine la séquence de points en cours.
2. L’interface affiche le score, l’état des deux joueurs et l’intention adverse.
3. Le joueur reçoit une main de 4 cartes.
4. Chaque carte affiche son coût, sa durée, les statistiques utilisées et son résultat estimé.
5. Le joueur sélectionne une carte ou **Laisser jouer**.
6. La carte sélectionnée se lève, s’illumine et affiche **Votre choix**.
7. Le bouton **Confirmer** résume l’action sans ambiguïté.
8. Le serveur vérifie la main, le Focus et la révision de la session.
9. Le moteur applique l’effet puis résout la prochaine séquence.
10. L’historique conserve la carte, l’intention, l’effet réel et le résultat.

## Intention adverse

Une intention contient :

- une famille : attaque, défense, variation, pression physique ou prise de risque ;
- une cible : statistique, zone ou situation de score ;
- une durée ;
- une intensité ;
- une fiabilité d’analyse ;
- une ou plusieurs réponses conseillées.

Elle est produite à partir des statistiques de l’adversaire, des faiblesses du joueur, de la surface, du score, de l’énergie, du momentum et du niveau tactique lié au classement. La génération utilise la graine du match : une session reprise produit exactement les mêmes décisions.

## Données à créer

Les définitions et l’équilibrage des cartes resteront dans le code versionné. La base de données ne stockera que la progression du joueur.

Nouveaux éléments persistants :

- **PlayerCoachCard** : carte débloquée, expérience de maîtrise, niveau et variante ;
- **CoachDeck** : propriétaire, nom, deck actif et version ;
- **CoachDeckCard** : identifiant de carte et position dans le deck ;
- relations correspondantes dans les schémas SQLite et PostgreSQL.

La session de match conservera un instantané complet : deck, pioche, main, défausse, cartes épuisées, Focus, effets actifs, intention adverse et historique des cartes jouées. L’état interactif passera à une nouvelle version avec une migration de compatibilité pour les anciennes sessions.

Le modèle existant **PlayerStatCard**, utilisé pour la progression des statistiques, ne sera pas détourné pour le Coach Deck.

## Éléments graphiques à créer

- cadre responsive des quatre familles de cartes ;
- icônes vectorielles Boost, Contre, État et Deck ;
- 24 pictogrammes ou mini-diagrammes de court ;
- jauge de Focus à cinq points ;
- badge de coût, badge de durée et badge **Votre choix** ;
- bannière d’intention adverse avec niveau de certitude ;
- aperçu visuel avant/après du prochain point ;
- animation courte de sélection, de pioche et d’application ;
- états accessibles : sélection, indisponible, coût insuffisant, actif, défaussé et épuisé.

Ces éléments seront créés en SVG, CSS et composants natifs pour rester nets, légers et fluides sur smartphone. Les joueurs et le stade existants seront réutilisés.

## Architecture prévue

### Moteur de match

Créer un module Coach Deck indépendant dans `packages/match-engine-tennis`, puis le brancher sur le moteur interactif :

- catalogue et validation des cartes ;
- état de pioche déterministe ;
- calcul du Focus ;
- application et expiration des effets ;
- génération des intentions adverses ;
- calcul de l’aperçu avant/après ;
- historique détaillé ;
- stratégie de l’adversaire ;
- compatibilité avec les anciennes consignes pendant la transition.

### Serveur

Créer les services de collection et de decks, puis ajouter :

- lecture du catalogue et de la collection ;
- création, modification et validation d’un deck ;
- choix du deck au lancement du mode Coach ;
- action sécurisée **jouer une carte** ;
- action gratuite **laisser jouer** ;
- attribution de maîtrise à la fin du match ;
- reprise multiappareil avec contrôle de révision déjà utilisé par le match interactif.

### Interface

Découper l’écran actuel en composants réutilisables :

- tableau de score ;
- personnages et court ;
- état du joueur ;
- scouting adverse ;
- intention adverse ;
- main de cartes ;
- aperçu de l’effet ;
- rapport final et historique.

Créer ensuite deux nouveaux écrans :

- **Constructeur de deck** depuis Collection ;
- **Tutoriel Coach Deck** jouable avant le premier vrai match.

L’interface est conçue d’abord pour 667 × 375, 844 × 390 et 915 × 412 en paysage, puis adaptée à 1280 × 720 et 1920 × 1080.

## Plan d’exécution et check-list

### Étape 1 — Règles, formules et catalogue initial

- [x] Créer les types de carte, d’effet, de cible et de durée.
- [x] Écrire les 24 cartes et le deck de départ.
- [x] Définir le coût Focus et les limites de puissance.
- [x] Définir les intentions adverses et leurs contres.
- [x] Écrire des simulations d’équilibrage sans interface.
- [x] Vérifier que les 12 statistiques ont au moins une utilisation claire.

**Terminé lorsque :** 10 000 matchs simulés produisent des résultats cohérents, aucune carte ne domine le catalogue et chaque effet peut être expliqué au joueur.

### Étape 2 — Collection et constructeur de deck

- [x] Ajouter les modèles SQLite et PostgreSQL.
- [x] Créer la migration et l’attribution automatique du deck de départ.
- [x] Créer les services et API de collection/deck.
- [x] Attribuer et réparer automatiquement le deck de départ des anciens comptes.
- [x] Valider exactement 12 cartes et les limites de copies.
- [x] Créer l’écran mobile-first de construction.
- [x] Ajouter filtres, comparaison, coût et statistiques associées.

**Terminé lorsque :** un joueur peut construire, sauvegarder, recharger et sélectionner un deck valide sur mobile et PC.

### Étape 3 — Moteur Coach Deck

- [x] Ajouter main, pioche, défausse, Focus et mélange déterministe.
- [x] Ajouter les effets temporaires et leur expiration.
- [x] Ajouter les intentions et la stratégie adverse.
- [x] Ajouter l’aperçu avant/après calculé par le moteur.
- [x] Sauvegarder tout l’état dans la session.
- [x] Conserver Automatique, Résultat rapide et l’ancien match interactif pendant la transition.

**Terminé lorsque :** une même graine et les mêmes choix donnent exactement le même match, y compris après une reprise.

### Étape 4 — Interface de match fidèle au concept art

- [x] Reproduire la composition du visuel validé.
- [x] Créer les cadres, icônes et diagrammes manquants.
- [x] Afficher clairement intention, Focus, main et effet sélectionné.
- [x] Garantir que la carte choisie reste visible jusqu’à confirmation.
- [x] Ajouter animations courtes et option de réduction des mouvements.
- [x] Vérifier toutes les zones tactiles et zones sûres en paysage.

Validation responsive effectuée sans débordement à 667 × 375, 844 × 390, 915 × 412,
1280 × 720 et 1920 × 1080. La composition 16:9 reprend le stade nocturne, le score
centré séparé en **POINTS / JEUX / SETS**, le tableau des 12 statistiques, le scouting adverse, l’intention, le Focus,
les quatre cartes verticales et les actions latérales de la maquette. La carte choisie
reste levée et lumineuse, son effet avant/après reste affiché et le bouton **Confirmer**
est accessible sans défilement sur chaque résolution.

**Terminé lorsque :** aucune information ou action ne déborde de 667 × 375 à 1920 × 1080 et qu’un nouveau joueur comprend quoi sélectionner sans explication externe.

### Étape 5 — Progression, maîtrise et récompenses

- [ ] Débloquer progressivement les cartes par niveau.
- [ ] Ajouter l’expérience de maîtrise et les variantes latérales.
- [ ] Adapter la stratégie adverse au classement.
- [ ] Afficher clairement les gains de fin de match.
- [ ] Empêcher tout système pay-to-win.

**Terminé lorsque :** la progression augmente les possibilités de construction sans rendre les nouveaux joueurs incapables de gagner.

### Étape 6 — Tutoriel et transparence

- [ ] Créer un match tutoriel scénarisé en trois décisions.
- [ ] Expliquer la relation entre carte, statistique et intention.
- [ ] Montrer le calcul avant/après sans formule complexe.
- [ ] Ajouter l’historique détaillé du match.
- [ ] Ajouter une aide accessible à tout moment.

**Terminé lorsque :** les testeurs savent expliquer pourquoi leur carte était utile ou non et comment augmenter leurs chances de gagner.

### Étape 7 — Qualité, fluidité et bêta

- [ ] Tests unitaires du catalogue, de la pioche et de chaque effet.
- [ ] Tests de service, sécurité, double clic et reprise multiappareil.
- [ ] Tests responsive aux cinq résolutions de référence.
- [ ] Mesure des animations, rendus React et taille des ressources.
- [ ] Simulation d’équilibrage par écart de niveau et classement.
- [ ] Déploiement derrière une activation progressive.
- [ ] Collecte des choix, taux de victoire, cartes dominantes et plaisir.

**Terminé lorsque :** le build complet passe, la session ne peut pas être désynchronisée, l’interface reste fluide et les métriques de bêta ne montrent aucune carte obligatoire.

## Critères de succès de la première bêta

- au moins 80 % des testeurs comprennent l’intention adverse sans ouvrir l’aide ;
- au moins 75 % peuvent expliquer l’effet de leur carte avant de la jouer ;
- aucune carte n’apparaît dans plus de 45 % des decks sans raison de deck de départ ;
- aucun choix unique ne dépasse durablement 58 % de victoire à niveau équivalent ;
- un avantage moyen de 5 points de note globale reste significatif mais renversable ;
- la satisfaction moyenne du mode atteint au moins 4/5 ;
- aucune interaction principale n’exige de défilement en paysage.
