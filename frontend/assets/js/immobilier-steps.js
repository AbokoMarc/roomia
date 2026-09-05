const FRENCH_REGIONS = [
  'Île-de-France', 'Auvergne-Rhône-Alpes', 'Nouvelle-Aquitaine', 'Occitanie', 'Hauts-de-France',
  'Grand Est', "Provence-Alpes-Côte d'Azur", 'Pays de la Loire', 'Bretagne', 'Normandie',
  'Bourgogne-Franche-Comté', 'Centre-Val de Loire', 'Corse',
];

const AMENITIES_LIST = [
  'Parking', 'Jardin', 'Piscine', 'Terrasse / Balcon', 'Cave', 'Cuisine équipée', 'Climatisation',
  'Chauffage', 'Internet / Fibre', 'Gardiennage / Sécurité', 'Vidéosurveillance', 'Portail sécurisé',
  'Buanderie', 'Ascenseur', 'Panneaux solaires',
];

const FURNITURE_LIST = ['Lit', 'Canapé', 'Table', 'Chaises', 'Réfrigérateur', 'Télévision', 'Climatiseur', 'Machine à laver', 'Cuisine équipée', 'Wi-Fi'];

// ---------- Parcours ACHAT ----------
const STEPS_ACHAT = [
  { key: 'property_type', label: 'Type de bien', question: 'Quel type de bien souhaitez-vous acheter ?', type: 'choice',
    options: ['Chambre', 'Studio', 'Appartement', 'Maison', 'Villa', 'Duplex', 'Triplex', 'Immeuble', 'Terrain', 'Bureau / local commercial', 'Autre'] },
  { key: 'land_type', label: 'Type de terrain', question: 'Quel type de terrain recherchez-vous ?', type: 'choice',
    options: ['Résidentiel', 'Commercial', 'Agricole', 'Industriel', 'Investissement'],
    condition: a => a.property_type === 'Terrain' },
  { key: 'surface_wanted', label: 'Superficie', question: 'Superficie souhaitée ?', type: 'choice',
    options: ['< 200 m²', '200–500 m²', '500–1 000 m²', '1 000–5 000 m²', '> 5 000 m²', 'Peu importe'],
    condition: a => a.property_type === 'Terrain' },

  { key: 'country', label: 'Pays', question: 'Dans quel pays souhaitez-vous acheter ?', type: 'choice', options: ['France', 'Autre'] },
  { key: 'region', label: 'Région', question: 'Dans quelle région ?', type: 'choice', options: FRENCH_REGIONS, condition: a => a.country === 'France' },
  { key: 'country_other', label: 'Pays', question: 'Précisez le pays', type: 'text', placeholder: 'Nom du pays', condition: a => a.country === 'Autre' },
  { key: 'city', label: 'Ville', question: 'Dans quelle ville ?', type: 'text', placeholder: 'Ex : Lyon' },
  { key: 'neighborhoods', label: 'Quartiers', question: 'Quartier(s) recherché(s) ? (facultatif, séparés par des virgules)', type: 'text', placeholder: 'Ex : Croix-Rousse, Presqu\'île', optional: true },
  { key: 'flexible_location', label: 'Flexibilité', question: 'Êtes-vous flexible sur la localisation ?', type: 'choice', options: ['Oui', 'Non'] },
  { key: 'radius_km', label: 'Rayon', question: "Jusqu'à combien de kilomètres autour de votre zone préférée ?", type: 'choice',
    options: ['1 km', '3 km', '5 km', '10 km', '20 km'], condition: a => a.flexible_location === 'Oui' },

  { key: 'price_min', label: 'Budget', question: 'Prix minimum (€) ?', type: 'number', placeholder: 'Ex : 150000' },
  { key: 'price_max', label: 'Budget', question: 'Prix maximum (€) ?', type: 'number', placeholder: 'Ex : 250000' },
  { key: 'financing', label: 'Financement', question: 'Comment comptez-vous financer l\'achat ?', type: 'choice',
    options: ['Fonds propres', 'Crédit bancaire', 'Financement familial', 'Investisseur', 'Autre'] },
  { key: 'loan_approved', label: 'Crédit', question: 'Avez-vous déjà obtenu un accord de financement ?', type: 'choice',
    options: ['Oui', 'Non', 'En cours'], condition: a => a.financing === 'Crédit bancaire' },
  { key: 'loan_amount_available', label: 'Crédit', question: 'Montant approximatif disponible immédiatement (€) ?', type: 'number',
    condition: a => a.financing === 'Crédit bancaire' },

  { key: 'bedrooms', label: 'Chambres', question: 'Combien de chambres souhaitez-vous ?', type: 'choice', options: ['1', '2', '3', '4', '5+', 'Peu importe'] },
  { key: 'bathrooms', label: 'Salles de bain', question: 'Combien de salles de bain ?', type: 'choice', options: ['1', '2', '3', '4+', 'Peu importe'] },
  { key: 'surface_min', label: 'Surface', question: 'Surface minimale (m²) ?', type: 'number', optional: true },
  { key: 'surface_max', label: 'Surface', question: 'Surface maximale (m²) ?', type: 'number', optional: true },

  { key: 'amenities', label: 'Équipements', question: 'Quels équipements sont importants pour vous ?', type: 'priority', options: AMENITIES_LIST },

  { key: 'condition', label: 'État', question: 'Quel état recherchez-vous ?', type: 'choice',
    options: ['Neuf', 'Très bon état', 'Bon état', 'À rénover', 'Peu importe'] },
  { key: 'accepts_works', label: 'Travaux', question: "Acceptez-vous d'effectuer des travaux ?", type: 'choice', options: ['Oui', 'Non'] },
  { key: 'works_budget', label: 'Travaux', question: 'Budget travaux approximatif (€) ?', type: 'number', condition: a => a.accepts_works === 'Oui' },

  { key: 'usage', label: 'Usage', question: 'Pourquoi achetez-vous ?', type: 'choice',
    options: ['Résidence principale', 'Résidence secondaire', 'Investissement locatif', 'Revente', 'Maison familiale', 'Logement étudiant', 'Autre'] },
  { key: 'rental_type', label: 'Investissement', question: 'Quel type de location envisagez-vous ?', type: 'choice',
    options: ['Location longue durée', 'Location courte durée', 'Location étudiante', 'Location saisonnière'],
    condition: a => a.usage === 'Investissement locatif' },
  { key: 'min_yield', label: 'Investissement', question: 'Rendement minimum recherché (%) ?', type: 'number',
    condition: a => a.usage === 'Investissement locatif' },

  { key: 'timing', label: 'Timing', question: 'Quand souhaitez-vous acheter ?', type: 'choice',
    options: ['Dès maintenant', "Moins d'un mois", '1–3 mois', '3–6 mois', '6–12 mois', 'Plus tard'] },
  { key: 'visit', label: 'Visite', question: 'Souhaitez-vous visiter ?', type: 'choice',
    options: ['Oui, rapidement', 'Oui, après sélection', 'Pas encore'] },
];

