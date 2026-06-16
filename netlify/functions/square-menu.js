exports.handler = async function () {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!token) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing SQUARE_ACCESS_TOKEN' }),
    };
  }

  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Square-Version': '2026-01-22',
      'Content-Type': 'application/json',
    };

    const objects = [];
    let cursor = null;

    do {
      const url = new URL('https://connect.squareup.com/v2/catalog/list');
      url.searchParams.set('types', 'ITEM,CATEGORY,IMAGE,MODIFIER_LIST,MODIFIER');
      if (cursor) url.searchParams.set('cursor', cursor);

      const response = await fetch(url.toString(), { method: 'GET', headers });
      const data = await response.json();

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Square API error', details: data }),
        };
      }

      if (Array.isArray(data.objects)) objects.push(...data.objects);
      cursor = data.cursor || null;
    } while (cursor);

    const categoriesById = new Map();
    const imagesById = new Map();
    const modifierListsById = new Map();
    const modifiersById = new Map();
    const items = [];

    for (const obj of objects) {
      if (obj.type === 'IMAGE' && obj.image_data?.url) {
        imagesById.set(obj.id, {
          url: obj.image_data.url,
          alt: obj.image_data.caption || obj.image_data.name || 'Menu item photo',
        });
      }

      if (obj.type === 'CATEGORY' && obj.category_data) {
        categoriesById.set(obj.id, {
          id: obj.id,
          title: normalizeCategoryTitle(obj.category_data.name || 'Menu'),
          slug: slugify(obj.category_data.name || obj.id),
          description: categoryDescription(obj.category_data.name || 'Menu'),
          items: [],
        });
      }

      if (obj.type === 'MODIFIER' && obj.modifier_data) {
        modifiersById.set(obj.id, {
          id: obj.id,
          name: obj.modifier_data.name || 'Option',
          price: moneyToPrice(obj.modifier_data.price_money),
        });
      }

      if (obj.type === 'MODIFIER_LIST' && obj.modifier_list_data) {
        const listData = obj.modifier_list_data;
        const modifiers = Array.isArray(listData.modifiers)
          ? listData.modifiers.map((modifier) => ({
              id: modifier.id,
              name: modifier.modifier_data?.name || modifier.name || 'Option',
              price: moneyToPrice(modifier.modifier_data?.price_money),
            }))
          : [];

        modifierListsById.set(obj.id, {
          id: obj.id,
          name: listData.name || 'Options',
          options: modifiers,
        });
      }

      if (obj.type === 'ITEM' && obj.item_data && !obj.is_deleted) items.push(obj);
    }

    for (const item of items) {
      const itemData = item.item_data || {};
      if (itemData.is_archived) continue;
      if (itemData.product_type === 'APPOINTMENTS_SERVICE') continue;

      const hasPrice = itemData.variations?.some((variation) =>
        variation.item_variation_data?.price_money?.amount
      );
      if (!hasPrice) continue;

      const assignedCategories = Array.isArray(itemData.categories) ? itemData.categories : [];
      let chosenCategoryId = null;
      let chosenCategoryName = null;

      if (assignedCategories.length) {
        const firstCategory = assignedCategories[0];
        chosenCategoryId = firstCategory.id || firstCategory.category_id || firstCategory.object_id || null;
        chosenCategoryName = firstCategory.name || firstCategory.category_data?.name || null;
      }

      if (!chosenCategoryId && itemData.category_id) chosenCategoryId = itemData.category_id;

      if (!chosenCategoryId && item.reporting_category) {
        chosenCategoryId = item.reporting_category.id || item.reporting_category.category_id || item.reporting_category.object_id || null;
        chosenCategoryName = chosenCategoryName || item.reporting_category.name || item.reporting_category.category_data?.name || null;
      }

      if (!chosenCategoryId) chosenCategoryId = 'uncategorized';

      if (!categoriesById.has(chosenCategoryId)) {
        const title = normalizeCategoryTitle(chosenCategoryName || (chosenCategoryId === 'uncategorized' ? 'More Menu Items' : 'Menu'));
        categoriesById.set(chosenCategoryId, {
          id: chosenCategoryId,
          title,
          slug: slugify(title),
          description: categoryDescription(title),
          items: [],
        });
      } else if (chosenCategoryName && categoriesById.get(chosenCategoryId).title === 'Menu') {
        const existing = categoriesById.get(chosenCategoryId);
        existing.title = normalizeCategoryTitle(chosenCategoryName);
        existing.slug = slugify(chosenCategoryName);
        existing.description = categoryDescription(chosenCategoryName);
      }

      const variations = Array.isArray(itemData.variations) ? itemData.variations : [];
      let chosenVariation = variations[0] || null;

      if (locationId && variations.length > 1) {
        const byLocation = variations.find((variation) => {
          const locs = variation.item_variation_data?.location_overrides || variation.item_variation_data?.location_ids || [];
          return Array.isArray(locs) && locs.includes(locationId);
        });
        if (byLocation) chosenVariation = byLocation;
      }

      const price = moneyToPrice(chosenVariation?.item_variation_data?.price_money);
      const itemImageId = (Array.isArray(itemData.image_ids) && itemData.image_ids[0]) || itemData.image_id || null;
      const itemImage = itemImageId ? imagesById.get(itemImageId) : null;

      const modifiers = normalizeItemModifiers(itemData.modifier_list_info, modifierListsById, modifiersById);

      categoriesById.get(chosenCategoryId).items.push({
        token: item.id,
        name: itemData.name || 'Untitled Item',
        description: itemData.description || '',
        price,
        modifiers,
        image: itemImage?.url || '',
        imageAlt: itemImage?.alt || itemData.name || 'Menu item',
      });
    }

    const categoryOrder = ['Appetizers', 'Hot Mezes', 'Soups', 'Salads', 'Main Course', 'Sandwiches', 'Sides', 'Desserts', 'Soft Drinks'];
    const orderIndex = (title) => {
      const index = categoryOrder.indexOf(title);
      return index === -1 ? 999 : index;
    };

    const categories = Array.from(categoriesById.values())
      .filter((category) => Array.isArray(category.items) && category.items.length)
      .map((category) => ({
        ...category,
        items: category.items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => orderIndex(a.title) - orderIndex(b.title) || a.title.localeCompare(b.title));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
      body: JSON.stringify({ categories }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to load Square menu', message: error.message }),
    };
  }
};

