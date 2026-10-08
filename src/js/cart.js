import { getCartItems, setLocalStorage } from './utils.mjs';

function renderCartContents() {
  const cartItems = getCartItems();
  const cartList = document.querySelector('.product-list');
  const cartSummary = document.querySelector('.cart-summary');

  cartList.replaceChildren();

  if (cartItems.length === 0) {
    cartList.append(emptyCartTemplate());
    cartSummary.hidden = true;
    return;
  }

  cartSummary.hidden = false;
  cartItems.forEach((item, index) => {
    cartList.append(cartItemTemplate(item, index));
  });
  document.querySelector('.cart-subtotal').textContent = formatPrice(
    calculateCartTotal(cartItems),
  );
}

function emptyCartTemplate() {
  const listItem = document.createElement('li');
  listItem.className = 'empty-cart';

  const icon = document.createElement('span');
  icon.className = 'empty-cart__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '⛺';

  const heading = document.createElement('h2');
  heading.textContent = 'Your cart is ready for an adventure';

  const message = document.createElement('p');
  message.textContent =
    'You have not added any gear yet. Find what you need for your next trip.';
  const link = document.createElement('a');
  link.className = 'continue-shopping';
  link.href = '../index.html';
  link.textContent = 'Explore outdoor gear';

  listItem.append(icon, heading, message, link);
  return listItem;
}

function cartItemTemplate(item, index) {
  const listItem = document.createElement('li');
  listItem.className = 'cart-card divider';

  const image = document.createElement('img');
  image.src = item.Image;
  image.alt = item.Name;
  const imageLink = document.createElement('a');
  imageLink.className = 'cart-card__image';
  imageLink.href = '../index.html';
  imageLink.append(image);

  const name = document.createElement('h3');
  name.className = 'card__name';
  name.textContent = item.Name;

  const color = document.createElement('p');
  color.className = 'cart-card__color';
  color.textContent = item.Colors?.[0]?.ColorName ?? 'Color not specified';

  const quantityLabel = document.createElement('label');
  quantityLabel.className = 'cart-card__quantity';
  quantityLabel.htmlFor = `quantity-${index}`;
  quantityLabel.textContent = 'Qty';
  const quantity = document.createElement('input');
  quantity.id = `quantity-${index}`;
  quantity.type = 'number';
  quantity.min = '1';
  quantity.max = '99';
  quantity.value = String(Math.max(1, Number(item.quantity) || 1));
  quantity.dataset.index = String(index);
  quantity.setAttribute('aria-label', `Quantity for ${item.Name}`);
  quantityLabel.append(quantity);

  const price = document.createElement('p');
  price.className = 'cart-card__price';
  price.textContent = formatPrice(
    Number(item.FinalPrice) * Number(quantity.value),
  );

  const removeButton = document.createElement('button');
  removeButton.className = 'cart-card__remove';
  removeButton.type = 'button';
  removeButton.dataset.index = String(index);
  removeButton.textContent = 'Remove';
  removeButton.setAttribute('aria-label', `Remove ${item.Name} from cart`);

  listItem.append(imageLink, name, color, quantityLabel, price, removeButton);
  return listItem;
}

function calculateCartTotal(cartItems) {
  return cartItems.reduce(
    (total, item) =>
      total + Number(item.FinalPrice) * Math.max(1, Number(item.quantity) || 1),
    0,
  );
}

function formatPrice(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

document.querySelector('.product-list').addEventListener('change', (event) => {
  if (event.target.matches('.cart-card__quantity input')) {
    const index = Number(event.target.dataset.index);
    const cartItems = getCartItems();

    if (!cartItems[index]) return;

    const quantity = Number(event.target.value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      event.target.value = String(cartItems[index].quantity || 1);
      return;
    }

    cartItems[index].quantity = quantity;
    if (!setLocalStorage('so-cart', cartItems)) return;
    renderCartContents();
  }
});

document.querySelector('.product-list').addEventListener('click', (event) => {
  const button = event.target.closest('.cart-card__remove');
  if (!button) return;

  const cartItems = getCartItems();

  cartItems.splice(Number(button.dataset.index), 1);
  if (!setLocalStorage('so-cart', cartItems)) return;
  renderCartContents();
});

window.addEventListener('app:storage-error', (event) => {
  const status = document.querySelector('.cart-status');
  if (!status || event.detail.key !== 'so-cart') return;

  status.textContent =
    event.detail.operation === 'read'
      ? 'Saved cart data could not be read. Your cart is shown as empty.'
      : event.detail.operation === 'invalid'
        ? 'Some saved cart data was invalid and has been left out of your cart.'
        : 'Your cart changes could not be saved. Check your browser storage settings and try again.';
});

renderCartContents();
