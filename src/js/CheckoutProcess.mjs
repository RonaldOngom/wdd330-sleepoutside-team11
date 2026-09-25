import { getLocalStorage } from './utils.mjs';

export default class CheckoutProcess {
  constructor(key) {
    this.key = key;
    this.items = [];
    this.itemTotal = 0;
    this.tax = 0;
    this.shipping = 0;
    this.orderTotal = 0;
  }

  init() {
    this.items = getLocalStorage(this.key);
    this.itemTotal = this.items.reduce(
      (sum, item) => sum + Number(item.FinalPrice),
      0,
    );

    document.querySelector('#subtotal').textContent =
      `$${this.itemTotal.toFixed(2)}`;
  }

  calculateOrderTotal() {
    this.tax = this.itemTotal * 0.06;
    this.shipping = this.items.length > 0
      ? 10 + (this.items.length - 1) * 2
      : 0;
    this.orderTotal = this.itemTotal + this.tax + this.shipping;

    document.querySelector('#tax').textContent = `$${this.tax.toFixed(2)}`;
    document.querySelector('#shipping').textContent =
      `$${this.shipping.toFixed(2)}`;
    document.querySelector('#order-total').textContent =
      `$${this.orderTotal.toFixed(2)}`;
  }
}