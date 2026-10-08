import { getCartItems, setLocalStorage } from './utils.mjs';

const form = document.querySelector('#checkout-form');
const itemsList = document.querySelector('.checkout-items');
const status = document.querySelector('.checkout-status');
const submitButton = form.querySelector('[type="submit"]');

function getCart() {
  return getCartItems();
}

function formatPrice(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function renderOrderSummary() {
  const cart = getCart();
  itemsList.replaceChildren();

  cart.forEach((item) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const listItem = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = `${item.Name} × ${quantity}`;
    const price = document.createElement('strong');
    price.textContent = formatPrice(Number(item.FinalPrice) * quantity);
    listItem.append(name, price);
    itemsList.append(listItem);
  });

  const total = cart.reduce(
    (sum, item) =>
      sum + Number(item.FinalPrice) * Math.max(1, Number(item.quantity) || 1),
    0,
  );
  document.querySelector('.checkout-subtotal').textContent = formatPrice(total);

  const hasItems = cart.length > 0;
  form.hidden = !hasItems;
  if (!hasItems) {
    status.textContent = 'Your cart is empty. Add an item before checkout.';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  if (getCart().length === 0) {
    status.textContent = 'Your cart is empty. Add an item before checkout.';
    return;
  }

  if (!setLocalStorage('so-cart', [])) {
    status.textContent =
      'Your order could not be completed because your cart could not be updated. Please try again.';
    return;
  }
  form.reset();
  form.hidden = true;
  itemsList.replaceChildren();
  document.querySelector('.checkout-subtotal').textContent = formatPrice(0);
  submitButton.disabled = true;
  status.textContent = 'Demo checkout complete. No payment was processed.';
});

window.addEventListener('app:storage-error', (event) => {
  if (event.detail.key !== 'so-cart') return;

  status.textContent =
    event.detail.operation === 'read'
      ? 'Your saved cart could not be read. Return to your cart and try again.'
      : event.detail.operation === 'invalid'
        ? 'Some saved cart data was invalid and has been left out of your order.'
        : 'Your cart could not be updated. Please check browser storage and try again.';
});

renderOrderSummary();
