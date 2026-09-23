/* ==========================================================================
   SERENDIB TRAILS — TAP & TRAVEL BOOKING FLOW
   A five-step panel that never talks to a real backend: it collects a trip
   shape and contact details, then hands back a reference code. Anything
   date-related is generated client-side from "today", so it always looks
   current without needing a server.
   ========================================================================== */

(function () {
  "use strict";
  const SD = window.SD;

  const overlay = document.getElementById("bookingOverlay");
  const panel = document.getElementById("bookingPanel");
  if (!overlay || !panel || !SD) return;

  const body = document.getElementById("bookingBody");
  const closeBtn = document.getElementById("bookingClose");
  const backBtn = document.getElementById("bookingBack");
  const nextBtn = document.getElementById("bookingNext");
  const footer = document.getElementById("bookingFooter");
  const summaryEl = document.getElementById("bookingSummary");
  const stepEls = Array.from(document.querySelectorAll(".bstep"));
  const chipGrid = document.getElementById("chipGrid");
  const dateStrip = document.getElementById("dateStrip");
  const lengthRow = document.getElementById("lengthRow");
  const journeyGrid = document.getElementById("journeyGrid");
  const adultsValue = document.getElementById("adultsValue");
  const childrenValue = document.getElementById("childrenValue");

  const STEPS = [1, 2, 3, 4, 5];
  const state = {
    step: 1,
    startDate: null,
    lengthDays: 5,
    adults: 2,
    children: 0,
    packageId: "guided",
    name: "", email: "", phone: "", notes: ""
  };
  let lastFocused = null;

  // ---------------------------------------------------------------- open/close
  function open(trigger) {
    if (trigger && trigger.dataset && trigger.dataset.package) state.packageId = trigger.dataset.package;
    lastFocused = document.activeElement;
    overlay.classList.add("is-open");
    document.body.classList.add("no-scroll");
    renderAll();
    goToStep(state.step === "success" ? 1 : state.step);
    setTimeout(function () { closeBtn.focus(); }, 50);
  }
  function close() {
    overlay.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  // Delegated, not a one-time querySelectorAll — the three package-card
  // "Choose this journey" buttons are rendered by main.js *after* this file
  // runs, so a static forEach would silently miss them.
  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-open-booking]");
    if (trigger) open(trigger);
  });
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
  });

  // ---------------------------------------------------------------- step nav
  function goToStep(n) {
    state.step = n;
    document.querySelectorAll(".bpanel").forEach(function (p) {
      p.classList.toggle("is-active", p.dataset.step == n);
    });
    stepEls.forEach(function (s) {
      const sn = Number(s.dataset.step);
      s.classList.toggle("is-active", n !== "success" && sn === n);
      s.classList.toggle("is-done", n !== "success" && sn < n);
    });
    footer.style.display = n === "success" ? "none" : "flex";
    backBtn.style.visibility = n === 1 ? "hidden" : "visible";
    nextBtn.textContent = n === 5 ? "Confirm trip request" : "Next";
    body.scrollTop = 0;
    updateSummary();
  }

  backBtn.addEventListener("click", function () {
    const i = STEPS.indexOf(state.step);
    if (i > 0) goToStep(STEPS[i - 1]);
  });
  nextBtn.addEventListener("click", function () {
    if (!validateStep(state.step)) return;
    if (state.step === 5) { submit(); return; }
    const i = STEPS.indexOf(state.step);
    goToStep(STEPS[i + 1]);
  });

  function validateStep(n) {
    if (n === 1 && SD.TripState.getAll().length === 0) {
      shake(chipGrid);
      return false;
    }
    if (n === 2 && !state.startDate) {
      shake(dateStrip);
      return false;
    }
    if (n === 5) {
      const nameEl = document.getElementById("fName");
      const emailEl = document.getElementById("fEmail");
      state.name = nameEl.value.trim();
      state.email = emailEl.value.trim();
      state.phone = document.getElementById("fPhone").value.trim();
      state.notes = document.getElementById("fNotes").value.trim();
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email);
      if (!state.name || !emailOk) {
        if (!state.name) shake(nameEl.parentElement);
        if (!emailOk) shake(emailEl.parentElement);
        return false;
      }
    }
    return true;
  }
  function shake(el) {
    if (!el) return;
    el.classList.remove("is-shaking");
    void el.offsetWidth;
    el.classList.add("is-shaking");
  }

  // ---------------------------------------------------------------- renderers
  function renderAll() {
    renderChips();
    renderDates();
    renderLengths();
    renderJourneys();
    adultsValue.textContent = state.adults;
    childrenValue.textContent = state.children;
  }

  function renderChips() {
    const selected = SD.TripState.getAll();
    chipGrid.innerHTML = SD.DESTINATIONS.map(function (d) {
      const on = selected.indexOf(d.id) !== -1;
      return '<button type="button" class="chip' + (on ? " is-active" : "") + '" data-id="' + d.id + '">' +
        '<svg viewBox="0 0 48 48"><use href="#icon-' + d.icon + '"/></svg>' + d.name + "</button>";
    }).join("");
    chipGrid.querySelectorAll(".chip").forEach(function (c) {
      c.addEventListener("click", function () { SD.TripState.toggle(c.dataset.id); });
    });
  }

  function renderDates() {
    const today = new Date();
    const frag = [];
    for (let i = 1; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const wd = d.toLocaleDateString(undefined, { weekday: "short" });
      const dm = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
      const on = state.startDate === iso;
      frag.push('<button type="button" class="date-chip' + (on ? " is-active" : "") + '" data-iso="' + iso + '"><span>' + wd + "</span><strong>" + dm + "</strong></button>");
    }
    dateStrip.innerHTML = frag.join("");
    dateStrip.querySelectorAll(".date-chip").forEach(function (c) {
      c.addEventListener("click", function () {
        state.startDate = c.dataset.iso;
        renderDates();
        updateSummary();
      });
    });
  }

  function renderLengths() {
    const opts = [{ v: 3, l: "3 days" }, { v: 5, l: "5 days" }, { v: 7, l: "7 days" }, { v: 10, l: "10+ days" }];
    lengthRow.innerHTML = opts.map(function (o) {
      return '<button type="button" class="pill' + (state.lengthDays === o.v ? " is-active" : "") + '" data-v="' + o.v + '">' + o.l + "</button>";
    }).join("");
    lengthRow.querySelectorAll(".pill").forEach(function (b) {
      b.addEventListener("click", function () {
        state.lengthDays = Number(b.dataset.v);
        renderLengths();
        updateSummary();
      });
    });
  }

  function renderJourneys() {
    journeyGrid.innerHTML = SD.PACKAGES.map(function (p) {
      const on = state.packageId === p.id;
      return '<button type="button" class="journey-card' + (on ? " is-active" : "") + '" data-id="' + p.id + '">' +
        (p.popular ? '<span class="journey-card__tag">Most chosen</span>' : "") +
        "<strong>" + p.name + "</strong><span class=\"journey-card__for\">" + p.forWhom + "</span>" +
        '<span class="journey-card__price">$' + p.price + '<small>/ ' + p.unit + "</small></span></button>";
    }).join("");
    journeyGrid.querySelectorAll(".journey-card").forEach(function (b) {
      b.addEventListener("click", function () {
        state.packageId = b.dataset.id;
        renderJourneys();
        updateSummary();
      });
    });
  }

  document.querySelectorAll("[data-stepper]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const key = btn.dataset.stepper;
      const dir = Number(btn.dataset.dir);
      const min = key === "adults" ? 1 : 0;
      const max = key === "adults" ? 12 : 8;
      state[key] = Math.max(min, Math.min(max, state[key] + dir));
      (key === "adults" ? adultsValue : childrenValue).textContent = state[key];
      updateSummary();
    });
  });

  SD.TripState.subscribe(function () { renderChips(); updateSummary(); });

  function updateSummary() {
    const places = SD.TripState.getAll().length;
    const pkg = SD.PACKAGES.find(function (p) { return p.id === state.packageId; }) || SD.PACKAGES[1];
    const travellers = state.adults + state.children * 0.6;
    const total = Math.round(pkg.price * state.lengthDays * Math.max(travellers, 1));
    const bits = [
      places + (places === 1 ? " place" : " places"),
      state.lengthDays + (state.lengthDays === 10 ? "+ days" : " days"),
      (state.adults + state.children) + (state.adults + state.children === 1 ? " traveller" : " travellers")
    ];
    summaryEl.innerHTML = bits.join(" &middot; ") + '<strong>~$' + total.toLocaleString() + " est.</strong>";
  }

  // ---------------------------------------------------------------- submit
  function refCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return "SRD-" + s;
  }

  function submit() {
    const ref = refCode();
    document.getElementById("stampRef").textContent = ref;
    goToStep("success");

    const stamp = document.querySelector(".stamp");
    if (window.gsap && stamp) {
      gsap.fromTo(stamp,
        { scale: 2.6, rotate: -18, opacity: 0 },
        { scale: 1, rotate: -8, opacity: 1, duration: 0.65, ease: "back.out(2.4)" });
    }
    if (window.SerendibConfetti) window.SerendibConfetti();
  }

  document.getElementById("bookingReset").addEventListener("click", function () {
    SD.TripState.getAll().slice().forEach(function (id) { SD.TripState.toggle(id); });
    state.startDate = null;
    state.lengthDays = 5;
    state.adults = 2;
    state.children = 0;
    state.packageId = "guided";
    ["fName", "fEmail", "fPhone", "fNotes"].forEach(function (id) { document.getElementById(id).value = ""; });
    renderAll();
    goToStep(1);
  });

  window.SerendibBooking = { open: open, close: close };
})();
