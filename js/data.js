// Data loading layer: fetches the live Google Sheet CSV feeds when configured,
// and always falls back to the bundled seed/static JSON so the kiosk never
// shows a blank screen (offline blip, sheet not set up yet, bad URL, etc.)
const KavalonData = (() => {
  function parseCsv(text) {
    // Minimal RFC4180-ish CSV parser: handles quoted fields, escaped quotes,
    // commas/newlines inside quotes. Good enough for Google Sheets CSV export.
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    if (!rows.length) return [];
    const headers = rows[0].map((h) => h.trim());
    return rows
      .slice(1)
      .filter((r) => r.some((cell) => cell.trim() !== ""))
      .map((r) => {
        const obj = {};
        headers.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
        return obj;
      });
  }

  async function fetchCsv(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    return parseCsv(await res.text());
  }

  async function fetchJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`JSON fetch failed: ${res.status}`);
    return res.json();
  }

  function truthy(v) {
    return /^(true|1|yes|y|pinned)$/i.test(String(v || "").trim());
  }

  function splitImages(v) {
    return String(v || "")
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function normalizeFacilityRow(r) {
    return {
      id: r.id || r.nameEn || r.nameTh,
      building: r.building ? r.building.trim().toUpperCase() : null,
      zone: r.zone || null,
      nameTh: r.nameTh || "",
      nameEn: r.nameEn || r.nameTh || "",
      descTh: r.descTh || "",
      descEn: r.descEn || r.descTh || "",
      images: splitImages(r.images),
      order: r.order ? Number(r.order) || 0 : 0,
    };
  }

  function normalizeAnnouncementRow(r) {
    return {
      id: r.id || `${r.date || ""}-${r.titleEn || r.titleTh || ""}`,
      date: r.date || "",
      category: r.category || "ประกาศ",
      categoryEn: r.categoryEn || r.category || "Notice",
      titleTh: r.titleTh || "",
      titleEn: r.titleEn || r.titleTh || "",
      bodyTh: r.bodyTh || "",
      bodyEn: r.bodyEn || r.bodyTh || "",
      pinned: truthy(r.pinned),
      validUntil: r.validUntil || null,
      image: r.image || null,
    };
  }

  // Exposed so the Settings screen can show staff a quick "is the live
  // Sheet actually connected, or are we silently running on the bundled
  // fallback data?" diagnostic — separate from the resident-facing UI,
  // which never needs to know or care which source it came from.
  const status = { facilities: "not-configured", announcements: "not-configured" };

  async function loadFacilities() {
    const url = window.KAVALON_CONFIG?.facilitiesSheetCsvUrl;
    if (url) {
      try {
        const rows = await fetchCsv(url);
        if (rows.length) {
          status.facilities = "sheet";
          return rows.map(normalizeFacilityRow);
        }
      } catch (err) {
        console.warn("Facilities sheet fetch failed, using bundled seed data.", err);
      }
      status.facilities = "fallback";
    }
    return fetchJson("data/facilities.seed.json");
  }

  async function loadAnnouncements() {
    const url = window.KAVALON_CONFIG?.announcementsSheetCsvUrl;
    if (url) {
      try {
        const rows = await fetchCsv(url);
        if (rows.length) {
          status.announcements = "sheet";
          return rows.map(normalizeAnnouncementRow);
        }
      } catch (err) {
        console.warn("Announcements sheet fetch failed, using bundled seed data.", err);
      }
      status.announcements = "fallback";
    }
    return fetchJson("data/announcements.seed.json");
  }

  async function loadStructural() {
    const [buildings, zones] = await Promise.all([
      fetchJson("data/buildings.json"),
      fetchJson("data/zones.json"),
    ]);
    return { buildings, zones };
  }

  return { loadFacilities, loadAnnouncements, loadStructural, parseCsv, status };
})();
