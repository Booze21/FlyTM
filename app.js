(function () {
  "use strict";

  function init() {

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
    tripType: 'oneway',   // 'round' | 'oneway'
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
      const chosenLang = btn.dataset.lang.toLowerCase();
      applyLanguage(chosenLang);
      // Zapominaem ruchnoy vibor — pri sleduyushchem zahode ne budet menyatsya
      try {
        localStorage.setItem('tmbilet_locale', JSON.stringify({ lang: chosenLang, currency: currentCurrency }));
      } catch (e) {}
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

  // ---------- Airport autocomplete ----------
  // Handled entirely by airports-search.js (AirportSearch / AirportAutocomplete).
  // That engine supports Russian, Turkish, Arabic and other multilingual aliases
  // via its ALIAS_MAP. No duplicate listeners needed here.

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
  // departDate / returnDate are <input type="hidden"> managed by the custom calendar picker.
  // We must NOT set .min on them (ignored for hidden inputs) or listen for 'change'
  // (hidden inputs don't fire it). The picker writes ISO dates (YYYY-MM-DD) directly.
  const departDateEl = document.getElementById('departDate');
  const returnDateEl = document.getElementById('returnDate');

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
  // ---------- Auto-detect language & currency by browser ----------
  function autoDetectLocale() {
    // Esli polzovatel uzhe vybral yazik vruchnuyu — ne menyaem
    try {
      const saved = localStorage.getItem('tmbilet_locale');
      if (saved) {
        const { lang, currency } = JSON.parse(saved);
        applyLanguage(lang);
        currentCurrency = currency;
        langLabelEl.textContent = currentCurrency + ' · ' + langCode.toUpperCase();
        langDropdown.querySelectorAll('.lang-opt[data-currency]').forEach((b) =>
          b.classList.toggle('active', b.dataset.currency === currency));
        langDropdown.querySelectorAll('.lang-opt[data-lang]').forEach((b) =>
          b.classList.toggle('active', b.dataset.lang.toLowerCase() === lang));
        renderDestinations(true);
        return;
      }
    } catch (e) {}

    // Opredelyaem po yaziku brauzera
    const lang = (navigator.language || navigator.userLanguage || 'en').toLowerCase().slice(0, 2);
    const MAP = {
      tr: ['tr', 'TRY'],
      ru: ['ru', 'USD'], az: ['ru', 'USD'], kk: ['ru', 'USD'],
      uz: ['ru', 'USD'], be: ['ru', 'USD'], uk: ['ru', 'USD'],
      ar: ['ar', 'AED'],
      de: ['en', 'EUR'], fr: ['en', 'EUR'], es: ['en', 'EUR'],
      it: ['en', 'EUR'], nl: ['en', 'EUR'], pl: ['en', 'EUR'],
      ja: ['en', 'JPY'],
    };
    const [detectedLang, detectedCurrency] = MAP[lang] || ['en', 'USD'];
    applyLanguage(detectedLang);
    currentCurrency = detectedCurrency;
    langLabelEl.textContent = currentCurrency + ' · ' + langCode.toUpperCase();
    langDropdown.querySelectorAll('.lang-opt[data-currency]').forEach((b) =>
      b.classList.toggle('active', b.dataset.currency === detectedCurrency));
    langDropdown.querySelectorAll('.lang-opt[data-lang]').forEach((b) =>
      b.classList.toggle('active', b.dataset.lang.toLowerCase() === detectedLang));
    renderDestinations(true);
  }
  autoDetectLocale();

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

    const cfg = window.TMBILET_CONFIG || { searchHost: 'https://avia.TMbilet.com', searchPath: '/' };
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

  // Ensure the button click always triggers the submit handler regardless of
  // any stacking/event-propagation side-effects introduced by design changes.
  searchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    searchForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = dict();

    if (!fromInput.dataset.code || !toInput.dataset.code) {
      showToast(d.toast_missing_fields);
      return;
    }

    // departDate is a hidden input written by the custom calendar picker.
    // If it's empty the user saw the calendar but never clicked a day.
    const departDisplay = document.getElementById('departDisplay');
    const returnDisplay = document.getElementById('returnDisplay');
    const departMissing = !departDateEl.value || (departDisplay && departDisplay.classList.contains('placeholder'));
    const returnMissing = searchState.tripType === 'round' &&
      (!returnDateEl.value || (returnDisplay && returnDisplay.classList.contains('placeholder')));

    if (departMissing || returnMissing) {
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

  } // end init()

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
