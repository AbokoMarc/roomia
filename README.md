# Roomia — Déploiement

Site de réservation de logements. Backend Node.js + Turso (SQLite hébergé, gratuit et persistant), notifications temps réel (SSE), paiements carte / PayPal / crypto.

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

## Étape 5 — Paiements automatiques

Les 3 méthodes (carte, PayPal, crypto) sont **automatiques** : le client paie sur la page hébergée de la gateway, un webhook confirme le paiement à Roomia, la réservation se confirme toute seule — sans aucune action de ta part. Chaque méthode se désactive proprement (le client la voit juste indisponible) si ses variables ne sont pas encore configurées, donc tu peux les activer une par une, à ton rythme.

### Flutterwave (carte bancaire)

1. Crée ton compte sur [flutterwave.com](https://flutterwave.com)
2. Reste en **mode Test** pour commencer (bascule visible dans le tableau de bord)
3. **Réglages → API** → copie ta **Clé secrète** (`FLWSECK_TEST-...` en test)
4. **Réglages → Webhooks** → renseigne :
   - URL : `https://TON-URL-RENDER.onrender.com/api/payments/flutterwave/webhook`
   - "Secret Hash" : invente une valeur secrète (une longue chaîne aléatoire), note-la précieusement
5. Sur Render → **Environment** → ajoute `FLUTTERWAVE_SECRET_KEY` (ta clé secrète) et `FLUTTERWAVE_WEBHOOK_SECRET_HASH` (la même valeur que celle mise dans Flutterwave à l'étape 4)
6. Configure ton compte bancaire de règlement (ton compte "Neero") directement dans **Réglages → Comptes bancaires** sur Flutterwave — Roomia n'a pas besoin de connaître cette information, Flutterwave s'en charge lui-même

### PayPal

1. Crée une app sur [developer.paypal.com](https://developer.paypal.com/dashboard/applications) (reste en **Sandbox** pour tester d'abord)
2. Copie le **Client ID** et le **Secret**
3. Dans la même app → **Webhooks → Add Webhook** :
   - URL : `https://TON-URL-RENDER.onrender.com/api/payments/paypal/webhook`
   - Événement à écouter : `CHECKOUT.ORDER.APPROVED`
   - Note l'ID du webhook affiché
4. Sur Render → ajoute `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` (laisse `PAYPAL_ENV=sandbox` pour tester)

### Crypto — paiement manuel (wallet perso)

Contrairement à la carte et PayPal, la crypto n'est pas automatisée : le client envoie lui-même le montant à ton adresse wallet, colle le hash de sa transaction, et tu valides après vérification. C'est un choix volontaire pour rester simple (pas de KYC, pas de compte de processeur à créer).

1. Connecte-toi en admin → **Paiements → Wallet crypto**
2. Renseigne ton adresse wallet (celle où tu veux recevoir les paiements) et une note sur le réseau accepté (ex : "USDC sur le réseau Base uniquement") — c'est tout, rien à configurer sur Render
3. Quand un client paie, son paiement apparaît dans **Admin → Paiements → À vérifier** avec le hash de transaction qu'il a fourni
4. Vérifie ce hash sur un explorateur blockchain public (par exemple etherscan.io pour Ethereum/USDC, blockchair.com pour Bitcoin) pour confirmer que le montant correct est bien arrivé, puis clique **Valider**

**Filet de sécurité pour carte/PayPal** : si un webhook échoue exceptionnellement à arriver, le paiement reste aussi visible dans **Admin → Paiements → À vérifier**, où tu peux le valider manuellement après avoir confirmé sur le tableau de bord Flutterwave/PayPal que l'argent est bien arrivé.

**Pour passer en argent réel** (carte/PayPal) plus tard : bascule chaque gateway en mode Live/Production dans son propre tableau de bord, récupère les nouvelles clés live, remplace les variables sur Render (pour PayPal, passe aussi `PAYPAL_ENV=live`). Aucune ligne de code à changer.

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
Cette migration vers Turso, ainsi que les intégrations Flutterwave et PayPal, ont été écrites avec soin mais **n'ont pas pu être testées en conditions réelles** dans l'environnement où elles ont été développées (pas d'accès internet pour appeler leurs APIs). Avant de déployer sur Render, vérifie en quelques minutes que tout fonctionne en local :
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
