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
   | id | date | category | categoryEn | titleTh | titleEn | bodyTh | bodyEn | pinned | validUntil | image |
   |---|---|---|---|---|---|---|---|---|---|---|
   | welcome-2026 | 2026-09-01 | ประกาศ | Notice | หัวข้อภาษาไทย | English title | เนื้อหาภาษาไทย | English body | TRUE | | (leave blank or a filename already in assets/images) |

   - `date`: `YYYY-MM-DD`.
   - `pinned`: `TRUE` to pin an item — it also shows as a highlighted banner on the Home screen (below the hero image), not just at the top of the announcements list. Only one pinned item is featured on Home at a time (the most recent one still valid).
   - `validUntil`: optional `YYYY-MM-DD`. Once this date has fully passed, the announcement disappears everywhere on its own — no need to come back and delete it. Leave blank for announcements that should stay up indefinitely.
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

### Re-calibrating the map pins

The Settings screen (after entering the PIN) also has a **"🛠 Calibrate map pin positions"** button. It puts the Site Map into an editable mode: drag any building or zone pin straight onto the map image itself, tap **"Copy positions"** to copy the updated coordinates, and paste that text back wherever you're getting development help — it's a plain JSON snippet naming each building/zone and its new `{x, y}` percentage, ready to drop into `data/buildings.json` / `data/zones.json`. Dragging alone only changes what's on screen *for that session*; nothing is saved to disk until those two files are updated with the copied values.

## What's already populated vs. what still needs content

- 9 buildings (A–I), 5 themed zones, and ~37 facilities are pre-loaded from the real project photography in this project folder — a solid v1, but short of the "60+" facilities mentioned for the full project. Add the rest directly to the Facilities sheet as they're documented/photographed.
- The interactive map pin positions in `data/buildings.json` / `data/zones.json` have been hand-calibrated on-screen (see "Re-calibrating the map pins" above) against the real site plan, rather than guessed — but if the physical lobby screens reveal any are still slightly off, redo them the same way.
- Sample/placeholder announcements are included — replace them via the Sheet once it's set up.
- **Shuttle Bus schedule**, **Contact the Juristic Office** (phone/email/hours), and the **security guard hotline + assembly point** on the Emergency screen are placeholder screens waiting on real details from the juristic office — everything else on the Emergency screen (police 191, fire 199, medical/EMS 1669) is Thailand's real national hotlines and is already live.

## Scope note: this is lobby signage, not a resident account app

This directory is meant to run on the fixed touchscreen in each lobby (and optionally be scanned onto a resident's own phone for read-only browsing) — a way-finding and announcements display. It deliberately does **not** duplicate anything the juristic office's existing resident app already handles: facility bookings, maintenance requests, bill payment, resident accounts/login, etc. Keep new feature ideas within "helps someone standing in the lobby find/know something" and it'll stay in scope.

## Kiosk deployment checklist

Notes for whoever sets up the physical touchscreen/mini-PC in each lobby:

- **Run the browser in kiosk mode** so there's no address bar, tabs, or way to back out to the OS — e.g. Chrome: `chrome --kiosk --noerrdialogs --disable-session-crashed-bubble http://<your-deployed-url>/?building=A` (swap the building letter per screen).
- **Auto-launch on boot** (into that kiosk-mode browser command) so the screen recovers on its own after a power cut, with no one needing to touch it.
- **Auto-reload once a day** (e.g. 3–4 AM local time, when no one's using it) — a simple OS-level scheduled task that refreshes the browser or restarts the kiosk process. This clears any memory build-up from being left open 24/7 and picks up any redeploy.
- **Disable the screen's own sleep/screensaver** at the OS level — the app has its own idle "attract" screen (see `idleTimeoutMs` in `config.js`) and shouldn't be fighting the OS for control of the display.
- Each screen should be given its own building via `?building=X` in the launch URL (see "Setting which building each screen is" above) so it doesn't need manual setup after a reboot.
- The app already applies some in-browser hardening for a public touchscreen (blocks the long-press/right-click context menu, disables pull-to-refresh/overscroll bounce) — but real lock-down (stopping someone from swiping away to the home screen or opening another app) has to happen at the OS/device level, e.g. Android's Screen Pinning, or a dedicated kiosk-launcher app if running on an Android box.

## File map

```
webapp/
  index.html          Single HTML shell, all screens
  css/styles.css       All styling (brand colors from the KAVALON logo)
  js/config.js         Sheet URLs + kiosk settings (edit this)
  js/data.js           CSV fetch + parsing + local-fallback logic
  js/app.js            Router, rendering, all screen behaviour
  js/vendor/qrcode.min.js  Vendored QR generator (no CDN) for "scan to view on your phone"
  data/buildings.json  9 buildings + map pin coordinates
  data/zones.json      5 zones (+ parking) + map pin coordinates
  data/facilities.seed.json     Bundled facility list (fallback + Sheet template)
  data/announcements.seed.json Bundled announcements (fallback + Sheet template)
  assets/images/        Optimized real project photos (~1600px JPGs)
  assets/brand/         KAVALON logo (white/blue/black)
  assets/fonts/         DB Heavent (brand typeface)
```
