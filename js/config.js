// KAVALON Digital Directory — runtime configuration
//
// HOW TO CONNECT THE GOOGLE SHEET CMS
// 1. Create a Google Sheet with two tabs named "Announcements" and "Facilities".
//    Use the exact column headers described in webapp/README.md.
// 2. File > Share > Publish to web > choose each tab individually > Comma-separated
//    values (.csv) > Publish. Copy the resulting URL for each tab.
// 3. Paste the two URLs below, replacing the empty strings.
// 4. If left empty, the app runs entirely on the bundled seed data in webapp/data/
//    (facilities.seed.json / announcements.seed.json) — handy for first setup/testing.
window.KAVALON_CONFIG = {
  announcementsSheetCsvUrl: "",
  facilitiesSheetCsvUrl: "",

  // How often (ms) to re-fetch the Sheets while the app is running.
  refreshIntervalMs: 5 * 60 * 1000,

  // Kiosk idle behaviour: after this many ms of no touch/click, return to the
  // Home/attract screen. Set to 0 to disable.
  idleTimeoutMs: 90 * 1000,

  // Settings screen PIN (tap the logo 5x on the Home screen to open it).
  settingsPin: "1919",
};
