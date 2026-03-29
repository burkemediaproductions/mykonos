function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePrice(price) {
  if (price === null || price === undefined) return '';
  const raw = String(price).trim();
  if (!raw || raw === '$') return '';
  return raw.startsWith('$') ? raw : `$${raw}`;
}

function priceValue(price) {
  return normalizePrice(price).replace(/\$/g, '');
}

function hasMeaningfulPrice(price) {
  return normalizePrice(price) !== '';
}

function categoriesLookUsable(categories) {
  if (!Array.isArray(categories) || !categories.length) return false;

  const itemCount = categories.reduce((total, category) => total + (category.items || []).length, 0);
  const pricedCount = categories.reduce((total, category) => {
    return total + (category.items || []).filter((item) => hasMeaningfulPrice(item.price)).length;
  }, 0);

  return itemCount >= 4 && pricedCount > 0;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return response.json();
}

function limitCategories(categories, root) {
  const categoryLimit = parseInt(root.getAttribute('data-menu-limit-categories') || '', 10);
  const itemLimit = parseInt(root.getAttribute('data-menu-limit-items') || '', 10);

  let output = [...categories];

  if (!Number.isNaN(categoryLimit) && categoryLimit > 0) {
    output = output.slice(0, categoryLimit);
  }

  return output.map((category) => ({
    ...category,
    items: !Number.isNaN(itemLimit) && itemLimit > 0
      ? (category.items || []).slice(0, itemLimit)
      : (category.items || [])
  }));
}

function renderChipNav(nav, categories) {
  if (!nav) return;

  nav.innerHTML = categories.map((category) => {
    const count = (category.items || []).length;
    return `<a class="menu-chip" href="#${escapeHtml(category.slug)}">${escapeHtml(category.title)} <span>${count}</span></a>`;
  }).join('');
}

function renderMenu(root, categories) {
  root.innerHTML = categories.map((category) => `
    <section class="menu-section-card reveal" id="${escapeHtml(category.slug)}" aria-labelledby="${escapeHtml(category.slug)}-title">
      <div class="menu-section-head">
        <div>
          <p class="eyebrow">Menu category</p>
          <h2 id="${escapeHtml(category.slug)}-title">${escapeHtml(category.title)}</h2>
          ${category.description ? `<p>${escapeHtml(category.description)}</p>` : ''}
        </div>
        <p class="menu-count">${(category.items || []).length} item${(category.items || []).length === 1 ? '' : 's'}</p>
      </div>
      <div class="menu-items-grid">
        ${(category.items || []).map((item) => {
          const visiblePrice = normalizePrice(item.price);
          const schemaPrice = priceValue(item.price);

          return `
            <article class="menu-item-card" itemscope itemtype="https://schema.org/MenuItem">
              <div class="menu-item-copy">
                <h3 itemprop="name">${escapeHtml(item.name)}</h3>
                ${item.description ? `<p itemprop="description">${escapeHtml(item.description)}</p>` : ''}
              </div>
              ${visiblePrice ? `
                <p class="menu-item-price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
                  <meta itemprop="priceCurrency" content="USD">
                  <span itemprop="price">${escapeHtml(schemaPrice)}</span>
                  <span aria-hidden="true">${escapeHtml(visiblePrice)}</span>
                </p>
              ` : ''}
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `).join('');
}

async function getMenuCategories() {
  try {
    const squareData = await fetchJson('/.netlify/functions/square-menu');
    if (categoriesLookUsable(squareData.categories)) return squareData.categories;
  } catch {}

  try {
    const fallbackData = await fetchJson('/assets/data/menu.json');
    if (categoriesLookUsable(fallbackData.categories)) return fallbackData.categories;
  } catch {}

  return [];
}

async function loadMenus() {
  const roots = document.querySelectorAll('[data-menu-render="dynamic"]');
  if (!roots.length) return;

  const categories = await getMenuCategories();
  if (!categoriesLookUsable(categories)) return;

  roots.forEach((root) => {
    const outputCategories = limitCategories(categories, root);
    renderMenu(root, outputCategories);
  });

  document.querySelectorAll('[data-menu-chip-nav]').forEach((nav) => {
    renderChipNav(nav, categories);
  });

  document.querySelectorAll('.reveal').forEach((element) => {
    element.classList.add('is-visible');
  });
}

loadMenus();