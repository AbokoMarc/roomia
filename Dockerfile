# Roomia — backend Node.js + client Turso (libSQL, base persistante gratuite).
FROM node:20-alpine

WORKDIR /app

COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend
RUN npm install --omit=dev

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

WORKDIR /app/backend

# Le serveur refuse de démarrer sans JWT_SECRET / ADMIN_EMAIL / ADMIN_PASSWORD définis en variables d'environnement.
# TURSO_DATABASE_URL et TURSO_AUTH_TOKEN sont nécessaires en production (voir backend/.env.example).
CMD ["node", "server.js"]
