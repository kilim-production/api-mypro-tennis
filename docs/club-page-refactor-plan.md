# Refonte de la page Club

Référence visuelle : `docs/mockups/club-mobile-first-v1.png`

Objectif : reproduire fidèlement la maquette validée en paysage mobile-first, conserver toutes les fonctionnalités actuelles du Club et obtenir la même composition jusqu’en 1080p, sans revenir à une présentation générique de site web.

## Principes non négociables

- La page est conçue d’abord pour un smartphone utilisé horizontalement.
- La version PC conserve la même composition, les mêmes panneaux et la même hiérarchie ; seule l’échelle évolue.
- L’écran principal tient dans la hauteur utile du téléphone, sans défilement global parasite.
- Les zones tactiles essentielles mesurent au moins 44 px avant mise à l’échelle.
- La direction artistique reprend exactement le hub, la Collection et les Compétences : bleu nuit, panneaux denses, traits cyan, vert menthe actif, or pour les événements importants et rouge uniquement pour les alertes.
- Tous les montants utilisent `CR`. Aucun symbole euro ne doit apparaître.
- Toutes les données restent dynamiques et proviennent des API Club existantes.
- La refonte ne modifie pas les règles serveur du championnat, des cotisations, des adhésions ou des bâtiments.

## Inventaire fonctionnel à conserver

### État avec un club

- identité, tag, description et niveau compétitif du club ;
- président, membres, capacité et places libres ;
- classement minimum et cotisation ;
- trésorerie du club ;
- championnat par équipe, composition des cinq titulaires, classement et calendrier ;
- paiement et statut de la cotisation ;
- détails des rencontres, résultats des cinq simples, résumé ou replay ;
- complexe, centre de soins et centre d’entraînement ;
- progression, bonus, niveaux et amélioration de chaque bâtiment ;
- liste des membres et accès à leur profil ;
- demandes d’adhésion, acceptation et refus par le président ;
- réglages du club ;
- départ du club, transmission de la présidence ou revente du club si nécessaire.

### État sans club

- liste des clubs disponibles ;
- critères d’entrée, capacité, cotisation et niveau compétitif ;
- demande d’adhésion et état de demande en attente ;
- création d’un club pour `5 000 CR` ;
- nom, sigle, description, classement minimum et cotisation du nouveau club ;
- blocage explicite si le joueur ne remplit pas les conditions.

## Assets

### Assets existants à réutiliser

- fond de stade et éclairages du hub ;
- logo MYPRO TENNIS ;
- portraits et avatars de joueurs ;
- illustrations des bâtiments dans `public/visuals/club/` ;
- icônes Lucide déjà utilisées pour trophée, bâtiment, effectif, demandes, crédits, réglages, sortie et validation.

### Éléments à construire en CSS/SVG

- blason principal `MP` du club et variantes compactes ;
- blasons secondaires des adversaires ;
- barre de navigation à quatre onglets ;
- tableau de classement compact ;
- cartes des cinq titulaires ;
- états payé, non payé, éligible, complet et en attente ;
- encadrements actifs, notification rouge et bandeau de statut inférieur ;
- squelettes de chargement ayant exactement les dimensions des panneaux finaux.

Les blasons seront dessinés en SVG/CSS afin de rester nets sur smartphone et en 1080p. Une image bitmap ne sera ajoutée que si la comparaison finale démontre qu’un élément ne peut pas être reproduit fidèlement autrement.

## Étape 1 — Architecture dédiée et gel des comportements

Extraire la page Club actuellement contenue dans `App.tsx` vers une architecture isolée :

- `src/components/club/ClubPage.tsx` pour l’orchestration ;
- `src/components/club/club.css` pour la scène mobile-first ;
- `src/components/club/types.ts` pour les modèles Club et championnat ;
- `src/components/club/clubUtils.ts` pour les libellés, bâtiments, cotisations et formats ;
- sous-composants dédiés au championnat, aux infrastructures, à l’effectif, aux demandes et à la découverte des clubs.

Conserver les appels existants :

