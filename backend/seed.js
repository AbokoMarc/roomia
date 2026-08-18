import './env.js';
import { db } from './db.js';

const rooms = [
  {
    title: 'Chambre lumineuse dans le Marais', type: 'chambre', city: 'Paris', country: 'France',
    address: 'Le Marais, Paris', latitude: 48.8606, longitude: 2.3622,
    description: "Chambre chaleureuse dans un appartement haussmannien du Marais, à deux pas des musées et des cafés. Wifi fibre, literie premium, salle de bain partagée impeccable.",
    price_per_night: 95, capacity_adults: 2, capacity_children: 1, bedrooms: 1, beds: 1, bathrooms: 1,
    amenities: ['Wifi', 'Chauffage', 'Télévision', 'Eau chaude', 'Petit-déjeuner'],
    images: ['https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=1200', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1200'],
    featured: 1,
  },
  {
    title: 'Appartement moderne à Lyon Presqu\'île', type: 'appartement', city: 'Lyon', country: 'France',
    address: 'Presqu\'île, Lyon', latitude: 45.7640, longitude: 4.8357,
    description: "Bel appartement 2 chambres entièrement meublé et équipé, au cœur de la Presqu'île lyonnaise. Idéal pour un séjour affaires ou en famille.",
    price_per_night: 120, capacity_adults: 4, capacity_children: 2, bedrooms: 2, beds: 2, bathrooms: 2,
    amenities: ['Wifi', 'Cuisine équipée', 'Ascenseur', 'Lave-linge', 'Parking'],
    images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1200', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1200'],
    featured: 1,
  },
  {
    title: 'Maison familiale avec jardin près de Bordeaux', type: 'maison', city: 'Bordeaux', country: 'France',
    address: 'Caudéran, Bordeaux', latitude: 44.8560, longitude: -0.6050,
    description: "Maison spacieuse avec jardin privé, 3 chambres, idéale pour un séjour en famille ou entre amis. Quartier calme à quelques minutes du centre.",
    price_per_night: 165, capacity_adults: 6, capacity_children: 3, bedrooms: 3, beds: 4, bathrooms: 2,
    amenities: ['Wifi', 'Jardin', 'Parking', 'Cuisine équipée', 'Chauffage', 'Terrasse'],
    images: ['https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1200', 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?q=80&w=1200'],
    featured: 1,
  },
  {
    title: 'Studio cosy près du Vieux-Port', type: 'appartement', city: 'Marseille', country: 'France',
    address: 'Vieux-Port, Marseille', latitude: 43.2951, longitude: 5.3742,
    description: "Studio pratique et bien situé près du Vieux-Port, à proximité des ferries et du centre des affaires. Parfait pour un séjour court en solo ou en couple.",
    price_per_night: 70, capacity_adults: 2, capacity_children: 0, bedrooms: 1, beds: 1, bathrooms: 1,
    amenities: ['Wifi', 'Climatisation', 'Télévision', 'Eau chaude'],
    images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1200'],
    featured: 0,
  },
  {
    title: 'Chambre privée avec vue sur les Alpes', type: 'chambre', city: 'Annecy', country: 'France',
    address: 'Vieille ville, Annecy', latitude: 45.8992, longitude: 6.1294,
    description: "Chambre paisible avec vue sur les montagnes, idéale pour les amoureux de nature et de randonnée au bord du lac.",
    price_per_night: 78, capacity_adults: 2, capacity_children: 1, bedrooms: 1, beds: 1, bathrooms: 1,
    amenities: ['Wifi', 'Vue montagne', 'Petit-déjeuner', 'Parking'],
    images: ['https://images.unsplash.com/photo-1590073242678-70ee3fc28f8e?q=80&w=1200'],
    featured: 0,
  },
  {
    title: 'Villa avec piscine à Nice', type: 'maison', city: 'Nice', country: 'France',
    address: 'Cimiez, Nice', latitude: 43.7180, longitude: 7.2650,
    description: "Villa de standing avec vue mer et piscine privée. Le lieu parfait pour un séjour balnéaire sur la Côte d'Azur.",
    price_per_night: 340, capacity_adults: 8, capacity_children: 4, bedrooms: 4, beds: 5, bathrooms: 3,
    amenities: ['Wifi', 'Piscine privée', 'Vue mer', 'Cuisine équipée', 'Climatisation', 'Parking'],
    images: ['https://images.unsplash.com/photo-1613977257363-707ba9348227?q=80&w=1200', 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=1200'],
    featured: 1,
  },
  {
    title: 'Loft étudiant proche campus', type: 'appartement', city: 'Lille', country: 'France',
    address: 'Vauban-Esquermes, Lille', latitude: 50.6285, longitude: 3.0424,
    description: "Petit appartement fonctionnel idéal pour un séjour d'études, à 5 minutes à pied du campus universitaire.",
    price_per_night: 45, capacity_adults: 1, capacity_children: 0, bedrooms: 1, beds: 1, bathrooms: 1,
    amenities: ['Wifi', 'Bureau', 'Cuisine équipée', 'Chauffage'],
    images: ['https://images.unsplash.com/photo-1554995207-c18c203602cb?q=80&w=1200'],
    featured: 0,
  },
];

const existing = db.prepare('SELECT COUNT(*) c FROM rooms').get().c;
if (existing > 0) {
  console.log(`ℹ️  ${existing} logement(s) déjà en base — seed ignoré (supprime data/roomia.db pour reseed).`);
} else {
  const insert = db.prepare(`
    INSERT INTO rooms (title, type, description, city, country, address, latitude, longitude, price_per_night,
      capacity_adults, capacity_children, bedrooms, beds, bathrooms, amenities, images, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of rooms) {
    insert.run(r.title, r.type, r.description, r.city, r.country, r.address, r.latitude, r.longitude, r.price_per_night,
      r.capacity_adults, r.capacity_children, r.bedrooms, r.beds, r.bathrooms,
      JSON.stringify(r.amenities), JSON.stringify(r.images), r.featured);
  }
  console.log(`✅ ${rooms.length} logements de démo insérés.`);
}

const promoExisting = db.prepare('SELECT COUNT(*) c FROM promo_codes').get().c;
if (promoExisting === 0) {
  db.prepare('INSERT INTO promo_codes (code, percent_off, active) VALUES (?, ?, 1)').run('BIENVENUE10', 10);
  console.log('✅ Code promo BIENVENUE10 (-10%) créé.');
}

const payoutExisting = db.prepare('SELECT COUNT(*) c FROM payout_accounts').get().c;
if (payoutExisting === 0) {
  const payouts = [
    {
      method: 'crypto', label: 'Portefeuille Binance (USDT/BTC)',
      destination: 'À REMPLACER : ton adresse de dépôt Binance (ou ton Binance Pay ID)',
      settlement_note: 'Réception directe et automatique sur Binance — aucune étape manuelle nécessaire.',
    },
    {
      method: 'carte', label: 'Compte Stripe → reversement vers Binance',
      destination: 'À REMPLACER : ton compte Stripe (ou passerelle carte équivalente)',
      settlement_note: "Les fonds arrivent d'abord sur Stripe. Pour les faire atterrir sur Binance, effectue un virement bancaire régulier de ton compte Stripe vers ta banque, puis un dépôt/achat crypto (P2P Binance ou virement SEPA vers Binance) — aucune passerelle ne fait ce pont automatiquement.",
    },
    {
      method: 'paypal', label: 'Compte PayPal → reversement vers Binance',
      destination: 'À REMPLACER : ton adresse e-mail PayPal professionnelle',
      settlement_note: "PayPal ne verse pas directement vers Binance. Retire régulièrement vers ton compte bancaire, puis dépose vers Binance (virement SEPA ou achat P2P).",
    },
    {
      method: 'mobile_money', label: 'Mobile Money → reversement vers Binance',
      destination: 'À REMPLACER : ton numéro Mobile Money marchand',
      settlement_note: "Retire le solde Mobile Money vers un compte bancaire, puis dépose vers Binance (virement ou P2P). Utile si tu reçois aussi des réservations depuis l'international.",
    },
  ];
  const insertPayout = db.prepare(`INSERT INTO payout_accounts (method, label, destination, settlement_note) VALUES (?, ?, ?, ?)`);
  for (const p of payouts) insertPayout.run(p.method, p.label, p.destination, p.settlement_note);
  console.log('✅ Comptes de destination initialisés (à compléter dans l\'admin avec tes vraies coordonnées).');
}
