# KAVALON Digital Directory — Kiosk Web App

A touchscreen web app for the vertical lobby TVs in each of KAVALON's 9 buildings. Shows the current building, an interactive site map, the common-facility directory (with photos), and juristic-office announcements/news. Plain HTML/CSS/JS — no build step, no backend server required.

## Running it locally

Just serve the `webapp/` folder over HTTP (opening `index.html` directly with `file://` also works, except the Google Sheets fetch may be blocked by the browser — a local static server avoids that):

```bash
npx serve webapp
# or
python -m http.server --directory webapp 8080
```

Then open the printed URL. On first load it uses the bundled seed data in `webapp/data/*.seed.json` and `buildings.json` / `zones.json`.

## Deploying

`webapp/` is fully static — copy the folder to any static web host (Netlify, Vercel, an internal IIS/nginx server, S3+CloudFront, etc.) or run a small local web server on each kiosk PC. No server-side code to install.

## Connecting the Google Sheet CMS (recommended)

This lets the juristic/marketing team edit announcements and facilities themselves, with no redeploy.

1. Create one Google Sheet with two tabs, named exactly:
   - `Announcements`
   - `Facilities`
2. Add these column headers as row 1 of each tab (order doesn't matter, names do):

   **Announcements** tab:
   | id | date | category | categoryEn | titleTh | titleEn | bodyTh | bodyEn | pinned | image |
   |---|---|---|---|---|---|---|---|---|---|
   | welcome-2026 | 2026-09-01 | ประกาศ | Notice | หัวข้อภาษาไทย | English title | เนื้อหาภาษาไทย | English body | TRUE | (leave blank or a filename already in assets/images) |

   - `date`: `YYYY-MM-DD`.
   - `pinned`: `TRUE` to keep an item pinned to the top of the list, otherwise `FALSE`/blank.
   - `image`: optional; leave blank for a text-only announcement.

   **Facilities** tab:
   | id | building | zone | nameTh | nameEn | descTh | descEn | images | order |
   |---|---|---|---|---|---|---|---|---|
   | lobby-a | A | mix-forest | ล็อบบี้แกรนด์ อาคาร เอ | Grand Lobby A | ... | ... | lobby-a-1.jpg;lobby-a-2.jpg | 1 |

   - `building`: one letter A–I, or leave blank for a shared/central facility not tied to one building.
   - `zone`: one of `mix-forest`, `theme-park`, `futuristic-world`, `healing-zone`, `magic-island`, `parking` (see `data/zones.json`).
   - `images`: one or more filenames, separated by `;`, that already exist in `webapp/assets/images/`. To add a **new** photo, send it to whoever maintains the site so it can be resized and dropped into that folder with a filename you then reference here — Sheets can't host the image itself.

3. In Google Sheets: **File → Share → Publish to web**. Under "Link", choose the specific sheet tab (not "Entire document"), pick **Comma-separated values (.csv)**, then **Publish**. Do this once per tab. Copy each resulting URL.
4. Open `webapp/js/config.js` and paste the two URLs in:
   ```js
   announcementsSheetCsvUrl: "https://docs.google.com/.../pub?output=csv",
   facilitiesSheetCsvUrl: "https://docs.google.com/.../pub?output=csv",
   ```
5. Reload the app. If a Sheet URL is unreachable for any reason, the app automatically falls back to the bundled seed JSON, so a kiosk never shows a blank screen.

The starter rows already in `data/facilities.seed.json` and `data/announcements.seed.json` are a ready-to-paste template — the same field names, in the same shape.

## Setting which building each screen is

Each kiosk needs to know which of the 9 buildings it's in:

- **Fast path**: open the app with `?building=A` in the URL (e.g. `https://your-domain/?building=C`). It's remembered after that (saved to the browser's local storage), so you only need to do this once per device.
- **On-site path**: on the Home screen, tap the KAVALON logo 5 times to open the hidden Settings screen, enter the PIN (default `1919`, change it in `config.js`), then pick the building from the grid.

## What's already populated vs. what still needs content

- 9 buildings (A–I), 5 themed zones, and ~37 facilities are pre-loaded from the real project photography in this project folder — a solid v1, but short of the "60+" facilities mentioned for the full project. Add the rest directly to the Facilities sheet as they're documented/photographed.
- The interactive map pin positions in `data/buildings.json` / `data/zones.json` (the `map: {x, y}` percentages) are a best-effort visual placement against `ground_map.jpg`. The left-to-right **zone order** (Magic Island → Healing Zone → Futuristic World → Theme Park → Mix Forest) is confirmed from the official "Verse of Kavalon" master-plan diagram in `8.Salekit/JPG/Salekits_KAVALON_Part 2-1-01.jpg`, and Building D (leftmost) / Building A (rightmost) are confirmed from the key-plan thumbnails on their own `Part 3/4 Building X` sales-kit pages. The exact order of buildings *within* each zone cluster (e.g. whether E or F sits closer to the Healing Zone boundary) is still an estimate — the sales-kit key-plan thumbnails have the answer but the label text is too low-resolution in the exported JPGs to read reliably; nudge these once checked against the real leasing plan or the lobby screen.
- Sample/placeholder announcements are included — replace them via the Sheet once it's set up.

## File map

```
webapp/
  index.html          Single HTML shell, all screens
  css/styles.css       All styling (brand colors from the KAVALON logo)
  js/config.js         Sheet URLs + kiosk settings (edit this)
  js/data.js           CSV fetch + parsing + local-fallback logic
  js/app.js            Router, rendering, all screen behaviour
  data/buildings.json  9 buildings + map pin coordinates
  data/zones.json      5 zones (+ parking) + map pin coordinates
  data/facilities.seed.json     Bundled facility list (fallback + Sheet template)
  data/announcements.seed.json Bundled announcements (fallback + Sheet template)
  assets/images/        Optimized real project photos (~1600px JPGs)
  assets/brand/         KAVALON logo (white/blue/black)
  assets/fonts/         DB Heavent (brand typeface)
```
