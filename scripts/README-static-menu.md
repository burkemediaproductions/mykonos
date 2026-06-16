# Static menu generation

This site now includes crawlable static menu HTML and Menu/MenuSection/MenuItem JSON-LD in `menu/index.html` between safe marker comments.

The current generated output was built from the cleaned Square catalog CSV and the live JavaScript can still refresh the page from `/.netlify/functions/square-menu` when Square credentials are available.

Safe marker comments:

- `MENU_CHIP_NAV_STATIC_START` / `MENU_CHIP_NAV_STATIC_END`
- `MENU_STATIC_START` / `MENU_STATIC_END`
- `MENU_SCHEMA_START` / `MENU_SCHEMA_END`

Only replace content inside these markers when regenerating the static menu.