// ---------- Parcours LOCATION ----------
const STEPS_LOCATION = [
  { key: 'property_type', label: 'Type de bien', question: 'Que souhaitez-vous louer ?', type: 'choice',
    options: ['Chambre', 'Studio', 'Appartement', 'Maison', 'Villa', 'Duplex', 'Bureau', 'Local commercial', 'Terrain'] },

  { key: 'rent_min', label: 'Budget', question: 'Loyer minimum (€/mois) ?', type: 'number' },
  { key: 'rent_max', label: 'Budget', question: 'Loyer maximum (€/mois) ?', type: 'number' },
  { key: 'budget_available', label: 'Budget', question: 'Votre budget initial est-il disponible ?', type: 'choice', options: ['Oui', 'Non', 'Partiellement'] },
  { key: 'budget_partial_amount', label: 'Budget', question: 'Quel montant pouvez-vous payer immédiatement (€) ?', type: 'number',
    condition: a => a.budget_available === 'Partiellement' },

  { key: 'occupants', label: 'Occupants', question: 'Combien de personnes vont vivre dans le logement ?', type: 'choice', options: ['1', '2', '3', '4', '5+'] },
  { key: 'pets', label: 'Animaux', question: 'Avez-vous des animaux ?', type: 'choice', options: ['Oui', 'Non'] },
  { key: 'pet_type', label: 'Animaux', question: 'Lesquels ?', type: 'multichoice', options: ['Chien', 'Chat', 'Autre'], condition: a => a.pets === 'Oui' },

  { key: 'bedrooms', label: 'Chambres', question: 'Nombre de chambres ?', type: 'choice', options: ['1', '2', '3', '4', '5+'] },
  { key: 'bathrooms', label: 'Salles de bain', question: 'Nombre de salles de bain ?', type: 'choice', options: ['1', '2', '3+'] },

  { key: 'furnished', label: 'Meublé', question: 'Quel type de logement ?', type: 'choice', options: ['Meublé', 'Non meublé', 'Peu importe'] },
  { key: 'furniture', label: 'Meublé', question: 'Quels meubles/équipements souhaitez-vous inclus ?', type: 'multichoice', options: FURNITURE_LIST,
    condition: a => a.furnished === 'Meublé' },

  { key: 'charges', label: 'Charges', question: 'Quel système préférez-vous ?', type: 'choice', options: ['Charges comprises', 'Charges séparées', 'Peu importe'] },
  { key: 'charges_important', label: 'Charges', question: 'Quelles charges sont importantes pour vous ?', type: 'multichoice',
    options: ['Eau', 'Électricité', 'Internet', 'Gardiennage', 'Entretien', 'Ordures ménagères'], optional: true },

  { key: 'country', label: 'Pays', question: 'Dans quel pays souhaitez-vous louer ?', type: 'choice', options: ['France', 'Autre'] },
  { key: 'region', label: 'Région', question: 'Dans quelle région ?', type: 'choice', options: FRENCH_REGIONS, condition: a => a.country === 'France' },
  { key: 'country_other', label: 'Pays', question: 'Précisez le pays', type: 'text', placeholder: 'Nom du pays', condition: a => a.country === 'Autre' },
  { key: 'city', label: 'Ville', question: 'Dans quelle ville ?', type: 'text', placeholder: 'Ex : Bordeaux' },
  { key: 'neighborhoods', label: 'Quartiers', question: 'Quartier(s) recherché(s) ? (facultatif)', type: 'text', placeholder: "Ex : Chartrons, Saint-Michel", optional: true },
  { key: 'flexible_location', label: 'Flexibilité', question: 'Êtes-vous flexible sur la localisation ?', type: 'choice', options: ['Oui', 'Non'] },
  { key: 'radius_km', label: 'Rayon', question: "Jusqu'à combien de kilomètres autour de votre zone préférée ?", type: 'choice',
    options: ['1 km', '3 km', '5 km', '10 km', '20 km'], condition: a => a.flexible_location === 'Oui' },
  { key: 'proximity', label: 'Proximité', question: "Qu'est-ce qui doit être proche ?", type: 'multichoice',
    options: ['Université', 'École', 'Travail', 'Centre-ville', 'Marché', 'Hôpital', 'Transport', 'Restaurant', 'Centre commercial'], optional: true },

  { key: 'move_in_date', label: 'Date', question: 'Quand souhaitez-vous emménager ?', type: 'date' },
  { key: 'duration', label: 'Durée', question: 'Durée prévue ?', type: 'choice',
    options: ['Moins de 3 mois', '3–6 mois', '6–12 mois', '1–2 ans', 'Plus de 2 ans', 'Indéterminée'] },
];
