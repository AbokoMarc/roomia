# Roomia

Site de réservation de logements (chambres, appartements, maisons) avec un second volet immobilier pour l'achat et la location longue durée.

Stack : Node.js natif (aucun framework serveur), Turso pour la base de données, HTML/CSS/JS vanilla côté front. Pas de build step, pas de bundler.

## Fonctionnement général

- **Réservations courtes** : recherche par ville/dates, fiche logement, réservation, paiement en crypto.
- **Immobilier** : un questionnaire guidé (achat ou location) qui récupère les critères du client et génère une demande consultable côté admin. Pas de listing en temps réel ici, c'est plutôt un formulaire de qualification pour un conseiller.
- **Admin** : gestion des logements, réservations, paiements, demandes immo, utilisateurs. Compte créé automatiquement au démarrage via variables d'env.
- **Notifications** : SSE (Server-Sent Events), pas de WebSocket. Suffisant pour le volume attendu.

## Lancer en local

```bash
cd backend
npm install
cp .env.example .env
```

Éditer `.env` : au minimum `JWT_SECRET` (génère-le avec `openssl rand -hex 32`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Sans `TURSO_DATABASE_URL`, le backend retombe sur un fichier SQLite local (`backend/data/roomia.db`) — pratique pour développer sans dépendre d'un service externe.

```bash
node server.js     # http://localhost:4000
node seed.js        # dans un autre terminal, remplit la base avec quelques logements de démo
```

Vérification rapide que tout tourne :
```bash
curl http://localhost:4000/api/rooms
```

## Base de données : pourquoi Turso

Render (comme la plupart des hébergeurs gratuits) n'a pas de disque persistant sur son plan gratuit. Le service se met en veille après inactivité, et au réveil c'est un conteneur neuf — donc une base SQLite stockée localement repart de zéro à chaque fois. Turso héberge la base ailleurs, donc ça ne pose plus de problème, et son plan gratuit suffit largement pour ce genre de projet.

```bash
turso auth login
turso db create roomia
turso db show roomia --url
turso db tokens create roomia
```

Ça donne `TURSO_DATABASE_URL` (commence par `libsql://`) et `TURSO_AUTH_TOKEN`.

## Déployer sur Render

1. Push sur GitHub, puis sur Render : New → Blueprint (lit `render.yaml` automatiquement) ou New → Web Service en config manuelle.
2. Variables à renseigner : `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`. `JWT_SECRET` est généré tout seul.
3. Plan Free suffit, Turso gère la persistance.

## Paiements

Une seule méthode côté réservation : crypto. Par défaut c'est manuel — le client envoie vers un wallet, colle le hash de transaction, l'admin vérifie sur un explorateur blockchain et valide. Configurable dans Admin → Paiements, aucune variable d'env requise pour ce mode.

Binance Pay peut automatiser tout ça (webhook + confirmation instantanée) si `BINANCE_PAY_API_KEY` et `BINANCE_PAY_SECRET_KEY` sont renseignés. À noter : cette intégration n'a pas pu être testée contre l'API réelle pendant le développement (pas d'accès réseau dans l'environnement de dev), donc à vérifier sérieusement avant de s'y fier avec de vrais paiements. Si un webhook loupe malgré tout, le paiement reste visible dans Admin → Paiements → À vérifier pour validation manuelle.

Côté immobilier, les moyens de paiement affichés (carte, virement SEPA, chèque, espèces...) sont juste informatifs — ces transactions se négocient directement avec le conseiller, rien n'est intégré techniquement là-dessus.

## Sécurité

- Mots de passe hachés (scrypt + sel), jamais en clair nulle part, y compris pour l'admin qui les consulte.
- Accès aux données personnelles d'un client dans l'admin protégé par re-saisie du mot de passe admin, chaque consultation est journalisée.
- Mot de passe client oublié → reset avec mot de passe temporaire à usage unique généré par l'admin, jamais de récupération de l'ancien.
- Pense à changer le mot de passe admin par défaut dès la première connexion (Admin → Paramètres).

## Limitations connues

- Binance Pay non testé en conditions réelles (voir plus haut).
- Pas de gestion de disponibilité en temps réel pour l'immobilier — c'est un formulaire de demande, pas un catalogue.
- Quartiers recherchés en champ texte libre, pas de liste normalisée par ville.
- Pas d'emails automatiques (confirmations, relances) pour l'instant, tout passe par les notifications in-app.
