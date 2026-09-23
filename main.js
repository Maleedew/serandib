/* ==========================================================================
   SERENDIB TRAILS — MAIN
   Wires the static shell to the data layer: renders the destination grid,
   packages, features and logbook; runs the one orchestrated hero sequence;
   builds a flat-SVG map fallback for browsers without WebGL; and keeps the
   destination grid, map sidebar list and FAB badge in sync with TripState.
   ========================================================================== */

(function () {
  "use strict";
  var SD = window.SD;
  if (!SD) return;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    setYear();
    initHeaderScroll();
    initNavDrawer();
    initRevealObserver();
    buildHeroVisual();
    buildMapFallback();
    initFilterableDestinations();
    buildPackageGrid();
    buildFeatureGrid();
    buildLogbook();
    buildMapList();
    initFabVisibility();
    SD.TripState.subscribe(refreshSelectionUI);
    refreshSelectionUI();
    window.SerendibConfetti = fireConfetti;
  }

  /* ---------------------------------------------------------------- utils */
  function svgIcon(id) {
    return '<svg aria-hidden="true"><use href="#icon-' + id + '"></use></svg>';
  }
  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }
  function setYear() {
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }

  /* ------------------------------------------------------------- header/nav */
  function initHeaderScroll() {
    var header = document.getElementById("siteHeader");
    if (!header) return;
    function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 8); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function initNavDrawer() {
    var toggle = document.getElementById("menuToggle");
    var drawer = document.getElementById("navDrawer");
    var scrim = document.getElementById("navScrim");
    if (!toggle || !drawer || !scrim) return;

    function open() {
      drawer.classList.add("is-open");
      scrim.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.classList.add("no-scroll");
    }
    function close() {
      drawer.classList.remove("is-open");
      scrim.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("no-scroll");
    }
    toggle.addEventListener("click", function () {
      if (drawer.classList.contains("is-open")) close(); else open();
    });
    scrim.addEventListener("click", close);
    drawer.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", close); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  /* ------------------------------------------------------ one quiet reveal */
  /* A single restrained fade+rise, applied once to each section's framing
     text as it enters view. Not applied to individual cards — the brief
     asked for boldness in the map and the booking flow, not a fade-up on
     every tile on the page. */
  function initRevealObserver() {
    var selectors = [
      ".about__lead", ".about__body", ".map-section__head", ".destinations__head",
      ".tap-travel__inner", ".packages__head", ".features__head", ".logbook__head", ".cta__inner"
    ];
    var targets = document.querySelectorAll(selectors.join(","));
    if (!targets.length) return;
    if (!("IntersectionObserver" in window) || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      targets.forEach(function (t) { t.classList.add("reveal", "is-visible"); });
      return;
    }
    targets.forEach(function (t) { t.classList.add("reveal"); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });
    targets.forEach(function (t) { io.observe(t); });
  }

  /* ---------------------------------------------------- shared geometry -- */
  /* The hero porthole sketch and the no-WebGL map fallback both trace the
     same coastline used to build the 3D relief, so the island silhouette
     you see while the page loads is the same island you spin further down. */
  function projectCoastline() {
    return SD.COASTLINE_LATLON.map(function (ll) { return SD.geo(ll[0], ll[1]); });
  }
  function boundsOf(pts) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(function (p) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: maxX - minX, h: maxY - minY };
  }
  function smoothClosedPathD(pts) {
    var n = pts.length;
    function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
    function fmt(p) { return p.x.toFixed(1) + "," + p.y.toFixed(1); }
    var d = "M" + fmt(mid(pts[n - 1], pts[0]));
    for (var i = 0; i < n; i++) {
      var next = pts[(i + 1) % n];
      d += " Q" + fmt(pts[i]) + " " + fmt(mid(pts[i], next));
    }
    return d + " Z";
  }

  /* ------------------------------------------------------------- hero ---- */
  function buildHeroVisual() {
    var path = document.getElementById("heroIslandPath");
    if (!path) return;
    var raw = projectCoastline();
    var b = boundsOf(raw);
    var cx = b.minX + b.w / 2, cy = b.minY + b.h / 2;
    var scale = 190 / (Math.max(b.w, b.h) / 2);
    var pts = raw.map(function (p) { return { x: (p.x - cx) * scale, y: (p.y - cy) * scale }; });
    path.setAttribute("d", smoothClosedPathD(pts));
    runHeroSequence(path);
  }

  function runHeroSequence(islandPath) {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var textEls = document.querySelectorAll(".hero__title,.hero__desc,.hero__actions");
    var ringEls = document.querySelectorAll(".porthole__ring-outer,.porthole__ring-inner,.porthole__ticks line");

    function play() {
      if (reduce || !window.gsap) {
        islandPath.style.strokeDashoffset = 0;
        textEls.forEach(function (e) { e.style.opacity = 1; });
        ringEls.forEach(function (e) { e.style.opacity = 1; });
        return;
      }
      var len = islandPath.getTotalLength();
      islandPath.style.strokeDasharray = len;
      islandPath.style.strokeDashoffset = len;
      gsap.set(textEls, { opacity: 0, y: 16 });
      gsap.set(ringEls, { opacity: 0 });

      var tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.to(islandPath, { strokeDashoffset: 0, duration: 2.1, ease: "power2.inOut" }, 0)
        .fromTo("#compassNeedle .needle-spin", { rotation: -130 },
          { rotation: 10, duration: 1.7, ease: "elastic.out(1,0.55)", transformOrigin: "0px 0px" }, 0.1)
        .to(ringEls, { opacity: 1, duration: 1.1 }, 0)
        .to(".hero__title", { opacity: 1, y: 0, duration: 0.85 }, 0.25)
        .to(".hero__desc", { opacity: 1, y: 0, duration: 0.75 }, 0.42)
        .to(".hero__actions", { opacity: 1, y: 0, duration: 0.75 }, 0.56);
    }
    play();
  }

  /* ------------------------------------------------- no-webgl map fallback */
  /* Always built (cheap — one small SVG) so it's ready the instant map3d.js
     flags a fallback, whether that's because WebGL is unavailable or the
     three.js CDN request itself failed. */
  function buildMapFallback() {
    var wrap = document.querySelector(".map-wrap");
    var tooltip = document.getElementById("mapTooltip");
    if (!wrap || wrap.querySelector(".map-fallback")) return;

    var raw = projectCoastline();
    var b = boundsOf(raw);
    var pad = Math.max(b.w, b.h) * 0.07;
    var vb = (b.minX - pad).toFixed(1) + " " + (b.minY - pad).toFixed(1) + " " +
      (b.w + pad * 2).toFixed(1) + " " + (b.h + pad * 2).toFixed(1);

    var gw = SD.geo(SD.GATEWAY.lat, SD.GATEWAY.lon);
    var gatewayMark = '<circle class="map-fallback__pin map-fallback__pin--gateway" r="5" ' +
      'cx="' + gw.x.toFixed(1) + '" cy="' + gw.y.toFixed(1) + '" aria-hidden="true"></circle>';

    var pinMarkup = SD.DESTINATIONS.map(function (d) {
      var p = SD.geo(d.lat, d.lon);
      var on = SD.TripState.isSelected(d.id);
      return '<g class="map-fallback__pin-group' + (on ? " is-selected" : "") + '" tabindex="0" role="button" ' +
        'data-id="' + d.id + '" aria-label="' + d.name + ', ' + (on ? "added to trip" : "add to trip") + '" ' +
        'transform="translate(' + p.x.toFixed(1) + "," + p.y.toFixed(1) + ')">' +
        '<circle r="20" fill="transparent"></circle>' +
        '<circle class="map-fallback__pin" r="6.5"></circle></g>';
    }).join("");

    var holder = document.createElement("div");
    holder.className = "map-fallback";
    holder.innerHTML = '<svg viewBox="' + vb + '" preserveAspectRatio="xMidYMid meet">' +
      '<path class="map-fallback__island" d="' + smoothClosedPathD(raw) + '"></path>' +
      gatewayMark + pinMarkup + "</svg>";
    wrap.insertBefore(holder, tooltip || null);

    function toggle(id) {
      SD.TripState.toggle(id);
    }
    holder.addEventListener("click", function (e) {
      var g = e.target.closest("[data-id]");
      if (g) toggle(g.dataset.id);
    });
    holder.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var g = e.target.closest("[data-id]");
      if (!g) return;
      e.preventDefault();
      toggle(g.dataset.id);
    });
    SD.TripState.subscribe(function (sel) {
      holder.querySelectorAll("[data-id]").forEach(function (g) {
        g.classList.toggle("is-selected", sel.indexOf(g.dataset.id) !== -1);
      });
    });
  }

  /* ------------------------------------------------------- destinations -- */
  var currentFilter = "All";

  function initFilterableDestinations() {
    var tabsWrap = document.getElementById("filterTabs");
    if (!tabsWrap) { renderDestGrid(); return; }

    tabsWrap.innerHTML = SD.REGIONS.map(function (r) {
      return '<button type="button" class="filter-tab' + (r === currentFilter ? " is-active" : "") + '" ' +
        'role="tab" aria-selected="' + (r === currentFilter) + '" data-region="' + r + '">' + r + "</button>";
    }).join("") + '<span class="filter-tabs__indicator"></span>';

    function positionIndicator() {
      var active = tabsWrap.querySelector(".filter-tab.is-active");
      var indicator = tabsWrap.querySelector(".filter-tabs__indicator");
      if (!active || !indicator) return;
      indicator.style.width = active.offsetWidth + "px";
      indicator.style.transform = "translateX(" + active.offsetLeft + "px)";
    }

    tabsWrap.querySelectorAll(".filter-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentFilter = btn.dataset.region;
        tabsWrap.querySelectorAll(".filter-tab").forEach(function (b) {
          var active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", String(active));
        });
        positionIndicator();
        renderDestGrid();
      });
    });

    window.addEventListener("resize", debounce(positionIndicator, 150));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(positionIndicator);
    positionIndicator();
    renderDestGrid();
  }

  function destCardHTML(d) {
    var on = SD.TripState.isSelected(d.id);
    return '<article class="dest-card" data-region="' + d.region + '">' +
      '<div class="dest-card__top">' +
      '<span class="dest-card__icon">' + svgIcon(d.icon) + "</span>" +
      '<span class="dest-card__region">' + d.region + "</span>" +
      "</div>" +
      '<h3 class="dest-card__name">' + d.name + "</h3>" +
      '<p class="dest-card__tagline">' + d.tagline + "</p>" +
      '<div class="dest-card__meta"><span>' + d.days + (d.days === 1 ? " day" : " days") +
      '</span><span class="dot"></span><span>From $' + d.price + "</span></div>" +
      '<button type="button" class="dest-card__add' + (on ? " is-on" : "") + '" data-add="' + d.id + '" aria-pressed="' + on + '">' +
      (on ? "Added \u2713" : "Add to trip") + "</button>" +
      "</article>";
  }

  function renderDestGrid() {
    var grid = document.getElementById("destGrid");
    if (!grid) return;
    var list = SD.DESTINATIONS.filter(function (d) { return currentFilter === "All" || d.region === currentFilter; });
    grid.innerHTML = list.map(destCardHTML).join("");
    grid.querySelectorAll("[data-add]").forEach(function (btn) {
      btn.addEventListener("click", function () { SD.TripState.toggle(btn.dataset.add); });
    });
  }

  /* ------------------------------------------------------------ packages - */
  function buildPackageGrid() {
    var grid = document.getElementById("packageGrid");
    if (!grid) return;
    grid.innerHTML = SD.PACKAGES.map(function (p) {
      return '<div class="package-card' + (p.popular ? " package-card--popular" : "") + '">' +
        (p.popular ? '<span class="package-card__tag">Most chosen</span>' : "") +
        '<h3 class="package-card__name">' + p.name + "</h3>" +
        '<p class="package-card__for">' + p.forWhom + "</p>" +
        '<hr class="package-card__divider">' +
        '<div class="package-card__price">$' + p.price + "<small> " + p.unit + "</small></div>" +
        '<ul class="package-card__list">' + p.includes.map(function (item) {
          return "<li>" + svgIcon("check") + "<span>" + item + "</span></li>";
        }).join("") + "</ul>" +
        '<button type="button" class="btn btn--primary" data-open-booking data-package="' + p.id + '">Choose this journey</button>' +
        "</div>";
    }).join("");
  }

  /* ------------------------------------------------------------ features - */
  function buildFeatureGrid() {
    var grid = document.getElementById("featureGrid");
    if (!grid) return;
    grid.innerHTML = SD.FEATURES.map(function (f) {
      return '<div class="feature-card">' +
        '<div class="feature-card__icon">' + svgIcon(f.icon) + "</div>" +
        "<h3>" + f.title + "</h3><p>" + f.text + "</p>" +
        "</div>";
    }).join("");
  }

  /* -------------------------------------------------------------- logbook */
  function buildLogbook() {
    var track = document.getElementById("logTrack");
    if (!track) return;
    track.innerHTML = SD.TESTIMONIALS.map(function (t) {
      return '<article class="log-entry">' +
        '<div class="log-entry__meta">' + t.day + " &middot; " + t.place + "</div>" +
        '<p class="log-entry__quote">\u201C' + t.quote + '\u201D</p>' +
        '<p class="log-entry__author">' + t.name + "</p>" +
        "</article>";
    }).join("");

    var prev = document.getElementById("logPrev"), next = document.getElementById("logNext");
    function scrollByCard(dir) {
      var card = track.querySelector(".log-entry");
      if (!card) return;
      var style = window.getComputedStyle(track);
      var gap = parseFloat(style.columnGap || style.gap || "24") || 24;
      track.scrollBy({ left: dir * (card.getBoundingClientRect().width + gap), behavior: "smooth" });
    }
    if (prev) prev.addEventListener("click", function () { scrollByCard(-1); });
    if (next) next.addEventListener("click", function () { scrollByCard(1); });
  }

  /* ------------------------------------------------------------- map list */
  function buildMapList() {
    var list = document.getElementById("mapList");
    if (!list) return;
    list.innerHTML = SD.DESTINATIONS.map(function (d) {
      var on = SD.TripState.isSelected(d.id);
      return '<div class="map-list__item' + (on ? " is-selected" : "") + '" data-id="' + d.id + '" ' +
        'role="button" tabindex="0" aria-label="Show ' + d.name + ' on the map">' +
        svgIcon(d.icon) + "<strong>" + d.name + "</strong>" +
        '<button type="button" class="toggle" data-toggle="' + d.id + '" aria-label="Add or remove ' + d.name + '" aria-pressed="' + on + '">' +
        svgIcon("check") + "</button>" +
        "</div>";
    }).join("");

    list.addEventListener("click", function (e) {
      var toggleBtn = e.target.closest("[data-toggle]");
      if (toggleBtn) { SD.TripState.toggle(toggleBtn.dataset.toggle); return; }
      var item = e.target.closest("[data-id]");
      if (item && window.SerendibMap) window.SerendibMap.focusOn(item.dataset.id);
    });
    list.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (e.target.closest("[data-toggle]")) return;
      var item = e.target.closest("[data-id]");
      if (!item) return;
      e.preventDefault();
      if (window.SerendibMap) window.SerendibMap.focusOn(item.dataset.id);
    });
  }

  /* ------------------------------------------------------------------ fab */
  function initFabVisibility() {
    var fab = document.getElementById("fabBtn");
    var hero = document.getElementById("home");
    if (!fab || !hero) return;
    if (!("IntersectionObserver" in window)) { fab.classList.add("is-visible"); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { fab.classList.toggle("is-visible", !entry.isIntersecting); });
    }, { threshold: 0.1 });
    io.observe(hero);
  }

  /* -------------------------------------------------- selection sync (all) */
  function refreshSelectionUI() {
    var ids = SD.TripState.getAll();
    document.querySelectorAll("[data-add]").forEach(function (btn) {
      var on = ids.indexOf(btn.dataset.add) !== -1;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? "Added \u2713" : "Add to trip";
    });
    document.querySelectorAll(".map-list__item").forEach(function (item) {
      var on = ids.indexOf(item.dataset.id) !== -1;
      item.classList.toggle("is-selected", on);
      var t = item.querySelector("[data-toggle]");
      if (t) t.setAttribute("aria-pressed", String(on));
    });
    var badge = document.getElementById("fabBadge");
    if (badge) { badge.hidden = ids.length === 0; badge.textContent = ids.length; }
  }

  /* --------------------------------------------------------- confirm burst */
  /* Fires once, when a trip request is actually confirmed — motion that
     answers a real action, not a decorative loop. */
  function fireConfetti() {
    var colors = ["#B8873A", "#3E7691", "#B03F2E", "#ECE0C4"];
    var originY = window.innerHeight * 0.32;
    for (var i = 0; i < 18; i++) {
      (function (i) {
        var piece = document.createElement("span");
        piece.className = "confetti-piece";
        var size = 5 + Math.random() * 6;
        piece.style.width = size + "px";
        piece.style.height = (size * 0.42) + "px";
        piece.style.background = colors[i % colors.length];
        piece.style.left = (window.innerWidth / 2 + (Math.random() - 0.5) * 200) + "px";
        piece.style.top = originY + "px";
        document.body.appendChild(piece);
        if (window.gsap) {
          gsap.to(piece, {
            x: (Math.random() - 0.5) * 260,
            y: 240 + Math.random() * 180,
            rotation: (Math.random() - 0.5) * 520,
            opacity: 0,
            duration: 1 + Math.random() * 0.6,
            ease: "power1.out",
            onComplete: function () { piece.remove(); }
          });
        } else {
          setTimeout(function () { piece.remove(); }, 1100);
        }
      })(i);
    }
  }
})();
