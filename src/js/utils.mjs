// Wrapper for querySelector.
export function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

// Retrieve data from local storage.
export function getLocalStorage(key) {
  const storedValue = localStorage.getItem(key);
  if (!storedValue) return [];

  try {
    return JSON.parse(storedValue);
  } catch {
    return [];
  }
}

// Save data to local storage.
export function setLocalStorage(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Set a listener for both touchend and click.
export function setClick(selector, callback) {
  qs(selector).addEventListener('touchend', (event) => {
    event.preventDefault();
    callback();
  });
  qs(selector).addEventListener('click', callback);
}

// Display a dismissible message at the top of main.
export function alertMessage(message, scroll = true) {
  const main = document.querySelector('main');
  const alert = document.createElement('div');
  const text = document.createElement('span');
  const close = document.createElement('button');

  alert.classList.add('alert');
  alert.setAttribute('role', 'alert');

  text.textContent = message;
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close message');
  close.addEventListener('click', () => alert.remove());

  alert.append(text, close);
  main.prepend(alert);

  if (scroll) {
    window.scrollTo(0, 0);
  }
}