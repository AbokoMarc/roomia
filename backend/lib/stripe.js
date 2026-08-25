import Stripe from 'stripe';

let _stripe = null;

// Chargement paresseux : Stripe n'est nécessaire que si un client tente de payer par carte.
// Si STRIPE_SECRET_KEY n'est pas défini, les autres méthodes de paiement (PayPal, crypto)
// continuent de fonctionner normalement — seul le paiement carte est indisponible.
export function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_NOT_CONFIGURED');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export function isStripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}
