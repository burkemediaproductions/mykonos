import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync(new URL('../assets/data/menu.json', import.meta.url), 'utf8'));
const html = fs.readFileSync(new URL('../menu/index.html', import.meta.url), 'utf8');
const count = data.categories.reduce((n, c) => n + c.items.length, 0);
test('Static HTML and JSON include a complete catalog', () => {
  assert.ok(count >= 40);
  assert.ok(data.categories.length >= 4);
  assert.equal((html.match(/<article class="menu-item-card /g) || []).length, count);
});
test('Static HTML and schema match JSON item names and prices', () => {
  for (const category of data.categories) for (const item of category.items) {
    assert.ok(html.includes(`data-square-token="${item.token}"`));
    assert.ok(html.includes(`content="${item.price}"`));
  }
  const schema = html.split('<!-- MENU_SCHEMA_START -->')[1].split('<!-- MENU_SCHEMA_END -->')[0];
  const jsonld = JSON.parse(schema.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(jsonld.hasMenuSection.reduce((n, c) => n + c.hasMenuItem.length, 0), count);
});
