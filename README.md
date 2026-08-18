# Roomia — Déploiement

Site de réservation de logements. Backend Node.js + Turso (SQLite hébergé, gratuit et persistant), notifications temps réel (SSE), paiements Mobile Money / carte / PayPal / crypto.

## Pourquoi Turso ?

Le plan gratuit de Render (et de la plupart des hébergeurs gratuits) n'a pas de disque persistant : à chaque redémarrage du service (veille après inactivité), le système de fichiers repart de zéro — et avec lui, toute base SQLite stockée localement. C'est exactement le problème rencontré sur un projet précédent (données qui disparaissaient chaque matin).

Turso héberge la base SQLite **ailleurs**, sur son propre service — donc peu importe que Render redémarre ou mette le conteneur en veille, les données restent. Le plan gratuit de Turso est fait pour ce genre d'usage (petits projets, jusqu'à 500 bases et plusieurs Go de stockage gratuits au moment de la rédaction — vérifie les limites actuelles sur turso.tech, elles évoluent).

---

## Étape 1 — Créer la base Turso

1. Va sur [turso.tech](https://turso.tech) → crée un compte gratuit
2. Installe leur CLI (instructions sur leur site — diffère selon Mac/Linux/Windows), puis :
```bash
turso auth login
turso db create roomia
turso db show roomia --url
turso db tokens create roomia
```
3. Note les deux valeurs obtenues :
   - L'URL (commence par `libsql://...`) → ce sera `TURSO_DATABASE_URL`
   - Le token → ce sera `TURSO_AUTH_TOKEN`

## Étape 2 — GitHub

```bash
cd roomia
git remote add origin https://github.com/TON-COMPTE/roomia.git
git push -u origin main
```
(Le repo local est déjà initialisé avec un premier commit.)

## Étape 3 — Render

- [render.com](https://render.com) → **New → Blueprint** (ou **New → Web Service** si tu préfères configurer à la main, sans passer par `render.yaml`) → connecte ton repo
- Renseigne les variables demandées :
  - `ADMIN_EMAIL`, `ADMIN_PASSWORD` — ton compte admin
  - `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` — récupérées à l'étape 1
- `JWT_SECRET` est généré automatiquement
- Le plan reste **Free** — plus besoin de payer pour la persistance, Turso s'en charge

## Étape 4 — Premier démarrage

Une fois déployé, connecte-toi en admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) et ajoute tes logements, ou lance le seed de démo en local pointé sur ta base Turso (voir ci-dessous) pour partir avec des exemples.

## Étape 5 — Comptes de paiement

Admin → **Paiements → Comptes de destination** → remplace les valeurs "À REMPLACER" (Binance pour la crypto, Stripe/PayPal/Mobile Money pour le reste).

---

## Développement local

**Sans compte Turso** — le plus simple pour développer : ne remplis pas `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` dans `.env`, le backend utilise alors un fichier SQLite local classique (`backend/data/roomia.db`).

```bash
cd backend
npm install
cp .env.example .env
# éditer .env : définir JWT_SECRET (openssl rand -hex 32), ADMIN_EMAIL, ADMIN_PASSWORD
node server.js        # démarre sur http://localhost:4000
node seed.js           # dans un autre terminal : peuple la base avec des logements de démo
```

**Avec Turso en local** (pour tester exactement la config de prod) : remplis `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` dans `.env` avant de lancer `node server.js`.

### ⚠️ Vérification avant de déployer
Cette migration vers Turso a été écrite avec soin mais **n'a pas pu être testée en conditions réelles** dans l'environnement où elle a été développée (pas d'accès internet pour installer le package `@libsql/client`). Avant de déployer sur Render, vérifie en 2 minutes que tout fonctionne en local :
```bash
cd backend
npm install          # doit réussir sans erreur
node server.js        # doit afficher "Compte admin créé" puis "Roomia backend démarré"
```
Puis dans un autre terminal :
```bash
curl http://localhost:4000/api/rooms
# doit répondre {"rooms":[]} (ou une liste si tu as déjà seedé)
```
Si une erreur apparaît au démarrage ou sur cette requête, copie le message et on corrige avant de déployer.

---

## Sécurité — à savoir avant de mettre en production

- Les mots de passe clients sont hachés (scrypt + sel), jamais stockés ni affichés en clair — y compris pour l'admin
- L'accès aux données personnelles complètes d'un client dans l'admin exige une re-saisie du mot de passe admin, et chaque consultation est journalisée (`sensitive_access_log`)
- Un mot de passe client oublié se résout par réinitialisation (mot de passe temporaire à usage unique généré par l'admin), jamais par récupération du mot de passe d'origine
- Change le mot de passe admin par défaut dès la première connexion (**Admin → Paramètres**)
