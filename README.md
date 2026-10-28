# 🚦 Battleroute — quiz code de la route pour TikTok Live (MVP, mode TEST)

## Lancer en local
```bash
npm install
npm run dev        # http://localhost:5173
npm run build && npm start   # version de prod sur http://localhost:4173
```

## Pages
- **Régie (host)** : `/` ou `/?view=host` — démarrer, question suivante, pause, révéler, thème ou aléatoire, chrono (12 s par défaut), reset des scores, simulation du chat (pseudo + A/B/C/D) et bots de test.
- **Overlay** : `/?view=overlay` — vertical 1080×1920, question, chrono, votes en direct, réponse + explication, top 5 des joueurs.

La régie pilote la partie ; l’overlay se synchronise via BroadcastChannel + localStorage (**même navigateur / même profil**).

## Ajouter l’overlay dans OBS
Comme OBS a son propre navigateur, ouvre **aussi la régie dans OBS** :
1. *Docks → Docks de navigateur personnalisés* → nom « Battleroute », URL `https://TON-SITE/?view=host`.
2. Source → *Navigateur* → URL `https://TON-SITE/?view=overlay`, largeur **1080**, hauteur **1920**.
3. Pilote la partie depuis le dock. (En dehors d’OBS : ouvre les deux URLs dans deux onglets du même navigateur.)

## Points
1ᵉʳ bon : 100, 2ᵉ : 80, 3ᵉ : 60, les autres : 40, + jusqu’à 20 pts de bonus vitesse. Une seule réponse par pseudo et par question.

## Questions
`public/questions.json` (copie de `questions/code-de-la-route-v1.json`, 83 questions, 9 thèmes). À faire relire avant un vrai live.

## La suite
La connexion au chat TikTok Live (commentaires → réponses, cadeaux → bonus) viendra plus tard, avec un petit serveur relais et un état partagé (Redis/KV) pour ne plus dépendre d’un seul navigateur.

## Déploiement
Vercel : framework Vite, build `npm run build`, dossier de sortie `dist` (`vercel.json` inclus).

## 🔴 Mode LIVE TikTok (serveur de jeu)

Le jeu en vrai sur TikTok nécessite le serveur Node `server/` (Express + WebSocket + `tiktok-live-connector`).
Sans serveur (`VITE_SERVER_URL` vide), le site reste en **mode test local** (BroadcastChannel, même navigateur).

### Déroulé
1. Ouvre le dashboard : `https://battleroute.vercel.app/?view=host` → un **code salle** (ex. `K7QX2`) est généré (gardé dans l’onglet).
2. Lance ton live TikTok, puis dans **TikTok Live** tape ton pseudo (`@ton_pseudo`) → **Connecter**. Statut : 🟢 LIVE / ⚪ Hors ligne / 🔴 Erreur.
3. Dans OBS, source navigateur 1080×1920 : `https://battleroute.vercel.app/?view=overlay&room=K7QX2` (URL affichée + bouton Copier dans le dashboard).
4. Les viewers écrivent **A, B, C ou D** dans le chat (« b », « réponse C », « D!! » marchent). 1 réponse par personne et par question ; points : 100/80/60/40 + bonus vitesse jusqu’à 20.
5. Le simulateur de chat et les bots restent dispo pour tester.

Pour reprendre une salle depuis un autre PC : `?view=host&room=K7QX2`.

### Variables d’environnement
| Où | Variable | Valeur |
|---|---|---|
| Vercel (front) | `VITE_SERVER_URL` | URL du serveur, ex. `https://battleroute-server.onrender.com` (rebuild nécessaire) |
| Render (serveur) | `PORT` | fourni par Render (défaut 3001) |
| Render | `ALLOWED_ORIGINS` | optionnel, liste séparée par des virgules (défaut `https://battleroute.vercel.app` ; localhost toujours autorisé) |
| Render | `TIKTOK_SESSION_ID` | optionnel, si TikTok bloque les connexions anonymes |

### Déploiement Render
Web Service Node, **Root Directory** `server`, Build `npm install`, Start `npm start`, health check `/health` (voir `render.yaml`).
⚠️ Plan gratuit Render : le serveur s’endort après 15 min sans trafic → ouvre le dashboard quelques minutes avant le live.
L’état des parties est en mémoire (perdu au redémarrage).

### Local
```
cd server && npm install && npm start          # :3001
VITE_SERVER_URL=http://localhost:3001 npm run dev
```

### ⚠️ Risque connecteur non officiel
`tiktok-live-connector` n’est pas une API officielle TikTok : il peut casser du jour au lendemain si TikTok change son système, ou être limité (rate-limit, IP datacenter bloquée). Si la connexion échoue, le jeu reste jouable via le simulateur. Les cadeaux sont seulement journalisés pour l’instant.

### Images
36 questions ont une illustration (panneaux français, Wikimedia Commons, domaine public / licences libres), copiées dans `public/images/` pour fiabilité OBS.
La banque est aussi copiée dans `server/questions.json` : après modification de `public/questions.json`, recopier le fichier.
