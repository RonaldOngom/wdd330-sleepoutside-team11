import CheckoutProcess from './CheckoutProcess.mjs';

const checkout = new CheckoutProcess('so-cart');
checkout.init();

document.querySelector('input[name="zip"]').addEventListener('change', () => {
  checkout.calculateOrderTotal();
});