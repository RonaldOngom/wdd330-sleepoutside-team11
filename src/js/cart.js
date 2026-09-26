import { getLocalStorage } from './utils.mjs';

const fallbackImage = new URL('../images/noun_Tent_2517.svg', import.meta.url).href;

function renderCartContents() {
  const cartItems = getLocalStorage('so-cart');
  const cartList = document.querySelector('.product-list');
  const subtotalElement = document.querySelector('.cart-subtotal');
  const checkoutButton = document.querySelector('.checkout-button');

  if (cartItems.length === 0) {
    cartList.innerHTML = emptyCartTemplate();
    subtotalElement.textContent = '';
    checkoutButton.hidden = true;
    return;
  }

  const htmlItems = cartItems.map((item) => cartItemTemplate(item));
  cartList.innerHTML = htmlItems.join('');

  cartList.querySelectorAll('img').forEach((image) => {
    image.addEventListener('error', () => {
      image.src = fallbackImage;
    }, { once: true });
  });

  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.FinalPrice),
    0,
  );
  subtotalElement.textContent = `Subtotal: $${subtotal.toFixed(2)}`;
}

function emptyCartTemplate() {
  return `<li class="empty-cart">
    <p>Your cart is empty.</p>
    <a class="continue-shopping" href="../index.html">Continue shopping</a>
  </li>`;
}

function cartItemTemplate(item) {
  return `<li class="cart-card divider">
    <a href="#" class="cart-card__image">
      <img src="${item.Image}" alt="${item.Name}" />
    </a>
    <a href="#">
      <h2 class="card__name">${item.Name}</h2>
    </a>
    <p class="cart-card__color">${item.Colors[0].ColorName}</p>
    <p class="cart-card__quantity">qty: 1</p>
    <p class="cart-card__price">$${item.FinalPrice}</p>
  </li>`;
}

renderCartContents();