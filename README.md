# Mykonos Website Package

Static multi-page website package designed for GitHub + Netlify.

## What is included
- Home, About, Experience, Menu, FAQ, Reservations & Ordering, Contact, Privacy, Terms, Thank You, and 404 pages
- Accessible responsive site with skip link, full-screen mobile navigation, keyboard support, visible focus states, and reduced-motion handling
- Video hero support with autoplay, muted, loop, playsinline, and poster image usage
- SEO/AIO-ready metadata: unique titles, descriptions, canonicals, OG/Twitter tags, robots, favicon stack, sitemap, and JSON-LD schema
- Styled menu page wired for a secure Netlify Function Square integration
- Reservation and online ordering page ready for DoorDash, Grubhub, Uber Eats, and your reservation provider link
- Security headers in `netlify.toml`

## Brand + design updates applied
- Replaced sparkle-style dividers with Greek-inspired vine/olive dividers in brand-friendly green and gold tones
- Kept the visual language rooted in the supplied logo palette and olive-branch feeling
- Expanded page coverage to better match the reusable website template structure

## Replace placeholder assets and links
Update paths in `/assets/img/`, `/assets/video/`, and page links for:
- Hero and section imagery
- Posters and brand films
- OG image
- Reservation provider URL
- DoorDash / Grubhub / Uber Eats URLs
- Maps URL if desired
- Canonical domain if it changes from the placeholder used here

## Square menu sync
Current behavior:
1. Frontend requests `/.netlify/functions/square-menu`
2. Function returns sample JSON
3. If the function is unavailable, frontend falls back to `/assets/data/menu.json`

To connect Square securely:
- Add Netlify env vars for your Square credentials
- Replace the sample payload in `netlify/functions/square-menu.js` with a live server-side request
- Keep all tokens out of client-side JavaScript

## Deploy
1. Push the folder to GitHub
2. Connect the repo to Netlify
3. Publish directory: `.`
4. Functions directory: `netlify/functions`
5. Add env vars for any external integrations
