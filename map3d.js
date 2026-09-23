/* ==========================================================================
   SERENDIB TRAILS — 3D RELIEF MAP
   Builds the island as an extruded shape from real coastline coordinates,
   places a pin per destination using the same projection, and exposes a
   tiny public API ( SerendibMap.focusOn ) for other scripts to call.
   ========================================================================== */

window.SerendibMap = (function () {
  "use strict";

  const wrap = document.querySelector(".map-wrap");
  const canvas = document.getElementById("mapCanvas");
  const tooltip = document.getElementById("mapTooltip");
  const hint = document.getElementById("mapHint");
  if (!wrap || !canvas || typeof THREE === "undefined") {
    if (wrap) wrap.classList.add("map-wrap--fallback");
    return { focusOn: function () {} };
  }

  const SD = window.SD;
  const PALETTE = {
    brass: 0xb8873a,
    brassLight: 0xe0b872,
    sapphire: 0x3e7691,
    stamp: 0xc24a3a
  };

  let renderer, scene, camera, outerGroup, islandGroup;
  let baseCamDist = 500, sphereCenter = new THREE.Vector3(0, 0, 0);
  const elevation = THREE.MathUtils.degToRad(50);
  let camDistFactor = 1;
  let rafId = null;
  let sectionVisible = false;

  const pins = []; // { id, gateway, group, ring, hitMesh, material }
  let activeId = null;
  let hoveredId = null;

  // -- interaction state --------------------------------------------------
  const activePointers = new Map();
  let isDragging = false;
  let dragStart = { x: 0, y: 0, t: 0 };
  let lastPointer = { x: 0, y: 0 };
  let velocity = 0;
  let pinchStartDist = null;
  let pinchStartFactor = 1;
  let lastInteractionTime = 0;
  const AUTO_ROTATE_SPEED = 0.05;
  const AUTO_RESUME_DELAY = 3200;
  const ROTATE_SENSITIVITY = 0.0065;

  try {
    init();
  } catch (err) {
    console.warn("Serendib map: falling back, WebGL unavailable.", err);
    wrap.classList.add("map-wrap--fallback");
    return { focusOn: function () {} };
  }

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 1, 4000);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    scene.add(new THREE.HemisphereLight(0x9fb6ac, 0x1c130a, 0.65));
    const key = new THREE.DirectionalLight(0xffe3b0, 1.15);
    key.position.set(180, 300, 220);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x4a7f95, 0.4);
    fill.position.set(-220, 160, -160);
    scene.add(fill);

    outerGroup = new THREE.Group();
    islandGroup = new THREE.Group();
    islandGroup.rotation.x = -Math.PI / 2;
    outerGroup.add(islandGroup);
    scene.add(outerGroup);

    buildIsland();
    buildPins();
    fitCamera();
    bindEvents();
    observeVisibility();
    resize();
    renderFrame(); // paint one frame immediately, even if paused
  }

  // -- geometry -------------------------------------------------------------
  function buildIsland() {
    const pts = SD.COASTLINE_LATLON.map(function (ll) {
      const p = SD.geo(ll[0], ll[1]);
      return new THREE.Vector2(p.x, p.y);
    });
    const shape = new THREE.Shape();
    shape.moveTo(pts[0].x, pts[0].y);
    shape.splineThru(pts.slice(1));
    shape.closePath();

    const depth = 16;
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth, bevelEnabled: true, bevelThickness: 2.2, bevelSize: 1.6,
      bevelSegments: 3, curveSegments: 20
    });
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    geometry.translate(-cx, -cy, -depth / 2);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: PALETTE.brass, metalness: 0.4, roughness: 0.44,
      emissive: 0x2a1d0d, emissiveIntensity: 0.18
    });
    const mesh = new THREE.Mesh(geometry, material);
    islandGroup.add(mesh);

    islandGroup.userData.center = { x: cx, y: cy };
    islandGroup.userData.depth = depth;

    // thin base disc, slightly larger and darker, for a "mounted on a plinth" read
    const discGeo = new THREE.CylinderGeometry(
      Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y) * 0.62, 
      Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y) * 0.66, 
      6, 48
    );
    const discMat = new THREE.MeshStandardMaterial({ color: 0x0c1c18, metalness: 0.2, roughness: 0.8 });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.set(0, -depth / 2 - 3, 0);
    islandGroup.add(disc);
  }

  function buildPins() {
    const center = islandGroup.userData.center;
    const depth = islandGroup.userData.depth;

    function place(lat, lon) {
      const p = SD.geo(lat, lon);
      return { x: p.x - center.x, y: p.y - center.y, z: depth / 2 };
    }

    SD.DESTINATIONS.forEach(function (d) {
      addPin(place(d.lat, d.lon), { id: d.id, gateway: false, name: d.name });
    });
    addPin(place(SD.GATEWAY.lat, SD.GATEWAY.lon), { id: "gateway", gateway: true, name: SD.GATEWAY.name });
  }

  function addPin(pos, info) {
    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, pos.z);
    islandGroup.add(group);

    const isGateway = info.gateway;
    const color = isGateway ? PALETTE.sapphire : PALETTE.brassLight;

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.3, 12, 10),
      new THREE.MeshStandardMaterial({ color: color, metalness: 0.3, roughness: 0.4 })
    );
    stem.position.z = 6;
    stem.rotation.x = Math.PI / 2;
    group.add(stem);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(isGateway ? 3.2 : 3.8, 16, 16),
      new THREE.MeshStandardMaterial({ color: color, metalness: 0.25, roughness: 0.35, emissive: color, emissiveIntensity: 0.25 })
    );
    head.position.z = 13;
    group.add(head);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(8.5, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.z = 13;
    hit.userData = { id: info.id, gateway: isGateway, name: info.name };
    group.add(hit);

    let ring = null;
    if (!isGateway) {
      ring = new THREE.Mesh(
        new THREE.RingGeometry(5, 6.4, 24),
        new THREE.MeshBasicMaterial({ color: PALETTE.stamp, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
      );
      ring.position.z = 0.3;
      ring.visible = false;
      group.add(ring);
    }

    pins.push({ id: info.id, gateway: isGateway, group: group, head: head, ring: ring, hit: hit });
  }

  function refreshSelectedVisuals() {
    pins.forEach(function (p) {
      if (p.gateway) return;
      const on = SD.TripState.isSelected(p.id);
      p.head.material.color.set(on ? PALETTE.stamp : PALETTE.brassLight);
      p.head.material.emissive.set(on ? PALETTE.stamp : PALETTE.brassLight);
      if (p.ring) p.ring.visible = on;
    });
  }
  if (SD.TripState) SD.TripState.subscribe(refreshSelectedVisuals);

  // -- camera framing ---------------------------------------------------
  function fitCamera() {
    const box = new THREE.Box3().setFromObject(islandGroup);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    sphereCenter.set(0, sphere.center.y * 0.3, 0);
    const fitRadius = sphere.radius * 1.5;
    baseCamDist = fitRadius / Math.sin(THREE.MathUtils.degToRad(21));
    updateCameraPosition();
  }
  function updateCameraPosition() {
    const d = baseCamDist * camDistFactor;
    camera.position.set(0, d * Math.sin(elevation), d * Math.cos(elevation));
    camera.lookAt(sphereCenter);
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // -- render loop --------------------------------------------------------
  let lastTime = performance.now();
  function renderFrame() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (!isDragging) {
      if (Math.abs(velocity) > 0.00005) {
        outerGroup.rotation.y += velocity;
        velocity *= 0.925;
      } else if (now - lastInteractionTime > AUTO_RESUME_DELAY) {
        outerGroup.rotation.y += AUTO_ROTATE_SPEED * dt;
      }
    }

    pins.forEach(function (p) {
      if (p.ring && p.ring.visible) {
        const s = 1 + Math.sin(now / 260) * 0.14;
        p.ring.scale.set(s, s, 1);
      }
    });

    positionTooltip();
    renderer.render(scene, camera);

    if (sectionVisible) rafId = requestAnimationFrame(renderFrame);
    else rafId = null;
  }
  function ensureLoop() { if (!rafId && sectionVisible) { lastTime = performance.now(); rafId = requestAnimationFrame(renderFrame); } }

  function observeVisibility() {
    if (!("IntersectionObserver" in window)) { sectionVisible = true; ensureLoop(); return; }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        sectionVisible = e.isIntersecting;
        if (sectionVisible) ensureLoop();
      });
    }, { threshold: 0.05 });
    io.observe(wrap);
  }

  // -- resize ---------------------------------------------------------------
  function resize() {
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(rect.width, 1), h = Math.max(rect.height, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderFrame();
  }
  let resizeT;
  window.addEventListener("resize", function () { clearTimeout(resizeT); resizeT = setTimeout(resize, 120); });
  if ("ResizeObserver" in window) new ResizeObserver(function () { resize(); }).observe(wrap);

  // -- pointer / touch interaction -----------------------------------------
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function raycastAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pins.map(function (p) { return p.hit; }));
    return hits.length ? hits[0].object.userData : null;
  }

  function setActive(id) {
    activeId = id;
    renderTooltipContent();
  }

  function renderTooltipContent() {
    if (!activeId) { tooltip.hidden = true; return; }
    if (activeId === "gateway") {
      tooltip.innerHTML = '<strong>' + SD.GATEWAY.name + '</strong><span>' + SD.GATEWAY.note + '</span>';
      tooltip.hidden = false;
      return;
    }
    const d = SD.DESTINATIONS.find(function (x) { return x.id === activeId; });
    if (!d) { tooltip.hidden = true; return; }
    const on = SD.TripState.isSelected(d.id);
    tooltip.innerHTML =
      '<strong>' + d.name + '</strong><span>' + d.tagline + '</span>' +
      '<button type="button" class="map-tooltip__btn' + (on ? ' is-on' : '') + '" data-toggle-id="' + d.id + '">' +
      (on ? "Added \u2713" : "Add to trip") + "</button>";
    tooltip.hidden = false;
    const btn = tooltip.querySelector("[data-toggle-id]");
    if (btn) btn.addEventListener("click", function () {
      SD.TripState.toggle(d.id);
      renderTooltipContent();
    });
  }

  function positionTooltip() {
    if (!activeId || tooltip.hidden) return;
    const pin = pins.find(function (p) { return p.id === activeId; });
    if (!pin) return;
    const v = new THREE.Vector3();
    pin.head.getWorldPosition(v);
    v.project(camera);
    if (v.z > 1) { tooltip.hidden = true; return; }
    const rect = wrap.getBoundingClientRect();
    const x = (v.x * 0.5 + 0.5) * rect.width;
    const y = (-v.y * 0.5 + 0.5) * rect.height;
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  function bindEvents() {
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";

    canvas.addEventListener("pointerdown", function (e) {
      canvas.setPointerCapture(e.pointerId);
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      lastInteractionTime = performance.now();
      if (hint) hint.classList.add("is-hidden");
      if (activePointers.size === 1) {
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY, t: performance.now() };
        lastPointer = { x: e.clientX, y: e.clientY };
        velocity = 0;
        canvas.style.cursor = "grabbing";
      } else if (activePointers.size === 2) {
        isDragging = false;
        const p = Array.from(activePointers.values());
        pinchStartDist = dist(p[0], p[1]);
        pinchStartFactor = camDistFactor;
      }
      ensureLoop();
    });

    canvas.addEventListener("pointermove", function (e) {
      lastInteractionTime = performance.now();
      if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 2 && pinchStartDist) {
        const p = Array.from(activePointers.values());
        const d = dist(p[0], p[1]);
        camDistFactor = clamp(pinchStartFactor * (pinchStartDist / d), 0.55, 2.1);
        updateCameraPosition();
        return;
      }
      if (isDragging && activePointers.size === 1) {
        const dx = e.clientX - lastPointer.x;
        outerGroup.rotation.y += dx * ROTATE_SENSITIVITY;
        velocity = velocity * 0.25 + dx * ROTATE_SENSITIVITY * 0.75;
        lastPointer = { x: e.clientX, y: e.clientY };
        ensureLoop();
        return;
      }
      if (e.pointerType === "mouse" && !isDragging) {
        const hit = raycastAt(e.clientX, e.clientY);
        const id = hit ? hit.id : null;
        if (id !== hoveredId) {
          hoveredId = id;
          canvas.style.cursor = id ? "pointer" : "grab";
          setActive(id);
          ensureLoop();
        }
      }
    });

    function endPointer(e) {
      const wasSingle = activePointers.size === 1;
      const wasDragging = isDragging;
      const start = dragStart;
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) pinchStartDist = null;
      if (activePointers.size === 0) {
        canvas.style.cursor = hoveredId ? "pointer" : "grab";
        if (wasDragging && wasSingle) {
          const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
          const elapsed = performance.now() - start.t;
          if (moved < 6 && elapsed < 500) {
            const hit = raycastAt(e.clientX, e.clientY);
            if (hit) { setActive(hit.id); if (!hit.gateway) SD.TripState.toggle(hit.id); }
            else setActive(null);
          }
        }
        isDragging = false;
      }
      lastInteractionTime = performance.now();
    }
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "mouse" && !isDragging) { hoveredId = null; setActive(null); }
    });

    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      camDistFactor = clamp(camDistFactor + e.deltaY * 0.0012, 0.55, 2.1);
      updateCameraPosition();
      lastInteractionTime = performance.now();
      ensureLoop();
    }, { passive: false });
  }

  // -- public API -----------------------------------------------------------
  function focusOn(id) {
    const pin = pins.find(function (p) { return p.id === id; });
    if (!pin) return;
    const localX = pin.group.position.x;
    const localY = pin.group.position.y;
    const worldX = localX;
    const worldZ = -localY;
    let target = Math.atan2(-worldX, worldZ);
    const current = outerGroup.rotation.y;
    const twoPi = Math.PI * 2;
    let delta = (target - current) % twoPi;
    if (delta > Math.PI) delta -= twoPi;
    if (delta < -Math.PI) delta += twoPi;
    target = current + delta;

    velocity = 0;
    sectionVisible = true;
    ensureLoop();
    if (window.gsap) {
      gsap.to(outerGroup.rotation, { y: target, duration: 1.1, ease: "power3.inOut" });
    } else {
      outerGroup.rotation.y = target;
    }
    setActive(id);
    lastInteractionTime = performance.now();
    if (hint) hint.classList.add("is-hidden");
  }

  return { focusOn: focusOn };
})();