- `/clubs/me` et `/clubs` ;
- création, adhésion, paramètres, départ et décisions de demandes ;
- `/clubs/team` et `/clubs/team/championship` ;
- `/clubs/dues/pay` ;
- routes d’amélioration des trois bâtiments.

### Validation

- [x] La nouvelle page reçoit les mêmes données que l’ancienne.
- [x] Aucun endpoint ni règle métier n’est modifié pendant l’extraction.
- [x] Les états avec club, sans club et demande en attente restent accessibles.
- [x] Les erreurs API disposent d’un message visible et d’une action de réessai.

## Étape 2 — Shell plein écran et en-tête

Construire la scène sur `100dvh` avec safe areas Android/iOS, fond de stade assombri et grille à hauteur contrôlée.

Reproduire l’en-tête de la maquette :

- retour ;
- logo MYPRO TENNIS ;
- titre `MON CLUB` ;
- crédits personnels ;
- budget du club ;
- aide ;
- réglages ;
- fermeture.

Le budget du club est prioritaire. Sur les plus petites largeurs, les libellés secondaires diminuent avant les valeurs et les icônes.

### Validation

- [x] L’en-tête tient sur une ligne à 915 × 412.
- [x] `CRÉDITS` et `BUDGET DU CLUB` ne débordent jamais.
- [x] Les boutons d’icône sont accessibles et tactiles.
- [x] Les valeurs se mettent à jour après paiement ou amélioration.

## Étape 3 — Navigation principale à quatre onglets

Reproduire les quatre onglets de la maquette :

1. `CHAMPIONNAT` avec le niveau compétitif ;
2. `INFRASTRUCTURES` avec le nombre de bâtiments ;
3. `EFFECTIF` avec `membres/capacité` ;
4. `DEMANDES` avec le nombre en attente et le badge rouge.

Un onglet actif utilise le halo menthe et le trait inférieur. L’onglet change seulement la zone de contenu : l’en-tête et l’identité du club ne sont pas reconstruits.

### Validation

- [x] L’état actif est immédiatement identifiable.
- [x] Le changement d’onglet est instantané et ne relance pas toutes les requêtes.
- [x] Le badge des demandes disparaît à zéro.
- [x] Le dernier onglet utilisé peut être conservé pendant la session.

## Étape 4 — Fiche permanente du club

Reproduire la colonne gauche :

- nom, tag et blason ;
- niveau du club ;
- membres et barre de capacité ;
- président ;
- classement requis ;
- cotisation ;
- trésorerie ;
- évolution de la trésorerie sur la saison si la donnée est disponible ;
- bouton `PARAMÈTRES DU CLUB` réservé au président.

Le panneau reste visible dans les quatre onglets. Sur l’état sans club, il est remplacé par le profil du joueur et le résumé des conditions de création ou d’adhésion.

### Validation

- [x] Toutes les valeurs correspondent à `/clubs/me`.
- [x] Le blason reste net et lisible à toutes les résolutions.
- [x] Les informations longues ne poussent aucun panneau hors écran.
- [x] Les commandes réservées au président ne sont jamais proposées à un membre.

## Étape 5 — Onglet Championnat fidèle à la maquette

Construire la zone centrale avec trois sous-vues : `ÉQUIPE`, `CLASSEMENT` et `CALENDRIER`.

### Vue Équipe

- prochaine journée, date et horaire ;
- club domicile, club extérieur et blasons ;
- division ;
- bouton `VOIR LA RENCONTRE` ;
- cinq titulaires numérotés, avatar, nom, classement et statut de cotisation ;
- état incomplet si moins de cinq joueurs sont éligibles ;
- action de création de l’équipe ou d’inscription au championnat pour le président.

### Vue Classement

- rang, club, points de simples, victoires, différence de sets, différence de jeux et prime ;
- surbrillance du club du joueur ;
- zones de montée et de descente ;
- prochaine journée.

### Vue Calendrier

- journées `J1` à `J13` ;
- journée actuelle clairement sélectionnée ;
- rencontres et horaires ;
- cinq simples et scores détaillés ;
- accès au replay ou au résumé des rencontres terminées.

### Validation

