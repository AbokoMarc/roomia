// Charge .env nativement (Node 20.6+) avant tout le reste.
try {
  process.loadEnvFile();
} catch {
  // Pas de fichier .env trouvé — on utilise les variables d'environnement système (cas prod/Render).
}
