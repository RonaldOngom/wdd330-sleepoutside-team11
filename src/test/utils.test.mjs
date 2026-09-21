import { beforeEach, describe, expect, test } from '@jest/globals';
import { getLocalStorage, setLocalStorage } from '../js/utils.mjs';

let storage;

beforeEach(() => {
  storage = new Map();
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
  });
});
