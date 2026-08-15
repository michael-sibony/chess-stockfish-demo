# Échiquier jouable, Stockfish sur l'appareil

Une partie d'échecs contre un moteur, dans le navigateur, sans serveur
d'analyse. Les règles sont tenues par `chess.js`, l'adversaire est **Stockfish
18 compilé en WebAssembly** qui tourne dans un Web Worker.

Démonstration en ligne : **https://chess-mvp.vercel.app**

Ce dépôt ne cherche pas à être un jeu d'échecs complet. Il montre la couche qui
décide de la qualité d'un jeu d'échecs, le plateau et le moteur, et les quelques
décisions qui séparent une intégration qui tient d'une intégration qui a l'air
de marcher.

```
src/
  lib/
    niveaux.ts       Elo cible vers options UCI, avec la bascule Skill Level
    moteur.ts        client du Web Worker Stockfish, protocole UCI
    echiquier.ts     état de la partie vers affichage et libellés parlés
    *.test.ts        25 tests
  components/
    Echiquier.tsx    le plateau, trois façons de jouer un coup
public/
  moteur/            Stockfish 18 lite single, vendu tel quel
```

## Les quatre décisions qui comptent

**Régler la force, pas la profondeur.** Baisser la profondeur de recherche ne
produit pas un adversaire faible, il produit un adversaire rapide qui reste
tactiquement imbattable sur deux coups. Stockfish expose deux réglages
distincts : `Skill Level`, qui lui fait commettre de vraies erreurs, et
`UCI_LimitStrength` avec `UCI_Elo`, qui vise un Elo cible mais **plancher à
1320**. Sous cette borne, `UCI_Elo` ne fait plus rien. `niveaux.ts` bascule de
l'un à l'autre, et la bascule est testée, parce qu'une erreur ici ne casse rien
de visible : le moteur répond, le jeu tourne, et l'adversaire est simplement au
mauvais niveau pendant des mois.

**Le moteur dans un Web Worker.** Une recherche de 1200 ms sur le fil principal
fige la page pendant 1200 ms. Aucune animation ne rattrape ça.

**La variante mono fil, délibérément.** Stockfish multi fils exige
`SharedArrayBuffer`, donc les en têtes `Cross-Origin-Opener-Policy` et
`Cross-Origin-Embedder-Policy` sur toute l'origine, ce qui casse au passage
l'intégration de la moindre ressource tierce. Pour un adversaire plafonné à
2400 Elo, le mono fil suffit et évite ce piège.

**La partie est une liste de coups, pas une FEN.** Une FEN ne contient pas
l'historique. Stocker seulement la position courante paraît suffisant jusqu'au
moment où la notation affiche `1. e5` après `1. e4 e5`, le coup des noirs étant
devenu le premier coup d'une partie neuve. Rejouer la liste depuis le départ
coûte quelques microsecondes et rend l'annulation triviale.

## Accessible, et vérifiable

Chaque case est un bouton nommé : « d1, dame blanche », « e4, case vide, coup
possible ». L'état de la partie vit dans une région annoncée automatiquement,
donc un mat ne se devine pas au silence. Le coup se joue au glisser déposer, à
l'appui simple, ou au clavier seul.

Le glisser déposer passe par les **Pointer Events** et non par l'API Drag and
Drop du HTML, qui ne se déclenche pas au toucher. Un échiquier mobile qui ne
réagit qu'à la souris est un échiquier mobile qui ne marche pas.

Le rôle `grid` n'est volontairement pas utilisé : il promet une navigation aux
flèches en deux dimensions que cette démonstration n'implémente pas, et annoncer
une sémantique qu'on ne tient pas dessert l'utilisateur.

## Les tests

25 tests, sur les règles et sur les conversions, aucun sur l'affichage.

```bash
npm test
```

Ils ont trouvé trois vrais défauts pendant l'écriture, ce qui est exactement
leur intérêt :

- l'échiquier était **aux couleurs inversées**, `a1` claire au lieu de foncée,
- le féminin de « blanc » était fabriqué en ajoutant un `e`, ce qui donnait
  « dame blance » dans la synthèse vocale,
- la position de test censée illustrer un échec simple ne mettait en fait
  personne en échec.

Un quatrième défaut n'a été trouvé qu'en jouant réellement une partie dans le
navigateur : la notation repartait de zéro à chaque coup. Aucun test unitaire ne
l'aurait vu, et c'est pour ça qu'on ouvre la page avant de dire que c'est fini.

## Essayer

```bash
npm install
npm run dev
```

| Vérification | Commande |
|---|---|
| Tests | `npm test` |
| Types, mode strict | `npm run typecheck` |
| Lint | `npm run lint` |
| Build de production | `npm run build` |

## Ce que ça ne fait pas

Pas de comptes, pas de classement persistant, pas de partie contre un autre
joueur, pas d'achats intégrés. C'est volontaire.

## Le moteur embarqué

`public/moteur/` contient `stockfish-18-lite-single.js` et son `.wasm`, repris
tels quels du paquet npm `stockfish`. Ils sont versionnés plutôt
qu'installés : le paquet complet pèse **348 Mo** parce qu'il embarque tous les
réseaux d'évaluation, alors que la variante utilisée en fait 7,3. Stockfish est
publié sous licence GPL v3.

## Version mobile

La même logique se transpose en React Native avec Expo. `chess.js` est du
JavaScript pur et ne change pas d'une ligne, Stockfish tourne dans une vue
isolée, et le déplacement des pièces passe par Reanimated sur le fil natif, ce
qui tient les 60 images par seconde pendant le glisser.

---

Michael Sibony, [github.com/michael-sibony](https://github.com/michael-sibony)
