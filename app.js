(function () {
  "use strict";

  // ---------- Language / currency state ----------
  let langCode = 'en';
  let currentCurrency = 'USD';

  function dict() {
    return I18N[langCode] || I18N.en;
  }

  // ---------- Currency symbol map ----------
  const CURRENCY_SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', TRY: '₺',
    AED: 'د.إ', JPY: '¥', KZT: '₸',
  };

  function currencySymbol() {
    return CURRENCY_SYMBOLS[currentCurrency] || currentCurrency;
  }

  // ---------- Search state (trip type / class / passengers) ----------
  const searchState = {
    tripType: 'round',   // 'round' | 'oneway'
    cabinClass: 0,       // 0 = Economy, 1 = Business (Travelpayouts trip_class)
    adults: 1,
    children: 0,
    infants: 0,
  };

  // ---------- Hero cursor spotlight + trail ----------
  const heroEl = document.querySelector('.hero');
  const heroSpotlight = document.querySelector('.hero-spotlight');
  const heroTrailLayer = document.querySelector('.hero-trail-layer');
  if (heroEl && heroSpotlight && heroTrailLayer) {
    let lastTrailAt = 0;
    heroEl.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const rect = heroEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      heroSpotlight.style.setProperty('--sx', x + 'px');
      heroSpotlight.style.setProperty('--sy', y + 'px');
      heroEl.classList.add('glow-active');

      const now = Date.now();
      if (now - lastTrailAt > 45) {
        lastTrailAt = now;
        const dot = document.createElement('span');
        dot.className = 'trail-dot';
        const size = 5 + Math.random() * 7;
        dot.style.width = size + 'px';
        dot.style.height = size + 'px';
        dot.style.left = x + 'px';
        dot.style.top = y + 'px';
        heroTrailLayer.appendChild(dot);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { dot.classList.add('fade'); });
        });
        setTimeout(() => { dot.remove(); }, 700);

        while (heroTrailLayer.children.length > 24) {
          heroTrailLayer.removeChild(heroTrailLayer.firstChild);
        }
      }
    });
    heroEl.addEventListener('pointerleave', () => {
      heroEl.classList.remove('glow-active');
    });
  }

  // ---------- Mobile nav ----------
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      const open = mainNav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ---------- Currency / language dropdown ----------
  const langTrigger = document.getElementById('langTrigger');
  const langDropdown = document.getElementById('langDropdown');
  const langLabelEl = document.getElementById('langLabel');

  langTrigger.addEventListener('click', () => {
    const open = langDropdown.classList.toggle('open');
    langTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', (e) => {
    if (!langDropdown.contains(e.target) && e.target !== langTrigger && !langTrigger.contains(e.target)) {
      langDropdown.classList.remove('open');
      langTrigger.setAttribute('aria-expanded', 'false');
    }
  });

  langDropdown.querySelectorAll('.lang-opt[data-currency]').forEach((btn) => {
    btn.addEventListener('click', () => {
      langDropdown.querySelectorAll('.lang-opt[data-currency]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentCurrency = btn.dataset.currency;
      langLabelEl.textContent = currentCurrency + ' · ' + langCode.toUpperCase();
      // Re-render destination cards so prices show the correct currency symbol
      renderDestinations(true);
      // Close dropdown after currency selection (matches UX of language selection)
      langDropdown.classList.remove('open');
      langTrigger.setAttribute('aria-expanded', 'false');
    });
  });

  function applyLanguage(code) {
    langCode = code;
    const d = dict();
    document.documentElement.lang = langCode;
    document.documentElement.dir = (langCode === 'ar') ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (d[key] != null) el.textContent = d[key];
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (d[key] != null) el.innerHTML = d[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (d[key] != null) el.placeholder = d[key];
    });

    langLabelEl.textContent = currentCurrency + ' · ' + langCode.toUpperCase();
    refreshPaxTrigger();
    renderDestinations(true);
  }

  langDropdown.querySelectorAll('.lang-opt[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      langDropdown.querySelectorAll('.lang-opt[data-lang]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      applyLanguage(btn.dataset.lang.toLowerCase());
      langDropdown.classList.remove('open');
      langTrigger.setAttribute('aria-expanded', 'false');
    });
  });

  // ---------- Trip type toggle ----------
  const tripOptions = document.querySelectorAll('.trip-option');
  const returnField = document.getElementById('returnField');
  tripOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      tripOptions.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      searchState.tripType = btn.dataset.trip === 'one' ? 'oneway' : 'round';
      returnField.classList.toggle('collapsed', searchState.tripType === 'oneway');
    });
  });

  // ---------- Swap from/to ----------
  const fromInput = document.getElementById('fromInput');
  const toInput = document.getElementById('toInput');
  const swapBtn = document.getElementById('swapBtn');
  swapBtn.addEventListener('click', () => {
    const tmpVal = fromInput.value;
    fromInput.value = toInput.value;
    toInput.value = tmpVal;

    const tmpCode = fromInput.dataset.code || '';
    fromInput.dataset.code = toInput.dataset.code || '';
    toInput.dataset.code = tmpCode;

    swapBtn.classList.add('spin');
    setTimeout(() => { swapBtn.classList.remove('spin'); }, 250);
  });

  // ---------- Airport autocomplete (shared AIRPORTS dataset) ----------
  function pinIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  }

  function searchAirports(query) {
    const q = query.trim().toLowerCase();
    if (!q) return AIRPORTS.filter((a) => a.popular).slice(0, 6);
    return AIRPORTS.filter((a) =>
      a.city.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q) ||
      a.code.toLowerCase().includes(q)
    ).slice(0, 8);
  }

  function setupAutocomplete(input, listEl) {
    function renderMatches(list) {
      listEl.innerHTML = '';
      if (!list.length) {
        listEl.classList.remove('open');
        return;
      }
      list.forEach((a) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = pinIcon() +
          '<span class="flag">' + a.flag + '</span>' +
          '<span class="city">' + a.city + ', ' + a.country + '</span>' +
          '<span class="code">' + a.code + '</span>';
        item.addEventListener('click', () => {
          input.value = a.city;
          input.dataset.code = a.code;
          listEl.classList.remove('open');
        });
        listEl.appendChild(item);
      });
      listEl.classList.add('open');
    }

    input.addEventListener('focus', () => {
      renderMatches(searchAirports(input.value));
    });
    input.addEventListener('input', () => {
      input.dataset.code = '';
      renderMatches(searchAirports(input.value));
    });
    document.addEventListener('click', (e) => {
      if (!listEl.contains(e.target) && e.target !== input) {
        listEl.classList.remove('open');
      }
    });
  }
  setupAutocomplete(fromInput, document.getElementById('fromList'));
  setupAutocomplete(toInput, document.getElementById('toList'));

  // Default "from" city, matching the pre-redesign experience
  const defaultFrom = AIRPORTS.find((a) => a.code === 'IST');
  if (defaultFrom && !fromInput.value) {
    fromInput.value = defaultFrom.city;
    fromInput.dataset.code = defaultFrom.code;
  }

  // ---------- Passengers & class dropdown ----------
  const passengerTrigger = document.getElementById('passengerTrigger');
  const passengerDropdown = document.getElementById('passengerDropdown');

  passengerTrigger.addEventListener('click', () => {
    const open = passengerDropdown.classList.toggle('open');
    passengerTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', (e) => {
    if (!passengerDropdown.contains(e.target) && e.target !== passengerTrigger) {
      passengerDropdown.classList.remove('open');
      passengerTrigger.setAttribute('aria-expanded', 'false');
    }
  });

  const MAX_SEATED = 9; // Travelpayouts: adults + children <= 9
  const MAX_ADULTS = MAX_SEATED;
  const MAX_CHILDREN = MAX_SEATED - 1;
  const MAX_INFANTS = MAX_SEATED;

  function currentClassKey() {
    const active = document.querySelector('.class-opt.active');
    return active ? active.dataset.class.toLowerCase() : 'economy';
  }

  function refreshPaxTrigger() {
    const d = dict();
    const total = searchState.adults + searchState.children + searchState.infants;
    let label;
    if (searchState.children === 0 && searchState.infants === 0) {
      label = searchState.adults + ' ' + (searchState.adults === 1 ? d.unit_adult : d.unit_adults);
    } else {
      label = total + ' ' + (total === 1 ? d.unit_passenger : d.unit_passengers);
    }
    const classLabel = d['class_' + currentClassKey()] || currentClassKey();
    passengerTrigger.textContent = label + ', ' + classLabel;
  }

  function syncPaxUI() {
    document.getElementById('adultsCount').textContent = searchState.adults;
    document.getElementById('childrenCount').textContent = searchState.children;
    document.getElementById('infantsCount').textContent = searchState.infants;

    document.querySelector('.stepper button[data-target="adults"][data-op="dec"]').disabled = searchState.adults <= 1;
    document.querySelector('.stepper button[data-target="adults"][data-op="inc"]').disabled =
      searchState.adults >= MAX_ADULTS || (searchState.adults + searchState.children) >= MAX_SEATED;

    document.querySelector('.stepper button[data-target="children"][data-op="dec"]').disabled = searchState.children <= 0;
    document.querySelector('.stepper button[data-target="children"][data-op="inc"]').disabled =
      searchState.children >= MAX_CHILDREN || (searchState.adults + searchState.children) >= MAX_SEATED;

    document.querySelector('.stepper button[data-target="infants"][data-op="dec"]').disabled = searchState.infants <= 0;
    // infants cannot exceed adults (Travelpayouts rule: infants travel on an adult's lap)
    document.querySelector('.stepper button[data-target="infants"][data-op="inc"]').disabled =
      searchState.infants >= searchState.adults || searchState.infants >= MAX_INFANTS;

    refreshPaxTrigger();
  }

  document.querySelectorAll('.stepper button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.target;
      const op = btn.dataset.op;
      if (op === 'inc') {
        if (key === 'adults') {
          if (searchState.adults < MAX_ADULTS && (searchState.adults + searchState.children) < MAX_SEATED) searchState.adults++;
        } else if (key === 'children') {
          if (searchState.children < MAX_CHILDREN && (searchState.adults + searchState.children) < MAX_SEATED) searchState.children++;
        } else if (key === 'infants') {
          if (searchState.infants < searchState.adults && searchState.infants < MAX_INFANTS) searchState.infants++;
        }
      } else {
        if (key === 'adults' && searchState.adults > 1) {
          searchState.adults--;
          if (searchState.infants > searchState.adults) searchState.infants = searchState.adults;
        } else if (key === 'children' && searchState.children > 0) {
          searchState.children--;
        } else if (key === 'infants' && searchState.infants > 0) {
          searchState.infants--;
        }
      }
      syncPaxUI();
    });
  });

  document.querySelectorAll('.class-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.class-opt').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      // Travelpayouts trip_class only distinguishes Economy(0) / Business(1);
      // Premium fares search as Economy, First fares search as Business.
      const cls = btn.dataset.class;
      searchState.cabinClass = (cls === 'Business' || cls === 'First') ? 1 : 0;
      refreshPaxTrigger();
    });
  });

  const passengerDoneBtn = document.getElementById('passengerDone');
  passengerDoneBtn.addEventListener('click', () => {
    passengerDropdown.classList.remove('open');
    passengerTrigger.setAttribute('aria-expanded', 'false');
  });

  syncPaxUI();

  // ---------- Dates ----------
  const departDateEl = document.getElementById('departDate');
  const returnDateEl = document.getElementById('returnDate');
  const todayStr = new Date().toISOString().slice(0, 10);
  departDateEl.min = todayStr;
  returnDateEl.min = todayStr;
  departDateEl.addEventListener('change', () => {
    if (departDateEl.value) {
      returnDateEl.min = departDateEl.value;
      if (returnDateEl.value && returnDateEl.value < departDateEl.value) {
        returnDateEl.value = departDateEl.value;
      }
    }
  });

  // ---------- Popular destinations grid ----------
  const DESTINATIONS = [
    { code: 'CDG', price: 210 },
    { code: 'DXB', price: 340 },
    { code: 'NRT', price: 520 },
    { code: 'BCN', price: 180 },
    { code: 'BKK', price: 410 },
    { code: 'FCO', price: 195 },
  ];
  const destinationGrid = document.getElementById('destinationGrid');
  function renderDestinations(instant) {
    const d = dict();
    destinationGrid.innerHTML = '';
    DESTINATIONS.forEach((dest) => {
      const a = AIRPORTS.find((x) => x.code === dest.code);
      const city = a ? a.city : dest.code;
      const card = document.createElement('article');
      card.className = 'destination-card' + (instant ? ' in' : '');
      card.innerHTML =
        '<div class="card-visual"><span class="code">' + dest.code + '</span>' +
        '<div class="route-dots"><span class="d"></span><span class="line"></span><span class="d"></span></div></div>' +
        '<div class="card-body"><h3>' + city + '</h3><p class="price">' + d.price_from + ' <strong>' + currencySymbol() + dest.price + '</strong></p></div>';
      card.addEventListener('click', () => {
        toInput.value = city;
        toInput.dataset.code = dest.code;
      });
      destinationGrid.appendChild(card);
    });
  }
  renderDestinations();

  // ---------- Scroll reveal ----------
  const revealTargets = document.querySelectorAll('.destination-card, .feature');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add('in'));
  }

  // ---------- Toast ----------
  const toastEl = document.getElementById('toast');
  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.classList.remove('show'); }, 3200);
  }

  // ---------- Search submit: build Travelpayouts deeplink & redirect ----------
  function buildSearchUrl() {
    const fromCode = (fromInput.dataset.code || '').toUpperCase();
    const toCode = (toInput.dataset.code || '').toUpperCase();
    if (!fromCode || !toCode) return null;

    const departDate = departDateEl.value;
    if (!departDate) return null;
    const returnDate = searchState.tripType === 'round' ? returnDateEl.value : '';
    if (searchState.tripType === 'round' && !returnDate) return null;

    const cfg = window.FLY_TM_CONFIG || { searchHost: 'https://flights.flytm.xyz', searchPath: '/flights/' };
    const base = cfg.searchHost.replace(/\/$/, '') + cfg.searchPath;

    const params = new URLSearchParams();
    params.set('origin_iata', fromCode);
    params.set('destination_iata', toCode);
    params.set('depart_date', departDate);
    if (returnDate) params.set('return_date', returnDate);
    params.set('one_way', searchState.tripType === 'oneway' ? 'true' : 'false');
    params.set('adults', String(searchState.adults));
    params.set('children', String(searchState.children));
    params.set('infants', String(searchState.infants));
    params.set('trip_class', String(searchState.cabinClass));
    params.set('currency', currentCurrency.toLowerCase());
    params.set('locale', langCode);
    // auto-trigger the search the instant the destination page loads
    params.set('autosearch', 'true');

    return `${base}?${params.toString()}`;
  }

  const searchForm = document.getElementById('searchForm');
  const searchBtn = document.getElementById('searchBtn');
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = dict();

    if (!fromInput.dataset.code || !toInput.dataset.code) {
      showToast(d.toast_missing_fields);
      return;
    }
    if (!departDateEl.value || (searchState.tripType === 'round' && !returnDateEl.value)) {
      showToast(d.toast_missing_dates || d.toast_missing_fields);
      return;
    }

    const url = buildSearchUrl();
    if (!url) return;

    searchBtn.classList.add('loading');
    setTimeout(() => {
      window.location.href = url;
    }, 380);
  });

})();