- [x] Les cinq titulaires sont ordonnés comme dans la logique actuelle.
- [x] Les jeux, sets et points de simples sont tous visibles dans le classement détaillé.
- [x] Le bouton de rencontre ouvre le bon état, sans route morte.
- [x] Les calendriers vides, championnats terminés et journées exemptes sont couverts.
- [x] Les résumés et replays existants fonctionnent toujours.

## Étape 6 — Classement et cotisation latéraux

Reproduire la colonne droite de la maquette :

- aperçu des cinq premiers clubs ;
- ligne du club joueur en vert menthe ;
- bouton vers le classement complet ;
- montant de la cotisation ;
- état `PAYÉE · À JOUR`, `À PAYER`, `ACCÈS LIBRE` ou `FENÊTRE FERMÉE` ;
- nombre de joueurs éligibles et barre de progression ;
- accès rapide au calendrier ;
- bouton de paiement lorsque l’API l’autorise.

### Validation

- [x] Le paiement ne peut être envoyé qu’une seule fois.
- [x] Le budget du club et le statut du joueur se mettent à jour immédiatement.
- [x] Les quatre états de cotisation ont des couleurs et libellés distincts.
- [x] Le top 5 et le classement complet utilisent la même source de données.

## Étape 7 — Onglet Infrastructures

Adapter les trois cartes existantes à la nouvelle scène sans perdre leur richesse :

- complexe ;
- centre de soins ;
- centre d’entraînement.

Chaque carte conserve illustration, niveau actuel, bonus, progression, aperçu des niveaux, prochaine amélioration, coût et état du bouton. Les trois cartes restent visibles simultanément en mode horizontal ; les détails de niveaux s’ouvrent dans un panneau ou une modale dédiée afin de ne pas agrandir la page.

### Validation

- [x] Les trois bâtiments et leurs illustrations sont présents.
- [x] Les niveaux 0 à 5 et leurs bonus sont exacts.
- [x] Le coût est comparé au budget réel du club.
- [x] Seul le président peut améliorer un bâtiment.
- [x] L’amélioration actualise le bonus et la trésorerie sans rechargement complet.

## Étape 8 — Onglets Effectif et Demandes

### Effectif

- grille compacte des membres ;
- avatar, nom, classement, niveau et rôle ;
- accès au profil ;
- président visuellement distingué ;
- statut d’éligibilité au championnat lorsque pertinent.

### Demandes

- candidat, classement, niveau et message ;
- actions `ACCEPTER` et `REFUSER` ;
- état vide ;
- message spécifique pour un membre non président ;
- mise à jour immédiate du badge et de la capacité après décision.

### Validation

- [x] Chaque membre ouvre le bon profil.
- [x] L’effectif reste lisible avec 5, 20, 35 ou 50 membres.
- [x] Une décision de demande ne peut pas être envoyée deux fois.
- [x] Un club complet bloque proprement l’acceptation.

## Étape 9 — Création et recherche d’un club

Créer une variante visuelle de la même page pour les joueurs sans club :

- mêmes en-tête, fond, densité et navigation ;
- sous-onglets `REJOINDRE` et `CRÉER` ;
- liste compacte des clubs avec tag, président, places, niveau, classement requis, cotisation et description ;
- recherche et filtres si la liste devient longue ;
- formulaire de création reprenant tous les champs existants ;
- coût `5 000 CR` et crédits disponibles ;
- demande en attente visible et non ambiguë.

### Validation

- [x] Les conditions de chaque club sont compréhensibles avant la demande.
- [x] Les boutons expliquent pourquoi ils sont bloqués.
- [x] La création impossible pour crédits insuffisants est explicite.
- [x] Une demande en attente empêche les demandes concurrentes comme aujourd’hui.

## Étape 10 — Modales et actions sensibles

Reproduire dans la nouvelle DA :

- paramètres du club ;
- détail d’une rencontre ;
- résumé/replay ;
- paiement de cotisation si une confirmation est retenue ;
- départ du club ;
- choix du nouveau président ;
- revente automatique du club lorsqu’il ne reste que le président.

