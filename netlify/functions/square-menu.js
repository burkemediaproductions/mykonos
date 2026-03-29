exports.handler = async function () {
  // Secure server-side placeholder for a future Square Catalog/Menu API integration.
  // Replace the sample payload below with a live request once credentials are set in Netlify.
  // Suggested env vars:
  // SQUARE_ACCESS_TOKEN=
  // SQUARE_LOCATION_ID=
  // SQUARE_ENVIRONMENT=production
  const sample = {
    categories: [
      {
        slug: 'fresh-meza',
        title: 'Fresh Meza',
        items: [
          {
            name: 'Mediterranean Spreads',
            description: 'Square-connected menu items can render here securely from a Netlify Function.',
            price: '$'
          }
        ]
      }
    ]
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    },
    body: JSON.stringify(sample)
  };
};
