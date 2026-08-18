# Roomia — Déploiement

Site de réservation de logements. Backend Node.js natif (zéro dépendance npm), SQLite natif, notifications temps réel (SSE), paiements Mobile Money / carte / PayPal / crypto.

## Option recommandée : déploiement unique sur Render (backend + frontend ensemble)

Le backend sait servir le frontend statique lui-même — un seul service à héberger, pas de souci de CORS ni de proxy pour les notifications temps réel (SSE).

### 1. Pousser le code sur GitHub
```bash
cd roomia
git init
git add .
git commit -m "Roomia — premier déploiement"
git remote add origin https://github.com/TON-COMPTE/roomia.git
git push -u origin main
```

### 2. Créer le service sur Render
- Va sur [render.com](https://render.com) → **New → Blueprint** → connecte ton repo GitHub
- Render détecte automatiquement `render.yaml` et propose de créer le service
- Render te demandera de remplir manuellement (car marqués `sync: false`, jamais stockés dans le repo) :
  - `ADMIN_EMAIL` — l'email avec lequel tu te connecteras en admin
  - `ADMIN_PASSWORD` — choisis un mot de passe fort, tu pourras le changer ensuite depuis l'admin
- `JWT_SECRET` est généré automatiquement par Render (`generateValue: true`) — tu n'as rien à faire
- Un disque persistant de 1 Go est monté automatiquement pour que la base SQLite survive aux redéploiements

### 3. Premier démarrage
Au premier lancement, le serveur crée automatiquement ton compte admin à partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD`. La base est vide (aucun logement) — connecte-toi en admin et ajoute tes premiers logements depuis **Logements → Ajouter un logement**, ou lance le seed de démo (voir plus bas) pour partir avec des exemples.

### 4. Configurer tes comptes de paiement
Connecte-toi en admin → **Paiements → Comptes de destination** et remplace les valeurs "À REMPLACER" par :
- **Crypto** : ton adresse de dépôt Binance (ou ton Binance Pay ID)
- **Carte** : ton compte Stripe (ou passerelle équivalente)
- **PayPal** : ton email PayPal professionnel
- **Mobile Money** : ton numéro marchand

Rappel : seule la crypto atterrit automatiquement sur Binance. Les autres canaux nécessitent un reversement manuel régulier (voir la note affichée dans l'admin).

---

## Option alternative : frontend sur Vercel + backend sur Render séparés

Utile si tu veux le frontend derrière un CDN mondial. Deux points d'attention avant de choisir cette option :
- Il faut modifier `vercel.json` avec la vraie URL Render une fois le backend déployé
- **Les notifications temps réel (SSE) ne sont pas garanties de fonctionner de façon fiable à travers un rewrite Vercel vers un domaine externe** (risque de buffering/coupure sur les connexions longues). Teste ce point après déploiement — si les notifications ne remontent pas en direct, reviens à l'option monolithique ci-dessus.

Étapes :
1. Déployer le backend seul sur Render (mêmes variables d'environnement que ci-dessus, mais sans le bloc `disk`/frontend si tu sers uniquement l'API)
2. Éditer `vercel.json` à la racine : remplacer `REMPLACER-PAR-TON-URL-RENDER` par l'URL réelle de ton service Render
3. Sur [vercel.com](https://vercel.com) → **New Project** → importer le repo → Vercel détecte `vercel.json`

---

## Développement local

```bash
cd backend
cp .env.example .env
# éditer .env : définir JWT_SECRET (openssl rand -hex 32), ADMIN_EMAIL, ADMIN_PASSWORD
node server.js        # démarre sur http://localhost:4000 (sert aussi le frontend)
node seed.js           # dans un autre terminal : peuple la base avec des logements de démo (France) + comptes de paiement à compléter
```

Aucune installation npm nécessaire — le backend n'a aucune dépendance externe (Node.js 22+ requis pour `node:sqlite` natif).

## Sécurité — à savoir avant de mettre en production

- Les mots de passe clients sont hachés (scrypt + sel), jamais stockés ni affichés en clair — y compris pour l'admin
- L'accès aux données personnelles complètes d'un client dans l'admin exige une re-saisie du mot de passe admin, et chaque consultation est journalisée (`sensitive_access_log`)
- Un mot de passe client oublié se résout par réinitialisation (mot de passe temporaire à usage unique généré par l'admin), jamais par récupération du mot de passe d'origine
- Change le mot de passe admin par défaut dès la première connexion (**Admin → Paramètres**)
