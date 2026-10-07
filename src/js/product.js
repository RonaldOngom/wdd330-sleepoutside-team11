import { getLocalStorage, setLocalStorage } from './utils.mjs';
import ProductData from './ProductData.mjs';

const dataSource = new ProductData('tents');

function addProductToCart(product) {
  const cartItems = getLocalStorage('so-cart');
  const cart = Array.isArray(cartItems) ? cartItems : [];
  const existingItem = cart.find((item) => item.Id === product.Id);

  if (existingItem) {
    existingItem.quantity = (Number(existingItem.quantity) || 1) + 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  setLocalStorage('so-cart', cart);
}

async function addToCartHandler(e) {
  const button = e.currentTarget;
  const status = document.querySelector('.product-detail__status');
  button.disabled = true;

  try {
    const product = await dataSource.findProductById(button.dataset.id);
    if (!product) {
      throw new Error('The selected product could not be found.');
    }

    addProductToCart(product);
    status.textContent = `${product.Name} was added to your cart.`;
  } catch {
    status.textContent = 'We could not add this item. Please try again.';
  } finally {
    button.disabled = false;
  }
}

const addToCartButton = document.getElementById('addToCart');

if (addToCartButton) {
  const status = document.createElement('p');
  status.className = 'product-detail__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  addToCartButton.closest('.product-detail__add').append(status);
  addToCartButton.addEventListener('click', addToCartHandler);
}
