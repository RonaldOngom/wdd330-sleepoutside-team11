import { beforeEach, describe, expect, test } from '@jest/globals';
import {
  getCartItems,
  getLocalStorage,
  setLocalStorage,
} from '../js/utils.mjs';

let storage;
let storageErrorEvents;

beforeEach(() => {
  storage = new Map();
  storageErrorEvents = [];
  global.CustomEvent = class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  global.window = {
    dispatchEvent: (event) => storageErrorEvents.push(event),
  };
  global.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
});

describe('local storage helpers', () => {
  test('returns an empty array when a cart has not been saved', () => {
    expect(getLocalStorage('so-cart')).toEqual([]);
  });

  test('saves and retrieves cart data', () => {
    const cart = [{ Id: '880RR', Name: 'Marmot Ajax Tent' }];

    setLocalStorage('so-cart', cart);

    expect(getLocalStorage('so-cart')).toEqual(cart);
  });

  test('returns an empty array when stored JSON is malformed', () => {
    storage.set('so-cart', '{not valid JSON');

    expect(getLocalStorage('so-cart')).toEqual([]);
    expect(storageErrorEvents[0].detail).toEqual({
      operation: 'read',
      key: 'so-cart',
    });
  });

  test('returns an empty array when browser storage cannot be read', () => {
    global.localStorage.getItem = () => {
      throw new Error('Storage is unavailable');
    };

    expect(getLocalStorage('so-cart')).toEqual([]);
    expect(storageErrorEvents[0].detail.operation).toBe('read');
  });

  test('reports when browser storage cannot save data', () => {
    global.localStorage.setItem = () => {
      throw new Error('Storage is full');
    };

    expect(setLocalStorage('so-cart', [])).toBe(false);
    expect(storageErrorEvents[0].detail).toEqual({
      operation: 'write',
      key: 'so-cart',
    });
  });

  test('keeps valid cart entries and reports invalid entries', () => {
    const validItem = {
      Id: '880RR',
      Name: 'Marmot Ajax Tent',
      Image: 'tent.jpg',
      FinalPrice: 199.99,
    };
    storage.set(
      'so-cart',
      JSON.stringify([validItem, null, { Name: 'Invalid' }]),
    );

    expect(getCartItems()).toEqual([validItem]);
    expect(storageErrorEvents[0].detail.operation).toBe('invalid');
  });

  test('returns an empty cart when stored cart data is not an array', () => {
    storage.set('so-cart', JSON.stringify({ item: 'not a cart' }));

    expect(getCartItems()).toEqual([]);
    expect(storageErrorEvents[0].detail.operation).toBe('invalid');
  });
});
