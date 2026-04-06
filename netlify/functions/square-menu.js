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
        url.searchParams.set('types', 'ITEM,CATEGORY,IMAGE');
        if (cursor) url.searchParams.set('cursor', cursor);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            statusCode: response.status,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: 'Square API error',
              details: data,
            }),
          };
        }

        if (Array.isArray(data.objects)) {
          objects.push(...data.objects);
        }

        cursor = data.cursor || null;
      } while (cursor);

      const categoriesById = new Map();
      const imagesById = new Map();
      const items = [];

      for (const obj of objects) {
        if (obj.type === 'IMAGE' && obj.image_data?.url) {
          imagesById.set(obj.id, {
            url: obj.image_data.url,
            alt:
              obj.image_data.caption ||
              obj.image_data.name ||
              'Menu item photo',
          });
        }
        if (obj.type === 'CATEGORY' && obj.category_data) {
          categoriesById.set(obj.id, {
            id: obj.id,
            title: obj.category_data.name || 'Menu',
            slug: slugify(obj.category_data.name || obj.id),
            description: '',
            items: [],
          });
        }

        if (obj.type === 'ITEM' && obj.item_data && !obj.is_deleted) {
          items.push(obj);
        }
      }

      for (const item of items) {
        const itemData = item.item_data || {};
        if (itemData.is_archived) continue;
        if (itemData.product_type === 'APPOINTMENTS_SERVICE') continue;
        const hasPrice = itemData.variations?.some(v =>
          v.item_variation_data?.price_money?.amount
        );

    if (!hasPrice) continue;
        const assignedCategories = Array.isArray(itemData.categories)
          ? itemData.categories
          : [];

        let chosenCategoryId = null;
        let chosenCategoryName = null;

        if (assignedCategories.length) {
          const firstCategory = assignedCategories[0];
          chosenCategoryId =
            firstCategory.id ||
            firstCategory.category_id ||
            firstCategory.object_id ||
            null;

          chosenCategoryName =
            firstCategory.name ||
            firstCategory.category_data?.name ||
            null;
        }

        // Legacy fallback
        if (!chosenCategoryId && itemData.category_id) {
          chosenCategoryId = itemData.category_id;
        }

        // Reporting category fallback
        if (!chosenCategoryId && item.reporting_category) {
          chosenCategoryId =
            item.reporting_category.id ||
            item.reporting_category.category_id ||
            item.reporting_category.object_id ||
            null;

          if (!chosenCategoryName) {
            chosenCategoryName =
              item.reporting_category.name ||
              item.reporting_category.category_data?.name ||
              null;
          }
        }

        if (!chosenCategoryId) {
          chosenCategoryId = 'uncategorized';
        }

        if (!categoriesById.has(chosenCategoryId)) {
          const title =
            chosenCategoryName ||
            (chosenCategoryId === 'uncategorized' ? 'More Menu Items' : 'Menu');

          categoriesById.set(chosenCategoryId, {
            id: chosenCategoryId,
            title,
            slug: slugify(title),
            description: '',
            items: [],
          });
        } else if (
          chosenCategoryName &&
          categoriesById.get(chosenCategoryId).title === 'Menu'
        ) {
          const existing = categoriesById.get(chosenCategoryId);
          existing.title = chosenCategoryName;
          existing.slug = slugify(chosenCategoryName);
        }

        const variations = Array.isArray(itemData.variations) ? itemData.variations : [];

        let chosenVariation = variations[0] || null;

        if (locationId && variations.length > 1) {
          const byLocation = variations.find((variation) => {
            const locs =
              variation.item_variation_data?.location_overrides ||
              variation.item_variation_data?.location_ids ||
              [];
            return Array.isArray(locs) && locs.includes(locationId);
          });

          if (byLocation) chosenVariation = byLocation;
        }

        const money = chosenVariation?.item_variation_data?.price_money;
        const price =
          money && typeof money.amount === 'number'
            ? (money.amount / 100).toFixed(2)
            : '';
        const itemImageId =
          (Array.isArray(itemData.image_ids) && itemData.image_ids[0]) ||
          itemData.image_id ||
          null;

        const itemImage = itemImageId ? imagesById.get(itemImageId) : null;
        categoriesById.get(chosenCategoryId).items.push({
          name: itemData.name || 'Untitled Item',
          description: itemData.description || '',
          price,
          image: itemImage?.url || '',
          imageAlt: itemImage?.alt || (itemData.name || 'Menu item'),
        });
      }
      const categories = Array.from(categoriesById.values())
        .filter((category) => Array.isArray(category.items) && category.items.length)
        .map((category) => ({
          ...category,
          items: category.items.sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => a.title.localeCompare(b.title));

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
        body: JSON.stringify({
          error: 'Failed to load Square menu',
          message: error.message,
        }),
      };
    }
  };

  function slugify(value = '') {
    return String(value)
      .toLowerCase()
      .trim()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }