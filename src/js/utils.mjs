// wrapper for querySelector...returns matching element
export function qs(selector, parent = document) {
  return parent.querySelector(selector);
}
// or a more concise version if you are into that sort of thing:
// export const qs = (selector, parent = document) => parent.querySelector(selector);

function reportStorageError(operation, key) {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('app:storage-error', {
      detail: { operation, key },
    }),
  );
}

// Flexible get – returns parsed value or the provided default
export function getLocalStorage(key, defaultValue = []) {
  let storedValue;

  try {
    storedValue = localStorage.getItem(key);
  } catch {
    reportStorageError('read', key);
    return defaultValue;
  }

  if (storedValue === null) return defaultValue;

  try {
    return JSON.parse(storedValue);
  } catch {
    reportStorageError('read', key);
    return defaultValue;
  }
}

export function setLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    reportStorageError('write', key);
    return false;
  }
}

function isCartItem(item) {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof item.Id === 'string' &&
    item.Id.length > 0 &&
    typeof item.Name === 'string' &&
    item.Name.length > 0 &&
    typeof item.Image === 'string' &&
    typeof item.FinalPrice === 'number' &&
    Number.isFinite(item.FinalPrice) &&
    item.FinalPrice >= 0
  );
}

export function getCartItems() {
  const storedCart = getLocalStorage('so-cart', []);

  if (!Array.isArray(storedCart)) {
    reportStorageError('invalid', 'so-cart');
    return [];
  }

  const cartItems = storedCart.filter(isCartItem);
  if (cartItems.length !== storedCart.length) {
    reportStorageError('invalid', 'so-cart');
  }

  return cartItems;
}
// set a listener for both touchend and click
export function setClick(selector, callback) {
  qs(selector).addEventListener('touchend', (event) => {
    event.preventDefault();
    callback();
  });
  qs(selector).addEventListener('click', callback);
}
