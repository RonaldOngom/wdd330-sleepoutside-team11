import { getLocalStorage, setLocalStorage } from './utils.mjs';
import ExternalServices from './ExternalServices.mjs';

const dataSource = new ExternalServices('tents');

function addProductToCart(product) {
  const savedCart = getLocalStorage('so-cart');
  const cart = Array.isArray(savedCart) ? savedCart : [];

  cart.push(product);
  setLocalStorage('so-cart', cart);
}

// Add to cart button event handler
async function addToCartHandler(event) {
  const product = await dataSource.findProductById(event.currentTarget.dataset.id);
  addProductToCart(product);
}

// Add listener to Add to Cart button
document
  .getElementById('addToCart')
  .addEventListener('click', addToCartHandler);