// wrapper for querySelector...returns matching element
export function qs(selector, parent = document) {
  return parent.querySelector(selector);
}
// or a more concise version if you are into that sort of thing:
// export const qs = (selector, parent = document) => parent.querySelector(selector);

// Retrieve data from local storage. A missing or malformed value is treated as empty.
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
// set a listener for both touchend and click
export function setClick(selector, callback) {
  qs(selector).addEventListener('touchend', (event) => {
    event.preventDefault();
    callback();
  });
  qs(selector).addEventListener('click', callback);
}
