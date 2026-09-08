(function () {
  "use strict";

  const CFG = window.KAVALON_CONFIG || {};
  const STORAGE_BUILDING = "kavalon.buildingId";
  const STORAGE_LANG = "kavalon.lang";

  const state = {
    lang: localStorage.getItem(STORAGE_LANG) || "th",
    buildingId: null,
    buildings: [],
    zones: [],
    facilities: [],
    announcements: [],
    currentScreen: "home",
    facilityFilter: "all", // 'all' | '__mybuilding' | zoneId
    currentFacility: null,
    currentAnnouncement: null,
    galleryIndex: 0,
    pinBuffer: "",
    idleTimer: null,
    attractTimer: null,
    attractIndex: 0,
  };

  // ---------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $all = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function t(thVal, enVal) {
    return state.lang === "en" ? (enVal ?? thVal) : thVal;
  }

  function applyStaticTranslations() {
    $all("[data-th]").forEach((el) => {
      const th = el.getAttribute("data-th");
      const en = el.getAttribute("data-en");
      const val = state.lang === "en" && en ? en : th;
      if (val) el.textContent = val;
    });
  }

  function findBuilding(id) {
    return state.buildings.find((b) => b.id === id) || null;
  }
  function findZone(id) {
    return state.zones.find((z) => z.id === id) || null;
  }
  function buildingLabel(b) {
    if (!b) return "";
    return t(b.nameTh, b.nameEn);
  }
  function zoneLabel(z) {
    if (!z) return "";
    return t(z.nameTh, z.nameEn);
  }
  function imgUrl(name) {
    return name ? `assets/images/${name}` : "";
  }

  // ---------------------------------------------------------------
  // Building identity (per-kiosk)
  // ---------------------------------------------------------------
  function resolveBuildingId() {
    const params = new URLSearchParams(location.search);
    const fromQuery = (params.get("building") || "").toUpperCase();
    if (fromQuery && findBuildingIdValid(fromQuery)) {
      localStorage.setItem(STORAGE_BUILDING, fromQuery);
      return fromQuery;
    }
    const stored = (localStorage.getItem(STORAGE_BUILDING) || "").toUpperCase();
    if (stored && findBuildingIdValid(stored)) return stored;
    return state.buildings[0] ? state.buildings[0].id : null;
  }
  function findBuildingIdValid(id) {
    return state.buildings.some((b) => b.id === id);
  }
  function setBuildingId(id) {
    state.buildingId = id;
    localStorage.setItem(STORAGE_BUILDING, id);
    renderBuildingChrome();
  }

  function renderBuildingChrome() {
    const b = findBuilding(state.buildingId);
    $("#attract-building-id").textContent = state.buildingId || "-";
    $("#topbar-building-value").textContent = state.buildingId || "-";
    $("#dashboard-building").textContent = state.buildingId || "-";
    if (b) {
      const cover = b.zoneId ? findZone(b.zoneId)?.cover : null;
      if (cover) $("#dashboard-hero").style.backgroundImage = `url(${imgUrl(cover)})`;
    }
  }

  // ---------------------------------------------------------------
  // Clock
  // ---------------------------------------------------------------
  function tickClock() {
    const now = new Date();
    const time = now.toLocaleTimeString(state.lang === "en" ? "en-GB" : "th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const dateOpts = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    const date = now.toLocaleDateString(state.lang === "en" ? "en-GB" : "th-TH", dateOpts);
    $("#topbar-time").textContent = time;
    $("#topbar-date").textContent = date;
    const ac = $("#attract-clock");
    if (ac) ac.textContent = `${time} · ${date}`;
  }

  // ---------------------------------------------------------------
  // Language toggle
  // ---------------------------------------------------------------
  function setLang(lang) {
    state.lang = lang;
    localStorage.setItem(STORAGE_LANG, lang);
    $("#lang-th").classList.toggle("active", lang === "th");
    $("#lang-en").classList.toggle("active", lang === "en");
    document.documentElement.lang = lang;
    applyStaticTranslations();
    renderBuildingChrome();
    tickClock();
    // re-render whatever data-driven screen is active
    renderMapPins();
    renderFacilityChips();
    renderFacilityGrid();
    renderDashboardNews();
    renderAnnouncementList();
    if (state.currentFacility) renderFacilityDetail(state.currentFacility);
    if (state.currentAnnouncement) renderAnnouncementDetail(state.currentAnnouncement);
  }

  // ---------------------------------------------------------------
  // Router
  // ---------------------------------------------------------------
  function goto(screen, opts) {
    opts = opts || {};
    state.currentScreen = screen;
    $all(".screen").forEach((s) => s.classList.remove("active"));
    const target = $("#screen-" + screen);
    if (target) target.classList.add("active");
    if (target) target.scrollTop = 0;

    const isHome = screen === "home";
    $("#topbar").style.display = isHome ? "none" : "flex";
    $("#bottom-nav").style.display = isHome ? "none" : "flex";

    $all(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-goto") === screen);
    });

    if (screen === "facilities" && opts.filter !== undefined) {
      state.facilityFilter = opts.filter;
      renderFacilityChips();
      renderFacilityGrid();
    }
    if (isHome) startAttractLoop();
    else stopAttractLoop();

    resetIdleTimer();
  }

  document.addEventListener("click", (e) => {
    const gotoEl = e.target.closest("[data-goto]");
    if (gotoEl) {
      const screen = gotoEl.getAttribute("data-goto");
      const filter = gotoEl.getAttribute("data-zone-filter");
      if (screen === "dashboard" && state.currentScreen === "home") {
        enterApp();
        return;
      }
      goto(screen, filter !== null ? { filter: filter === "__mybuilding" ? "__mybuilding" : filter } : {});
    }
  });

  function enterApp() {
    goto("dashboard");
  }

  $("#attract").addEventListener("click", enterApp);

  // ---------------------------------------------------------------
  // Idle timeout -> back to attract screen
  // ---------------------------------------------------------------
  function resetIdleTimer() {
    if (state.idleTimer) clearTimeout(state.idleTimer);
    if (!CFG.idleTimeoutMs || state.currentScreen === "home") return;
    state.idleTimer = setTimeout(() => {
      goto("home");
    }, CFG.idleTimeoutMs);
  }
  ["click", "touchstart", "mousemove", "keydown"].forEach((ev) =>
    document.addEventListener(ev, resetIdleTimer, { passive: true })
  );

  // ---------------------------------------------------------------
  // Attract screen slideshow
  // ---------------------------------------------------------------
  function startAttractLoop() {
    const covers = state.zones.map((z) => z.cover).filter(Boolean);
    const wrap = $("#attract-slides");
    if (!wrap) return;
    if (!wrap.dataset.built) {
      wrap.innerHTML = covers
        .map((c, i) => `<div class="attract-slide${i === 0 ? " show" : ""}" style="background-image:url(${imgUrl(c)})"></div>`)
        .join("");
      wrap.dataset.built = "1";
    }
    stopAttractLoop();
    state.attractTimer = setInterval(() => {
      const slides = $all(".attract-slide", wrap);
      if (!slides.length) return;
      slides[state.attractIndex].classList.remove("show");
      state.attractIndex = (state.attractIndex + 1) % slides.length;
      slides[state.attractIndex].classList.add("show");
    }, 6000);
  }
  function stopAttractLoop() {
    if (state.attractTimer) clearInterval(state.attractTimer);
  }

  // ---------------------------------------------------------------
  // Site map
  // ---------------------------------------------------------------
  function renderMapPins() {
    const wrap = $("#map-pins");
    if (!wrap) return;
    const pins = [];
    state.zones.forEach((z) => {
      if (!z.map) return;
      pins.push(`
        <div class="map-pin zone" style="left:${z.map.x}%; top:${z.map.y}%;" data-zone="${z.id}">
          <div class="dot"><span>★</span></div>
          <div class="pin-label">${zoneLabel(z)}</div>
        </div>`);
    });
    state.buildings.forEach((b) => {
      if (!b.map) return;
      const isHere = b.id === state.buildingId;
      pins.push(`
        <div class="map-pin${isHere ? " here" : ""}" style="left:${b.map.x}%; top:${b.map.y}%;" data-building="${b.id}">
          <div class="dot"><span>${b.id}</span></div>
          <div class="pin-label">${isHere ? "📍 " : ""}${buildingLabel(b)}</div>
        </div>`);
    });
    wrap.innerHTML = pins.join("");
    $all(".map-pin", wrap).forEach((el) => {
      el.addEventListener("click", () => {
        const zoneId = el.getAttribute("data-zone");
        const buildingId = el.getAttribute("data-building");
        if (zoneId) goto("facilities", { filter: zoneId });
        else if (buildingId) goto("facilities", { filter: "__building:" + buildingId });
      });
    });
  }

  // ---------------------------------------------------------------
  // Facilities
  // ---------------------------------------------------------------
  function renderFacilityChips() {
    const wrap = $("#facility-filter-chips");
    if (!wrap) return;
    const chips = [{ id: "all", label: t("ทั้งหมด", "All") }].concat(
      state.zones
        .filter((z) => z.id !== "parking")
        .map((z) => ({ id: z.id, label: zoneLabel(z) }))
    );
    wrap.innerHTML = chips
      .map(
        (c) =>
          `<div class="chip${matchesFilter(c.id) ? " active" : ""}" data-filter="${c.id}">${c.label}</div>`
      )
      .join("");
    $all(".chip", wrap).forEach((el) => {
      el.addEventListener("click", () => {
        state.facilityFilter = el.getAttribute("data-filter");
        renderFacilityChips();
        renderFacilityGrid();
      });
    });
  }
  function matchesFilter(chipId) {
    if (state.facilityFilter === "__mybuilding") return false;
    if (state.facilityFilter.startsWith("__building:")) return false;
    return state.facilityFilter === chipId;
  }

  function currentFilteredFacilities() {
    let list = state.facilities.slice();
    const f = state.facilityFilter;
    if (f === "all") return list;
    if (f === "__mybuilding") return list.filter((x) => x.building === state.buildingId);
    if (f.startsWith("__building:")) return list.filter((x) => x.building === f.split(":")[1]);
    return list.filter((x) => x.zone === f);
  }

  function renderFacilityGrid() {
    const wrap = $("#facility-grid");
    if (!wrap) return;
    const list = currentFilteredFacilities();
    if (!list.length) {
      wrap.innerHTML = `<div class="empty-state">${t(
        "ยังไม่มีรายการในหมวดนี้",
        "No facilities in this category yet"
      )}</div>`;
      return;
    }
    wrap.innerHTML = list
      .map((f) => {
        const img = f.images && f.images[0] ? imgUrl(f.images[0]) : "";
        const b = findBuilding(f.building);
        const meta = b ? buildingLabel(b) : zoneLabel(findZone(f.zone));
        return `
        <div class="facility-card" data-id="${f.id}">
          <div class="thumb" style="background-image:url(${img})"></div>
          <div class="body">
            <div class="name">${t(f.nameTh, f.nameEn)}</div>
            <div class="meta">${meta}</div>
          </div>
        </div>`;
      })
      .join("");
    $all(".facility-card", wrap).forEach((el) => {
      el.addEventListener("click", () => {
        const f = state.facilities.find((x) => x.id === el.getAttribute("data-id"));
        if (f) openFacility(f);
      });
    });
  }

  function openFacility(f) {
    state.currentFacility = f;
    state.galleryIndex = 0;
    renderFacilityDetail(f);
    goto("facility-detail");
  }

  function renderFacilityDetail(f) {
    const gallery = $("#facility-gallery");
    const imgs = f.images && f.images.length ? f.images : [];
    $all("img.gd", gallery).forEach((n) => n.remove());
    imgs.forEach((name, i) => {
      const im = document.createElement("img");
      im.className = "gd" + (i === state.galleryIndex ? " show" : "");
      im.src = imgUrl(name);
      gallery.insertBefore(im, $("#fd-prev"));
    });
    $("#fd-dots").innerHTML = imgs.map((_, i) => `<div class="d${i === state.galleryIndex ? " active" : ""}"></div>`).join("");

    const b = findBuilding(f.building);
    const z = findZone(f.zone);
    $("#fd-title").textContent = t(f.nameTh, f.nameEn);
    $("#fd-tags").innerHTML = [
      b ? `<div class="tag">${buildingLabel(b)}</div>` : "",
      z ? `<div class="tag">${zoneLabel(z)}</div>` : "",
    ].join("");
    $("#fd-desc").textContent = t(f.descTh, f.descEn);
  }
  function shiftGallery(delta) {
    const f = state.currentFacility;
    if (!f || !f.images || !f.images.length) return;
    const n = f.images.length;
    state.galleryIndex = (state.galleryIndex + delta + n) % n;
    renderFacilityDetail(f);
  }
  $("#fd-prev").addEventListener("click", () => shiftGallery(-1));
  $("#fd-next").addEventListener("click", () => shiftGallery(1));

  // ---------------------------------------------------------------
  // Announcements
  // ---------------------------------------------------------------
  function sortedAnnouncements() {
    return state.announcements.slice().sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return (b.date || "").localeCompare(a.date || "");
    });
  }
  function formatDateBadge(dateStr) {
    const dt = new Date(dateStr);
    if (isNaN(dt)) return { d: "-", m: "-" };
    const d = dt.getDate();
    const m = dt.toLocaleDateString(state.lang === "en" ? "en-GB" : "th-TH", { month: "short" });
    return { d, m };
  }
  function renderDashboardNews() {
    const wrap = $("#dashboard-news-list");
    if (!wrap) return;
    const list = sortedAnnouncements().slice(0, 3);
    wrap.innerHTML = announceCardsHtml(list);
    bindAnnounceCards(wrap);
  }
  function renderAnnouncementList() {
    const wrap = $("#announce-list");
    if (!wrap) return;
    const list = sortedAnnouncements();
    wrap.innerHTML = list.length
      ? announceCardsHtml(list)
      : `<div class="empty-state">${t("ยังไม่มีประกาศ", "No announcements yet")}</div>`;
    bindAnnounceCards(wrap);
  }
  function announceCardsHtml(list) {
    return list
      .map((a) => {
        const badge = formatDateBadge(a.date);
        return `
        <div class="announce-card${a.pinned ? " pinned" : ""}" data-id="${a.id}">
          <div class="a-date-badge"><div class="d">${badge.d}</div><div class="m">${badge.m}</div></div>
          <div class="a-body">
            <div class="a-cat">${t(a.category, a.categoryEn)}</div>
            <div class="a-title">${t(a.titleTh, a.titleEn)}</div>
            <div class="a-excerpt">${t(a.bodyTh, a.bodyEn)}</div>
          </div>
        </div>`;
      })
      .join("");
  }
  function bindAnnounceCards(wrap) {
    $all(".announce-card", wrap).forEach((el) => {
      el.addEventListener("click", () => {
        const a = state.announcements.find((x) => x.id === el.getAttribute("data-id"));
        if (a) openAnnouncement(a);
      });
    });
  }
  function openAnnouncement(a) {
    state.currentAnnouncement = a;
    renderAnnouncementDetail(a);
    goto("news-detail");
  }
  function renderAnnouncementDetail(a) {
    $("#nd-tags").innerHTML = `<div class="tag">${t(a.category, a.categoryEn)}</div>`;
    $("#nd-title").textContent = t(a.titleTh, a.titleEn);
    const dt = new Date(a.date);
    $("#nd-date").textContent = isNaN(dt)
      ? a.date
      : dt.toLocaleDateString(state.lang === "en" ? "en-GB" : "th-TH", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
    $("#nd-body").textContent = t(a.bodyTh, a.bodyEn);
  }

  // ---------------------------------------------------------------
  // Settings (hidden, PIN-gated)
  // ---------------------------------------------------------------
  let logoTapCount = 0;
  let logoTapTimer = null;
  function armLogoTap(el) {
    el.addEventListener("click", () => {
      logoTapCount++;
      clearTimeout(logoTapTimer);
      logoTapTimer = setTimeout(() => (logoTapCount = 0), 1500);
      if (logoTapCount >= 5) {
        logoTapCount = 0;
        openSettings();
      }
    });
  }
  armLogoTap($("#topbar-logo"));
  armLogoTap($(".attract-top img"));

  function openSettings() {
    state.pinBuffer = "";
    renderPinDots();
    $("#pin-error").textContent = "";
    $("#settings-pin-box").style.display = "block";
    $("#settings-config-box").style.display = "none";
    goto("settings");
  }
  function renderPinDots() {
    const pinLen = (CFG.settingsPin || "").length || 4;
    $("#pin-dots").innerHTML = Array.from({ length: pinLen })
      .map((_, i) => `<div class="pd${i < state.pinBuffer.length ? " filled" : ""}"></div>`)
      .join("");
  }
  function buildKeypad() {
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"];
    $("#pin-keypad").innerHTML = keys.map((k) => `<button data-key="${k}">${k}</button>`).join("");
    $all("#pin-keypad button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = btn.getAttribute("data-key");
        if (k === "⌫") {
          state.pinBuffer = state.pinBuffer.slice(0, -1);
        } else if (k === "OK") {
          checkPin();
          return;
        } else {
          state.pinBuffer += k;
        }
        renderPinDots();
      });
    });
  }
  function checkPin() {
    if (state.pinBuffer === (CFG.settingsPin || "")) {
      $("#settings-pin-box").style.display = "none";
      $("#settings-config-box").style.display = "block";
      renderBuildingSelectGrid();
    } else {
      $("#pin-error").textContent = t("รหัสไม่ถูกต้อง ลองอีกครั้ง", "Incorrect PIN, try again");
      state.pinBuffer = "";
      renderPinDots();
    }
  }
  function renderBuildingSelectGrid() {
    const wrap = $("#building-select-grid");
    wrap.innerHTML = state.buildings
      .map(
        (b) =>
          `<button data-b="${b.id}" class="${b.id === state.buildingId ? "selected" : ""}">${b.id}</button>`
      )
      .join("");
    $all("button", wrap).forEach((btn) => {
      btn.addEventListener("click", () => {
        setBuildingId(btn.getAttribute("data-b"));
        renderBuildingSelectGrid();
        renderMapPins();
      });
    });
  }

  $("#lang-th").addEventListener("click", () => setLang("th"));
  $("#lang-en").addEventListener("click", () => setLang("en"));

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  async function boot() {
    buildKeypad();
    const structural = await KavalonData.loadStructural();
    state.buildings = structural.buildings;
    state.zones = structural.zones;
    state.buildingId = resolveBuildingId();

    const [facilities, announcements] = await Promise.all([
      KavalonData.loadFacilities(),
      KavalonData.loadAnnouncements(),
    ]);
    state.facilities = facilities;
    state.announcements = announcements;

    setLang(state.lang);
    renderBuildingChrome();
    renderMapPins();
    renderFacilityChips();
    renderFacilityGrid();
    renderDashboardNews();
    renderAnnouncementList();

    tickClock();
    setInterval(tickClock, 15000);
    startAttractLoop();

    if (CFG.refreshIntervalMs) {
      setInterval(async () => {
        try {
          state.facilities = await KavalonData.loadFacilities();
          state.announcements = await KavalonData.loadAnnouncements();
          renderFacilityGrid();
          renderDashboardNews();
          renderAnnouncementList();
        } catch (e) {
          console.warn("Background refresh failed", e);
        }
      }, CFG.refreshIntervalMs);
    }
  }

  boot();
})();
