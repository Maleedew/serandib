/* ==========================================================================
   SERENDIB TRAILS — DATA
   Single source of truth for the island geometry and all site content.
   Every coordinate is a real approximate lat/lon; geo() projects it into
   the same flat plane used to build the 3D relief map, so coastline points
   and destination pins always agree with each other.
   ========================================================================== */

(function () {
  "use strict";

  // Bounding box around Sri Lanka, with a small margin on every side.
  const BOUNDS = { latMax: 9.9, latMin: 5.85, lonMin: 79.55, lonMax: 82.0 };
  const PLANE_W = 440;
  const PLANE_H = 740;

  /** Projects a lat/lon pair to flat x/y coordinates (y grows southward). */
  function geo(lat, lon) {
    const x = ((lon - BOUNDS.lonMin) / (BOUNDS.lonMax - BOUNDS.lonMin)) * PLANE_W;
    const y = ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * PLANE_H;
    return { x, y };
  }

  // Coastline, traced clockwise from Point Pedro. Approximate — this is a
  // stylised relief map for a booking site, not a survey chart.
  const COASTLINE_LATLON = [
    [9.83, 80.23], [9.60, 80.35], [9.42, 80.18], [9.27, 80.82],
    [8.95, 81.02], [8.59, 81.24], [7.95, 81.55], [7.72, 81.70],
    [7.42, 81.82], [6.85, 81.87], [6.55, 81.75], [6.22, 81.35],
    [5.92, 80.59], [5.95, 80.46], [6.03, 80.22], [6.24, 80.05],
    [6.42, 79.99], [6.58, 79.96], [6.93, 79.85], [7.21, 79.84],
    [7.58, 79.80], [8.23, 79.72], [8.55, 79.82], [8.98, 79.75],
    [9.10, 80.05], [9.35, 80.05], [9.60, 79.95], [9.83, 80.23]
  ];

  const GATEWAY = { name: "Colombo", note: "Where every trip begins", lat: 6.927, lon: 79.861 };

  const DESTINATIONS = [
    { id: "sigiriya", name: "Sigiriya", region: "Cultural Triangle", icon: "rock",
      lat: 7.957, lon: 80.760, tagline: "A palace on top of a rock",
      blurb: "In the 5th century a king built his fortress on top of this 200-metre granite outcrop. The frescoes and the climb are why people still come.",
      highlights: ["Lion's Paw entrance", "Mirror wall frescoes", "Water gardens"], days: 1, price: 45 },

    { id: "kandy", name: "Kandy", region: "Hill Country", icon: "temple",
      lat: 7.291, lon: 80.636, tagline: "The last of the old kingdoms",
      blurb: "Sri Lanka's final royal capital, home to the Temple of the Sacred Tooth Relic and an evening drumming procession worth timing your visit around.",
      highlights: ["Temple of the Tooth", "Kandy Lake walk", "Evening dance show"], days: 2, price: 50 },

    { id: "ella", name: "Ella", region: "Hill Country", icon: "bridge",
      lat: 6.876, lon: 81.046, tagline: "Hill country at its most photogenic",
      blurb: "Tea rows, a train line that hangs off the hillside, and the Nine Arches Bridge. Cooler air, slower pace.",
      highlights: ["Nine Arches Bridge", "Little Adam's Peak", "Ravana Falls"], days: 2, price: 48 },

    { id: "galle", name: "Galle", region: "Coast", icon: "fort",
      lat: 6.032, lon: 80.217, tagline: "A Dutch fort that never left",
      blurb: "Ramparts, a working lighthouse, and streets that haven't changed much since the 17th century. Best walked at sunset.",
      highlights: ["Fort ramparts", "Dutch Reformed Church", "Boutique lanes"], days: 1, price: 35 },

    { id: "mirissa", name: "Mirissa", region: "Coast", icon: "whale",
      lat: 5.948, lon: 80.459, tagline: "Whales before breakfast",
      blurb: "Boats leave at dawn for blue whale season; the rest of the day is beach, surf breaks and grilled seafood.",
      highlights: ["Blue whale watching", "Coconut Tree Hill", "Parrot Rock"], days: 2, price: 55 },

    { id: "yala", name: "Yala National Park", region: "Wildlife", icon: "paw",
      lat: 6.372, lon: 81.519, tagline: "The highest density of leopards anywhere",
      blurb: "A dry-zone park where jeep safaris regularly turn up leopards, elephants and crocodiles before noon.",
      highlights: ["Leopard tracking", "Block 1 safari", "Birdlife"], days: 1, price: 70 },

    { id: "nuwara-eliya", name: "Nuwara Eliya", region: "Hill Country", icon: "leaf",
      lat: 6.971, lon: 80.769, tagline: "Tea country, colonial hangover",
      blurb: "Cool air, Tudor-style bungalows, and tea estates you can walk straight into. Feels like a different country.",
      highlights: ["Tea factory tour", "Gregory Lake", "Horton Plains day trip"], days: 2, price: 45 },

    { id: "trincomalee", name: "Trincomalee", region: "Coast", icon: "anchor",
      lat: 8.586, lon: 81.214, tagline: "The best natural harbour on the island",
      blurb: "Clear water, a clifftop Hindu temple, and beaches that stay quiet even in high season.",
      highlights: ["Koneswaram Temple", "Pigeon Island snorkelling", "Nilaveli Beach"], days: 2, price: 60 },

    { id: "anuradhapura", name: "Anuradhapura", region: "Cultural Triangle", icon: "stupa",
      lat: 8.311, lon: 80.403, tagline: "Sri Lanka's first capital, 2,300 years old",
      blurb: "Ancient dagobas rising out of the jungle, and a fig tree grown from a cutting of the original Bodhi Tree.",
      highlights: ["Sri Maha Bodhi", "Ruwanwelisaya", "Jetavanaramaya"], days: 1, price: 40 },

    { id: "polonnaruwa", name: "Polonnaruwa", region: "Cultural Triangle", icon: "statue",
      lat: 7.939, lon: 81.000, tagline: "The medieval capital, in stone",
      blurb: "Compact enough to cycle around in an afternoon, with some of the best-preserved carvings on the island.",
      highlights: ["Gal Vihara", "Royal palace ruins", "Parakrama Samudra"], days: 1, price: 40 },

    { id: "bentota", name: "Bentota", region: "Coast", icon: "river",
      lat: 6.426, lon: 79.995, tagline: "River on one side, ocean on the other",
      blurb: "A narrow stretch where you can go from mangrove boat rides to bodysurfing in the same afternoon.",
      highlights: ["Madu River safari", "Water sports", "Turtle hatchery"], days: 1, price: 50 },

    { id: "arugam-bay", name: "Arugam Bay", region: "Coast", icon: "surf",
      lat: 6.840, lon: 81.836, tagline: "The east coast, for surfers",
      blurb: "A long right-hand point break and a town that shuts down for nothing except low tide.",
      highlights: ["Main Point break", "Pottuvil Lagoon", "Kumana National Park"], days: 2, price: 55 },

    { id: "dambulla", name: "Dambulla", region: "Cultural Triangle", icon: "cave",
      lat: 7.856, lon: 80.651, tagline: "Five caves, a thousand years of painting",
      blurb: "Buddha statues and ceiling murals carved and painted straight into the rock, still in use as a temple.",
      highlights: ["Cave temple complex", "Golden Buddha statue", "Hilltop views"], days: 1, price: 35 },

    { id: "adams-peak", name: "Adam's Peak", region: "Hill Country", icon: "peak",
      lat: 6.809, lon: 80.499, tagline: "A mountain everyone climbs in the dark",
      blurb: "Pilgrims of every religion climb through the night for sunrise at the summit shrine.",
      highlights: ["Sunrise summit", "Sacred footprint shrine", "Pilgrim-season lights"], days: 1, price: 30 },

    { id: "jaffna", name: "Jaffna", region: "North", icon: "palm",
      lat: 9.661, lon: 80.025, tagline: "The north, on its own terms",
      blurb: "Palmyrah palms, causeway islands, and a food scene that tastes nothing like the rest of the country.",
      highlights: ["Nallur Kandaswamy Temple", "Jaffna Fort", "Nagadeepa island"], days: 2, price: 65 }
  ];

  const REGIONS = ["All", "Cultural Triangle", "Hill Country", "Coast", "Wildlife", "North"];

  const PACKAGES = [
    { id: "backpacker", name: "The Backpacker's Route", forWhom: "Self-paced travel on a real budget",
      price: 28, unit: "per person / day", popular: false,
      includes: ["Guesthouse & hostel stays", "Public & shared transport routing", "A WhatsApp line for when plans change", "Entry-fee cheat sheet for every stop"] },
    { id: "guided", name: "The Guided Discovery", forWhom: "Most travellers end up here",
      price: 85, unit: "per person / day", popular: true,
      includes: ["Private A/C vehicle with driver-guide", "3-star & boutique stays", "Daily breakfast", "Entrance fees planned into the route"] },
    { id: "signature", name: "The Private Signature", forWhom: "For a trip with nothing left to plan",
      price: 220, unit: "per person / day", popular: false,
      includes: ["Private chauffeur, whole trip", "5-star & villa stays", "A personal concierge on call", "Priority reservations at every stop"] }
  ];

  const FEATURES = [
    { icon: "rock", title: "A driver who's also your guide",
      text: "Not a rotating cast of strangers — the same person for the whole trip, who knows the roads and the shortcuts." },
    { icon: "stupa", title: "Real place-names, not brochure ones",
      text: "Every stop on your map is somewhere we've actually sent people, not a stock photo picked for the homepage." },
    { icon: "bridge", title: "A plan you can still change",
      text: "Add a day, drop a stop, swap a hotel. Nothing is locked in until you say it is." },
    { icon: "leaf", title: "No resort-only itineraries",
      text: "We build in the small guesthouses and family-run kitchens too, not just the chains that pay for placement." },
    { icon: "anchor", title: "One phone number, the whole trip",
      text: "If something changes — weather, a closed road, a delayed flight — you call one person, not a call centre." },
    { icon: "whale", title: "Fair-share tourism",
      text: "A fixed cut of every booking goes directly to the guides, drivers and homestays you'll actually meet." }
  ];

  const TESTIMONIALS = [
    { day: "Day 4", place: "Ella", name: "Priya & Tom",
      quote: "We told them we wanted trains, not beaches, and that's exactly what we got. Nine Arches at sunrise, no crowds." },
    { day: "Day 9", place: "Yala", name: "Marcus",
      quote: "Our guide spotted the leopard before the jeep had even stopped moving. Still not sure how." },
    { day: "Day 2", place: "Galle", name: "Amara",
      quote: "Booked four days before we flew. They still had it sorted by the time we landed." },
    { day: "Day 12", place: "Jaffna", name: "The Hendersons",
      quote: "Nobody else we spoke to even mentioned the north. Glad we asked before we booked." },
    { day: "Day 6", place: "Nuwara Eliya", name: "Sana",
      quote: "Cold enough for the jumper I almost didn't pack. Nobody warns you about that part." }
  ];

  // ------------------------------------------------------------------------
  // Shared trip-selection state. The 3D map, the destination grid and the
  // booking panel all read/write this so a tap in any one of them is
  // reflected everywhere else instantly. It lives ON the SD object (not as
  // its own global) because every other module calls it as SD.TripState.
  // ------------------------------------------------------------------------
  const TripState = (function () {
    let selected = [];
    let listeners = [];
    function toggle(id) {
      const i = selected.indexOf(id);
      if (i === -1) selected.push(id); else selected.splice(i, 1);
      emit();
    }
    function isSelected(id) { return selected.indexOf(id) !== -1; }
    function getAll() { return selected.slice(); }
    function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (l) { return l !== fn; }); }; }
    function emit() { listeners.forEach(function (fn) { fn(selected.slice()); }); }
    return { toggle: toggle, isSelected: isSelected, getAll: getAll, subscribe: subscribe };
  })();

  window.SD = { geo, BOUNDS, PLANE_W, PLANE_H, COASTLINE_LATLON, GATEWAY, DESTINATIONS, REGIONS, PACKAGES, FEATURES, TESTIMONIALS, TripState };
})();
