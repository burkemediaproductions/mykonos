# Mykonos Square-to-static menu sync

The full `/menu/` page is generated at build time as HTML and schema.org `Menu` JSON-LD. It requires **no browser-time Square API call**. The home page menu preview loads the same locally hosted `assets/data/menu.json`. This preserves fast loading and crawler-visible item names, descriptions, prices, and categories.

## How automatic publishing works

`.github/workflows/sync-square-menu.yml` runs daily at 15:17 UTC (8:17 AM Pacific during daylight saving time, 7:17 AM otherwise), or immediately from GitHub > Actions > Sync Square menu to static website > Run workflow.

It fetches the existing public Netlify function (`https://mykonosgreekfood.com/.netlify/functions/square-menu`), validates the catalog, updates these two files together, and commits/pushes **only if they changed**:

- `assets/data/menu.json`: static catalog used for the home page preview
- `menu/index.html`: full crawlable static menu, menu category navigation, and JSON-LD

Netlify must be configured to deploy pushes to this repo's `main` branch. GitHub Actions must have permission to push: Settings > Actions > General > Workflow permissions > **Read and write permissions**, if repository policy doesn't already permit it.

## First deployment / forced manual update

The supplied initial files were generated from the Square endpoint data captured October 30, 2026 (100 items in 18 categories). After uploading/pushing all files to GitHub, a Netlify deploy should make the updated static HTML live.

For an immediate refresh at any time, use **Run workflow** in GitHub Actions. GitHub scheduled workflows may run late or be skipped at times; check the latest run if urgent.

To regenerate locally from a current endpoint:

```powershell
node scripts/sync-square-menu.mjs
node --test scripts/sync-square-menu.test.mjs
```

To regenerate from a saved JSON response without network access:

```powershell
node scripts/sync-square-menu.mjs --input path/to/catalog.json
```

## Fail-safe behavior

A failed API call or unexpectedly small catalog causes the workflow to fail without committing changes. The published menu remains the last successful snapshot. This means the static menu **is not real-time**; urgent price changes require a manual workflow run. Sales availability/inventory is not necessarily represented by the Square endpoint; its output is the current catalog source of truth.

The generator edits only text between the existing `MENU_CHIP_NAV_STATIC`, `MENU_STATIC`, and `MENU_SCHEMA` markers. It uses the existing public Square Netlify function, so no Square API token is placed into GitHub or the static site.
