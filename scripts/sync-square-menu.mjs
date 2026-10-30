#!/usr/bin/env node
// Refresh the static, crawlable menu and its structured data from the existing Square API.
// Running with --input path/to/catalog.json allows an offline or manual refresh.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_URL = process.env.MYKONOS_MENU_URL || 'https://mykonosgreekfood.com/.netlify/functions/square-menu';
const argIndex = process.argv.indexOf('--input');
const inputPath = argIndex >= 0 ? process.argv[argIndex + 1] : null;
const escapeHtml = (v = '') => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const slug = (v) => String(v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'menu';
const money = v => { const n = Number(String(v ?? '').replace(/[$,]/g, '')); if (!Number.isFinite(n) || n < 0) throw new Error('Invalid price'); return n.toFixed(2); };

async function load() {
  if (inputPath) return JSON.parse(await fs.readFile(path.resolve(inputPath), 'utf8'));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const response = await fetch(SOURCE_URL, { signal: ctrl.signal, headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error(`Square menu endpoint returned HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

function normalized(data) {
  if (!Array.isArray(data.categories)) throw new Error('Square response has no categories');
  const seenItems = new Set(), slugs = new Set();
  const categories = data.categories.map((category, index) => {
    const items = (Array.isArray(category.items) ? category.items : []).filter(item => item && String(item.name || '').trim() && item.price !== null && item.price !== undefined && String(item.price).trim() !== '').map(item => ({
      token: String(item.token || ''), name: String(item.name), description: String(item.description || ''),
      price: money(item.price), modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
      image: /^https:\/\//.test(item.image || '') ? item.image : '', imageAlt: String(item.imageAlt || item.name)
    })).filter(item => {
      const key = item.token || `${index}:${item.name}`;
      if (seenItems.has(key)) return false;
      seenItems.add(key);
      return true;
    });
    let categorySlug = slug(category.slug || category.title || `category-${index}`);
    if (slugs.has(categorySlug)) categorySlug += `-${index + 1}`;
    slugs.add(categorySlug);
    return { id: String(category.id || categorySlug), title: String(category.title || 'Menu'), slug: categorySlug, description: String(category.description || ''), items };
  }).filter(c => c.items.length);
  const itemCount = categories.reduce((n,c) => n + c.items.length,0);
  // Fail safe: do not publish an empty or dramatically truncated catalog.
  if (categories.length < 4 || itemCount < 40) throw new Error(`Unexpectedly small catalog (${categories.length} categories, ${itemCount} items)`);
  return { categories };
}

function renderModifiers(item) {
  return (item.modifiers || []).map(mod => {
    const options = Array.isArray(mod.options) ? mod.options : [];
    return options.length ? `<p class="menu-modifier-note"><strong>${escapeHtml(mod.name || 'Options')}:</strong> ${escapeHtml(options.join(', '))}</p>` : '';
  }).join('');
}
function renderMenu(categories) {
  return `<div class="menu-static-note sr-only">Menu generated from the restaurant's Square catalog and refreshed automatically.</div>\n` + categories.map(category => `
<section class="menu-category reveal" id="menu-category-${escapeHtml(category.slug)}" aria-labelledby="menu-heading-${escapeHtml(category.slug)}">
  <div class="menu-category-heading">
    <p class="eyebrow">${escapeHtml(category.title)}</p>
    <h3 id="menu-heading-${escapeHtml(category.slug)}">${escapeHtml(category.title)}</h3>
    ${category.description ? `<p>${escapeHtml(category.description)}</p>` : ''}
    <p class="menu-item-count">${category.items.length} items</p>
  </div>
  <div class="menu-items-grid">
    ${category.items.map(item => `<article class="menu-item-card ${item.image ? 'has-image' : 'no-image'}" itemscope itemtype="https://schema.org/MenuItem" data-square-token="${escapeHtml(item.token)}">
      ${item.image ? `<div class="menu-item-media"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.imageAlt)}" loading="lazy" decoding="async"></div>` : ''}
      <div class="menu-item-body"><div class="menu-item-copy">
        <h4 itemprop="name">${escapeHtml(item.name)}</h4>
        ${item.description ? `<p itemprop="description">${escapeHtml(item.description)}</p>` : ''}
        ${renderModifiers(item)}
      </div><div class="menu-item-price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
        <meta itemprop="priceCurrency" content="USD"><meta itemprop="price" content="${item.price}">
        <span aria-hidden="true">$${item.price}</span><span class="sr-only">$${item.price}</span>
      </div></div>
    </article>`).join('\n')}
  </div>
</section>`).join('\n');
}
function renderSchema(categories) {
  return '<script type="application/ld+json">\n' + JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Menu', '@id': 'https://mykonosgreekfood.com/menu/#menu',
    name: 'Mykonos Menu', url: 'https://mykonosgreekfood.com/menu/',
    hasMenuSection: categories.map(category => ({ '@type': 'MenuSection', name: category.title, description: category.description, hasMenuItem: category.items.map(item => ({
      '@type': 'MenuItem', name: item.name, description: item.description,
      ...(item.image ? { image: item.image } : {}), offers: { '@type': 'Offer', price: item.price, priceCurrency: 'USD' }
    })) }))
  }, null, 2).replace(/</g, '\\u003c') + '\n</script>';
}
function replaceBetween(html, start, end, value) {
  const a = `<!-- ${start} -->`, b = `<!-- ${end} -->`;
  if (html.split(a).length !== 2 || html.split(b).length !== 2) throw new Error(`Missing or duplicated marker ${start}/${end}`);
  const before = html.indexOf(a) + a.length, after = html.indexOf(b);
  if (before >= after) throw new Error(`Malformed marker pair ${start}/${end}`);
  return html.slice(0, before) + '\n' + value + '\n' + html.slice(after);
}

const raw = await load();
const data = normalized(raw);
const htmlPath = path.join(ROOT, 'menu/index.html');
const jsonPath = path.join(ROOT, 'assets/data/menu.json');
let html = await fs.readFile(htmlPath, 'utf8');
html = replaceBetween(html, 'MENU_CHIP_NAV_STATIC_START', 'MENU_CHIP_NAV_STATIC_END', data.categories.map(c => `<a class="menu-chip" href="#menu-category-${escapeHtml(c.slug)}"><span>${escapeHtml(c.title)}</span></a>`).join('\n'));
html = replaceBetween(html, 'MENU_STATIC_START', 'MENU_STATIC_END', renderMenu(data.categories));
html = replaceBetween(html, 'MENU_SCHEMA_START', 'MENU_SCHEMA_END', renderSchema(data.categories));
// After all validation/generation succeeds, publish the files.
await fs.writeFile(jsonPath, JSON.stringify(data, null, 2) + '\n');
await fs.writeFile(htmlPath, html);
console.log(`Static menu refreshed: ${data.categories.length} categories, ${data.categories.reduce((n,c) => n+c.items.length,0)} items`);
