// Liste de pays pour les sélecteurs du site (inscription, logements, filtres).
// France volontairement en tête (marché principal), puis reste du monde par ordre alphabétique.
const COUNTRIES_REST = [
  'Allemagne', 'Andorre', 'Argentine', 'Australie', 'Autriche', 'Belgique', 'Brésil',
  'Bulgarie', 'Cambodge', 'Canada', 'Chili', 'Chine', 'Chypre', 'Colombie', 'Corée du Sud',
  'Costa Rica', 'Croatie', 'Danemark', 'Égypte', 'Émirats arabes unis', 'Espagne', 'Estonie',
  'États-Unis', 'Finlande', 'Grèce', 'Hongrie', 'Inde', 'Indonésie', 'Irlande', 'Islande',
  'Israël', 'Italie', 'Japon', 'Jordanie', 'Lettonie', 'Liechtenstein', 'Lituanie',
  'Luxembourg', 'Malaisie', 'Malte', 'Maroc', 'Mexique', 'Monaco', 'Monténégro', 'Norvège',
  'Nouvelle-Zélande', 'Pays-Bas', 'Pérou', 'Philippines', 'Pologne', 'Portugal',
  'République tchèque', 'Roumanie', 'Royaume-Uni', 'Russie', 'Singapour', 'Slovaquie',
  'Slovénie', 'Suède', 'Suisse', 'Tha\u00eflande', 'Turquie', 'Ukraine', 'Vietnam',
];

const COUNTRIES = ['France', ...COUNTRIES_REST];

function renderCountryOptions(selected = 'France') {
  return COUNTRIES.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
}

function populateCountrySelect(selectEl, selected = 'France') {
  if (!selectEl) return;
  selectEl.innerHTML = renderCountryOptions(selected);
}
