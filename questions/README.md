# Banque de questions Battleroute

`code-de-la-route-v1.json` : questions de quiz code de la route pour les lives TikTok Battleroute.

**Contenu original** : rédigé à partir de règles générales et publiques du Code de la route. Aucune question n'est copiée ni paraphrasée d'éditeurs d'examens (Codes Rousseau, ENPC, etc.). À faire relire avant usage public : les règles peuvent évoluer.

## Schéma
Racine : `version`, `locale`, `game`, `source_note`, `themes` (liste), `questions`.

Chaque question :
- `id` : `br-001`, `br-002`…
- `theme` : une des valeurs de `themes`
- `difficulty` : 1 (facile) à 3 (difficile)
- `question` : texte lisible à voix haute
- `choices` : 3 ou 4 objets `{key: "A".."D", text}`
- `answer` : clé de la bonne réponse
- `explanation` : phrase courte (≤ ~120 car.) pour le reveal
- `image` : `null` pour l'instant (URL Wikimedia Commons possible plus tard, ex. questions taguées `panneaux`)
- `tags` : mots-clés
