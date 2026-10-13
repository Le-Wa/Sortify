# Animations sur mobile — principes (13 oct. 2026)

Demande de Walid : une UX « Apple grade » pour les petits gains (À trier, comptoir vide, bac qui dort). Ce qui fait la différence sur iPhone, et ce qu'on en retient pour Sortify.

## Principes

1. **Le doigt commande, 1 pour 1.** Pendant un glisser, la carte suit le doigt sans délai ni lissage ; seulement `transform` (jamais `left` / `width`) pour rester à 60–120 images par seconde.
2. **Le geste se lit à la vitesse, pas seulement à la distance.** Un petit coup sec (> 0,5 px/ms) suffit à décider, comme pour fermer une app ; un lent glisser qui ne dépasse pas le seuil revient en place.
3. **Ressort, pas courbe linéaire.** Retour en place et sortie avec une courbe à rebond doux (`cubic-bezier(0.2, 0.8, 0.2, 1)`, ou `linear()` pour un vrai ressort), 200 à 350 ms. Jamais au-delà de 400 ms pour une réponse à un geste.
4. **Le mouvement dit la conséquence.** La carte part du côté choisi (à droite : ranger, à gauche : Divers) et la suivante tombe sur le comptoir : on voit où est allé le titre.
5. **Interruptible.** Un nouveau geste n'attend jamais la fin d'une animation ; la décision est enregistrée tout de suite (optimiste), l'animation n'est que du décor.
6. **Récompenser l'action, pas la visite.** La célébration du comptoir vide ne se joue que si on vient de vider le comptoir ; arriver sur un comptoir déjà vide affiche un écran calme.
7. **Bref et sobre.** Une célébration courte (< 1 s), qui ne bloque rien, sans confettis : les pochettes des bacs servis tombent dans la caisse, le titre se pose.
8. **Animations réduites respectées.** Avec « Réduire les animations » (iPhone) : pas de déplacement ni de rebond, de simples fondus.
9. **Zones tactiles de 44 px**, pas de survol, filtres en puces qui défilent horizontalement.
10. **Retour haptique** : l'iPhone ne le permet pas aux sites web ; sur Android, une vibration très courte (10 ms) quand le seuil de décision est franchi.

## Appliqué ici
- **À trier** : coup sec reconnu, sortie de la carte du côté choisi (260 ms), retour élastique, vibration au franchissement du seuil (Android). Filtres « Incertains » et par bac proposé ; « Tout accepter » ne vaut que pour le filtre affiché.
- **Comptoir vide** : les pochettes des bacs servis pendant la séance tombent l'une après l'autre (décalage de 70 ms), puis « Comptoir vide. » ; prochain tri annoncé.
- **Ce bac dort** : aucune animation (un état calme), une carte sur la page Bacs et une mention dans la liste.
