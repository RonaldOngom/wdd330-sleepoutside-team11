import CheckoutProcess from './CheckoutProcess.mjs';

const checkout = new CheckoutProcess('so-cart');
checkout.init();

document.querySelector('input[name="zip"]').addEventListener('change', () => {
  checkout.calculateOrderTotal();
});

document.querySelector('#checkout-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const response = await checkout.checkout(event.currentTarget);

  if (response) {
    localStorage.removeItem('so-cart');
    window.location.href = new URL('./success.html', window.location.href);
  }
});