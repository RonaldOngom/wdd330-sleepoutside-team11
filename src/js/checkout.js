import CheckoutProcess from './CheckoutProcess.mjs';

const checkout = new CheckoutProcess('so-cart');
checkout.init();

document.querySelector('input[name="zip"]').addEventListener('change', () => {
  checkout.calculateOrderTotal();
});

document.querySelector('#checkout-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const response = await checkout.checkout(event.currentTarget);
    console.log('Order response:', response);
  } catch (error) {
    console.error('Checkout failed:', error);
  }
});