function normalizeItemModifiers(modifierListInfo = [], modifierListsById, modifiersById) {
  if (!Array.isArray(modifierListInfo)) return [];

  return modifierListInfo
    .map((info) => {
      const listId = info.modifier_list_id || info.id || info.object_id;
      const list = listId ? modifierListsById.get(listId) : null;
      const name = list?.name || info.name || 'Options';
      let options = Array.isArray(list?.options) ? list.options : [];

      if (Array.isArray(info.modifier_overrides) && info.modifier_overrides.length) {
        const overrideIds = info.modifier_overrides.map((override) => override.modifier_id || override.id).filter(Boolean);
        options = overrideIds.map((id) => modifiersById.get(id)).filter(Boolean);
      }

      return {
        name,
        options: options.map((option) => option.price ? `${option.name} (+$${option.price})` : option.name).filter(Boolean),
      };
    })
    .filter((modifier) => modifier.name && modifier.options.length);
}

function moneyToPrice(money) {
  return money && typeof money.amount === 'number' ? (money.amount / 100).toFixed(2) : '';
}

function normalizeCategoryTitle(value = '') {
  return String(value)
    .replace(/Soup's/gi, 'Soups')
    .replace(/Salad's/gi, 'Salads')
    .replace(/Main Courses/gi, 'Main Course')
    .trim() || 'Menu';
}

function categoryDescription(value = '') {
  const title = normalizeCategoryTitle(value);
  const descriptions = {
    Appetizers: 'Fresh Greek and Mediterranean appetizers, dips, spreads, and shareable starters.',
    'Hot Mezes': 'Warm Greek mezes and Mediterranean small plates made for sharing.',
    Soups: 'Comforting Greek and Mediterranean soups served fresh.',
    Salads: 'Fresh salads with Greek, Mediterranean, seafood, and protein-forward options.',
    'Main Course': 'Signature Greek Mediterranean plates, gyros, kebabs, seafood, and traditional favorites.',
    Sandwiches: 'Greek sandwiches and plates featuring gyros, falafel, and Mediterranean favorites.',
    Sides: 'Simple sides to pair with Greek Mediterranean meals.',
    Desserts: 'Greek and Mediterranean desserts, puddings, baklava, and sweet finishes.',
    'Soft Drinks': 'Refreshing drinks, iced tea, lemonade, and soft drinks.',
  };
  return descriptions[title] || `${title} from the Mykonos menu.`;
}

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
