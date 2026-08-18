# Roomia — backend Node.js natif (zéro dépendance npm) qui sert aussi le frontend statique.
# Node 22 requis pour node:sqlite (natif) et process.loadEnvFile() (natif).
FROM node:22-alpine

WORKDIR /app

COPY backend ./backend
COPY frontend ./frontend

RUN mkdir -p /app/backend/data
VOLUME ["/app/backend/data"]

ENV NODE_ENV=production
ENV DB_PATH=/app/backend/data/roomia.db
ENV PORT=4000
EXPOSE 4000

WORKDIR /app/backend

# Le serveur refuse de démarrer sans JWT_SECRET / ADMIN_EMAIL / ADMIN_PASSWORD définis en variables d'environnement.
# Voir backend/.env.example pour la liste complète.
CMD ["node", "server.js"]