Les modales restent contenues dans la safe area, disposent d’un fond opaque lisible et conservent une action principale unique.

### Validation

- [x] Aucun texte de modale ne passe derrière l’interface.
- [x] Les actions destructrices demandent une confirmation explicite.
- [x] La transmission de présidence est obligatoire lorsqu’elle doit l’être.
- [x] Le bouton retour ferme d’abord la modale avant de quitter la page.

## Étape 11 — Adaptation smartphone et 1080p

Utiliser une scène logique proche de la maquette puis la mettre à l’échelle avec `clamp()`, variables CSS et ratios de colonnes stables.

Résolutions de contrôle :

- 915 × 412 : smartphone horizontal compact ;
- 1080 × 480 : smartphone horizontal large ;
- 1280 × 720 : petit PC ;
- 1920 × 1080 : PC 1080p.

Sur faible hauteur, réduire dans cet ordre : marges, espacements, textes secondaires, hauteur des portraits. Ne jamais supprimer les actions principales, changer l’ordre des colonnes ou transformer la page en version mobile verticale différente.

### Validation

- [x] Aucun défilement horizontal.
- [x] Aucun panneau ne passe sous les contrôles système du téléphone.
- [x] Les trois colonnes du championnat restent visibles sur smartphone.
- [x] Les listes longues utilisent un défilement interne clairement délimité.
- [x] La version 1080p remplit l’espace sans agrandir excessivement les textes.

## Étape 12 — Fluidité, accessibilité et chargement

- charger `/clubs/me` et `/clubs` en parallèle uniquement lorsque nécessaire ;
- charger le championnat à l’ouverture de son onglet, puis conserver son résultat en mémoire ;
- ne rafraîchir que le bloc affecté après une action ;
- remplacer les écrans vides par des squelettes aux dimensions finales ;
- limiter les animations à `opacity` et `transform` ;
- respecter `prefers-reduced-motion` ;
- ajouter les noms accessibles aux boutons à icône et aux onglets ;
- préserver le contraste des états désactivés.

### Validation

- [x] Aucun écran blanc ni saut majeur pendant le chargement.
- [x] Les onglets déjà ouverts réapparaissent immédiatement.
- [x] Les actions bloquent les doubles requêtes.
- [x] La page reste fluide sur smartphone et PC.

## Étape 13 — Tests et comparaison finale

### Tests fonctionnels

- club membre et club président ;
- joueur sans club ;
- demande d’adhésion en attente ;
- club plein ;
- championnat absent, planifié, en cours et terminé ;
- équipe incomplète et complète ;
- cotisation gratuite, payable, payée et fermée ;
- amélioration possible, budget insuffisant et niveau maximum ;
- aucune demande et plusieurs demandes ;
- départ simple, transmission de présidence et revente.

### Contrôle visuel

- captures aux quatre résolutions de référence ;
- comparaison côte à côte avec `club-mobile-first-v1.png` ;
- correction des écarts de taille, alignement, couleur, rayon, contraste et densité ;
- test tactile sur smartphone réel ;
- test clavier et souris sur PC.

### Définition de terminé

- [x] La vue Championnat reproduit fidèlement la maquette validée.
- [x] Les quatre onglets utilisent la même structure et la même direction artistique.
- [x] Toutes les fonctions de l’ancienne page Club sont conservées.
- [x] Les états sans club et demande en attente sont complets.
- [x] Aucun symbole euro n’est présent.
- [x] Aucun débordement n’apparaît sur smartphone horizontal.
- [x] La page reste nette, dense et proportionnée en 1080p.
- [x] Les tests, le build Web et le build Netlify passent.
- [x] La copie GitHub Desktop est synchronisée après validation.

## Ordre d’exécution recommandé

1. extraction technique sans changement fonctionnel ;
2. shell, en-tête et navigation ;
3. fiche du club ;
4. championnat, classement et cotisation ;
5. infrastructures ;
6. effectif et demandes ;
7. création/recherche de club ;
8. modales et actions sensibles ;
9. responsive, fluidité et accessibilité ;
10. comparaison visuelle, tests, build et synchronisation.
