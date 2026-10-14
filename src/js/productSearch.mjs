function getProductDetails(card) {
  const brand = card.querySelector('.card__brand')?.textContent.trim() || '';
  const name = card.querySelector('.card__name')?.textContent.trim() || '';
  const priceText =
    card.querySelector('.product-card__price')?.textContent || '';
  const price = Number(priceText.replace(/[^0-9.]/g, ''));

  return { brand, name, price };
}

export function initProductSearch() {
  const form = document.getElementById('product-search-form');
  const productList = document.querySelector('.products .product-list');
  const searchInput = document.getElementById('product-search');
  const brandFilter = document.getElementById('product-brand-filter');
  const sortSelect = document.getElementById('product-sort');
  const clearButton = document.getElementById('product-search-reset');
  const resultsStatus = document.getElementById('product-results-status');

  if (
    !form ||
    !productList ||
    !searchInput ||
    !brandFilter ||
    !sortSelect ||
    !clearButton ||
    !resultsStatus
  ) {
    return;
  }

  const cards = Array.from(productList.querySelectorAll('.product-card'));
  const products = cards.map((card, index) => ({
    card,
    index,
    ...getProductDetails(card),
  }));
  const brands = [...new Set(products.map((product) => product.brand))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  brands.forEach((brand) => {
    const option = document.createElement('option');
    option.value = brand;
    option.textContent = brand;
    brandFilter.append(option);
  });

  function updateProducts() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const selectedBrand = brandFilter.value;
    const visibleProducts = products
      .filter((product) => {
        const matchesSearch = `${product.name} ${product.brand}`
          .toLocaleLowerCase()
          .includes(query);
        const matchesBrand = !selectedBrand || product.brand === selectedBrand;
        return matchesSearch && matchesBrand;
      })
      .sort((left, right) => {
        if (sortSelect.value === 'price-ascending') {
          return left.price - right.price || left.index - right.index;
        }
        if (sortSelect.value === 'price-descending') {
          return right.price - left.price || left.index - right.index;
        }
        return left.index - right.index;
      });

    const visibleCards = new Set(
      visibleProducts.map((product) => product.card),
    );
    products.forEach(({ card }) => {
      card.hidden = !visibleCards.has(card);
    });
    visibleProducts.forEach(({ card }) => productList.append(card));

    const resultCount = visibleProducts.length;
    resultsStatus.textContent = resultCount
      ? `Showing ${resultCount} ${resultCount === 1 ? 'product' : 'products'}`
      : 'No products match your search. Try a different name or brand.';
  }

  form.addEventListener('submit', (event) => event.preventDefault());
  searchInput.addEventListener('input', updateProducts);
  brandFilter.addEventListener('change', updateProducts);
  sortSelect.addEventListener('change', updateProducts);
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    brandFilter.value = '';
    sortSelect.value = 'featured';
    updateProducts();
    searchInput.focus();
  });

  updateProducts();
}
