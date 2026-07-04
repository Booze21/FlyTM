(function () {
  "use strict";

  // ---------- Loader sequence ----------
  let currentLang = localStorage.getItem ? null : null; // avoid storage per artifact constraints; use in-memory only
  let langCode = 'en';

  // ---------- Search state (trip type / class / passengers / dates) ----------
  const searchState = {
    tripType: 'round',   // 'round' | 'oneway'
    cabinClass: 0,       // 0 = Economy, 1 = Business (Travelpayouts trip_class)
    adults: 1,
    children: 0,
    infants: 0,
  };

  // ---------- i18n ----------
  const langMenu = document.getElementById('langMenu');
  const langSelect = document.getElementById('langSelect');
  const langBtn = document.getElementById('langBtn');
  const langFlag = document.getElementById('langFlag');
  const langLabel = document.getElementById('langLabel');

  function renderLangMenu() {
    langMenu.innerHTML = '';
    Object.keys(I18N).forEach(code => {
      const d = I18N[code];
      const btn = document.createElement('button');
      btn.className = 'lang-option' + (code === langCode ? ' active' : '');
      btn.setAttribute('role', 'menuitem');
      btn.innerHTML = `<span class="flag">${d.flag}</span><span>${d.name}</span><span class="native">${code.toUpperCase()}</span>`;
      btn.addEventListener('click', () => setLang(code));
      langMenu.appendChild(btn);
    });
  }

  function applyI18n() {
    const d = I18N[langCode];
    document.documentElement.lang = langCode;
    langFlag.textContent = d.flag;
    langLabel.textContent = langCode.toUpperCase();
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (d[key] !== undefined) el.textContent = d[key];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (key === 'tagline') el.innerHTML = d.tagline_html;
    });
    document.getElementById('inputFrom').placeholder = d.placeholder;
    document.getElementById('inputTo').placeholder = d.placeholder;
    renderQuickRoutes();
    renderProofStrip();
    renderLangMenu();
    updatePaxLabel();
    updatePaxNoteVisibility();
  }

  function setLang(code) {
    langCode = code;
    applyI18n();
    langSelect.classList.remove('open');
    langBtn.setAttribute('aria-expanded', 'false');
  }

  langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = langSelect.classList.toggle('open');
    langBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', () => {
    langSelect.classList.remove('open');
    langBtn.setAttribute('aria-expanded', 'false');
  });
  langMenu.addEventListener('click', e => e.stopPropagation());

  // ---------- Quick routes chips ----------
  function renderQuickRoutes() {
    const wrap = document.getElementById('quickRoutes');
    wrap.innerHTML = '';
    const d = I18N[langCode];
    const label = document.createElement('span');
    label.className = 'chip-label';
    label.textContent = d.quick_label || 'Trending';
    wrap.appendChild(label);
    const picks = ["JFK", "LHR", "NRT", "DXB", "SIN", "CDG"];
    picks.forEach(code => {
      const a = AIRPORTS.find(x => x.code === code);
      if (!a) return;
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.type = 'button';
      chip.innerHTML = `<span class="flag">${a.flag}</span><span>${a.city}</span>`;
      chip.addEventListener('click', () => {
        document.getElementById('inputTo').value = `${a.city}`;
        document.getElementById('toFlag').textContent = a.flag;
        document.getElementById('fieldTo').dataset.code = a.code;
      });
      wrap.appendChild(chip);
    });
  }

  // ---------- Proof strip ----------
  function renderProofStrip() {
    const d = I18N[langCode];
    const strip = document.getElementById('proofStrip');
    strip.innerHTML = `
      <div class="proof-item"><div class="proof-num">${d.stat1n}</div><div class="proof-label">${d.stat1l}</div></div>
      <div class="proof-sep"></div>
      <div class="proof-item"><div class="proof-num">${d.stat2n}</div><div class="proof-label">${d.stat2l}</div></div>
      <div class="proof-sep"></div>
      <div class="proof-item"><div class="proof-num">${d.stat3n}</div><div class="proof-label">${d.stat3l}</div></div>
    `;
  }

  // ---------- Search autocomplete ----------
  function setupField(inputId, suggestId, flagId, fieldId, codeId) {
    const input = document.getElementById(inputId);
    const suggest = document.getElementById(suggestId);
    const flagEl = document.getElementById(flagId);
    const fieldEl = document.getElementById(fieldId);
    const codeEl = codeId ? document.getElementById(codeId) : null;
    let activeIndex = -1;
    let currentList = [];

    function renderList(list, query) {
      currentList = list;
      activeIndex = -1;
      suggest.innerHTML = '';
      if (list.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'suggest-empty';
        empty.textContent = I18N[langCode].no_results;
        suggest.appendChild(empty);
        return;
      }
      const label = document.createElement('div');
      label.className = 'suggest-group-label';
      label.textContent = query ? I18N[langCode].popular : I18N[langCode].quick_label;
      suggest.appendChild(label);

      list.forEach((a, i) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'suggest-item';
        item.innerHTML = `
          <span class="flag">${a.flag}</span>
          <span class="place-info">
            <div class="city">${a.city}</div>
            <div class="country">${a.country}</div>
          </span>
          <span class="code">${a.code}</span>
        `;
        item.addEventListener('click', () => selectAirport(a));
        item.addEventListener('mouseenter', () => {
          activeIndex = i;
          updateHighlight();
        });
        suggest.appendChild(item);
      });
    }

    function updateHighlight() {
      [...suggest.querySelectorAll('.suggest-item')].forEach((el, i) => {
        el.classList.toggle('hl', i === activeIndex);
      });
    }

    function selectAirport(a) {
      input.value = a.city;
      flagEl.textContent = a.flag;
      fieldEl.dataset.code = a.code;
      if (codeEl) codeEl.textContent = a.code;
      closeSuggest();
    }

    function openSuggest() {
      suggest.classList.add('open');
      fieldEl.classList.add('focused');
    }
    function closeSuggest() {
      suggest.classList.remove('open');
      fieldEl.classList.remove('focused');
    }

    function search(query) {
      const q = query.trim().toLowerCase();
      if (q.length === 0) {
        return AIRPORTS.filter(a => a.popular).slice(0, 6);
      }
      return AIRPORTS.filter(a =>
        a.city.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q)
      ).slice(0, 8);
    }

    input.addEventListener('focus', () => {
      renderList(search(input.value), input.value.trim());
      openSuggest();
    });
    input.addEventListener('input', () => {
      renderList(search(input.value), input.value.trim());
      openSuggest();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, currentList.length - 1);
        updateHighlight();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateHighlight();
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && currentList[activeIndex]) selectAirport(currentList[activeIndex]);
      } else if (e.key === 'Escape') {
        closeSuggest();
      }
    });
    document.addEventListener('click', (e) => {
      if (!fieldEl.contains(e.target)) closeSuggest();
    });
    fieldEl.addEventListener('click', (e) => e.stopPropagation());
  }

  setupField('inputFrom', 'suggestFrom', 'fromFlag', 'fieldFrom', 'fromCode');
  setupField('inputTo', 'suggestTo', 'toFlag', 'fieldTo', null);

  // pre-select origin
  document.getElementById('fieldFrom').dataset.code = 'IST';

  // ---------- Swap button ----------
  document.getElementById('swapBtn').addEventListener('click', () => {
    const fromInput = document.getElementById('inputFrom');
    const toInput = document.getElementById('inputTo');
    const fromFlag = document.getElementById('fromFlag');
    const toFlag = document.getElementById('toFlag');
    const fieldFrom = document.getElementById('fieldFrom');
    const fieldTo = document.getElementById('fieldTo');

    const tmpVal = fromInput.value; fromInput.value = toInput.value; toInput.value = tmpVal;
    const tmpFlag = fromFlag.textContent; fromFlag.textContent = toFlag.textContent || '✈️'; toFlag.textContent = tmpFlag;
    const tmpCode = fieldFrom.dataset.code; fieldFrom.dataset.code = fieldTo.dataset.code || ''; fieldTo.dataset.code = tmpCode || '';
    document.getElementById('fromCode').textContent = fieldFrom.dataset.code || '';
  });

  // ---------- Trip type toggle ----------
  const tripTypeEl = document.getElementById('tripType');
  const searchCardEl = document.querySelector('.search-card');
  const fieldReturnEl = document.getElementById('fieldReturn');
  const inputDepartEl = document.getElementById('inputDepart');
  const inputReturnEl = document.getElementById('inputReturn');

  function setTripType(value) {
    searchState.tripType = value;
    [...tripTypeEl.querySelectorAll('.trip-type-opt')].forEach(btn => {
      const active = btn.dataset.value === value;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    searchCardEl.classList.toggle('oneway', value === 'oneway');
  }

  tripTypeEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.trip-type-opt');
    if (!btn) return;
    setTripType(btn.dataset.value);
  });

  // ---------- Default dates ----------
  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }
  (function initDates() {
    const today = new Date();
    const depart = new Date(today);
    depart.setDate(depart.getDate() + 14);
    const ret = new Date(depart);
    ret.setDate(ret.getDate() + 7);

    const minDepart = isoDate(today);
    inputDepartEl.min = minDepart;
    inputReturnEl.min = minDepart;
    inputDepartEl.value = isoDate(depart);
    inputReturnEl.value = isoDate(ret);
  })();

  // keep return date from falling before depart date
  inputDepartEl.addEventListener('change', () => {
    if (inputDepartEl.value) {
      inputReturnEl.min = inputDepartEl.value;
      if (inputReturnEl.value && inputReturnEl.value < inputDepartEl.value) {
        inputReturnEl.value = inputDepartEl.value;
      }
    }
  });

  // ---------- Generic pill-select popover (class / passengers) ----------
  function setupPillSelect(wrapEl, btnEl) {
    function open() {
      wrapEl.classList.add('open');
      btnEl.setAttribute('aria-expanded', 'true');
    }
    function close() {
      wrapEl.classList.remove('open');
      btnEl.setAttribute('aria-expanded', 'false');
    }
    function toggle(e) {
      e.stopPropagation();
      const willOpen = !wrapEl.classList.contains('open');
      // close any other open pill-selects first
      document.querySelectorAll('.pill-select.open').forEach(el => {
        if (el !== wrapEl) el.classList.remove('open');
      });
      if (willOpen) open(); else close();
    }
    btnEl.addEventListener('click', toggle);
    wrapEl.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', close);
    return { open, close };
  }

  // ---------- Class select ----------
  const classSelectEl = document.getElementById('classSelect');
  const classBtnEl = document.getElementById('classBtn');
  const classMenuEl = document.getElementById('classMenu');
  const classLabelEl = document.getElementById('classLabel');
  setupPillSelect(classSelectEl, classBtnEl);

  classMenuEl.addEventListener('click', (e) => {
    const opt = e.target.closest('.pill-option');
    if (!opt) return;
    searchState.cabinClass = parseInt(opt.dataset.value, 10);
    [...classMenuEl.querySelectorAll('.pill-option')].forEach(o => o.classList.toggle('active', o === opt));
    classLabelEl.textContent = opt.querySelector('span').textContent;
    classSelectEl.classList.remove('open');
  });

  // ---------- Passenger select ----------
  const paxSelectEl = document.getElementById('paxSelect');
  const paxBtnEl = document.getElementById('paxBtn');
  const paxLabelEl = document.getElementById('paxLabel');
  const paxNoteEl = document.getElementById('paxNote');
  setupPillSelect(paxSelectEl, paxBtnEl);

  const adultsCountEl = document.getElementById('adultsCount');
  const childrenCountEl = document.getElementById('childrenCount');
  const infantsCountEl = document.getElementById('infantsCount');
  const adultsMinusEl = document.getElementById('adultsMinus');
  const adultsPlusEl = document.getElementById('adultsPlus');
  const childrenMinusEl = document.getElementById('childrenMinus');
  const childrenPlusEl = document.getElementById('childrenPlus');
  const infantsMinusEl = document.getElementById('infantsMinus');
  const infantsPlusEl = document.getElementById('infantsPlus');

  const MAX_SEATED = 9; // Travelpayouts: adults + children <= 9
  const MAX_ADULTS = MAX_SEATED;
  const MAX_CHILDREN = MAX_SEATED - 1;
  const MAX_INFANTS = MAX_SEATED;

  function updatePaxLabel() {
    const total = searchState.adults + searchState.children + searchState.infants;
    const d = I18N[langCode];
    const word = total === 1 ? (d.passenger || 'passenger') : (d.passengers || 'passengers');
    paxLabelEl.textContent = `${total} ${word}`;
  }

  function updatePaxNoteVisibility() {
    paxNoteEl.classList.toggle('show', searchState.infants >= searchState.adults && searchState.infants > 0);
  }

  function syncPaxUI() {
    adultsCountEl.textContent = searchState.adults;
    childrenCountEl.textContent = searchState.children;
    infantsCountEl.textContent = searchState.infants;

    adultsMinusEl.disabled = searchState.adults <= 1;
    adultsPlusEl.disabled = searchState.adults >= MAX_ADULTS || (searchState.adults + searchState.children) >= MAX_SEATED;

    childrenMinusEl.disabled = searchState.children <= 0;
    childrenPlusEl.disabled = searchState.children >= MAX_CHILDREN || (searchState.adults + searchState.children) >= MAX_SEATED;

    infantsMinusEl.disabled = searchState.infants <= 0;
    // infants cannot exceed adults (Travelpayouts rule: infants travel on an adult's lap)
    infantsPlusEl.disabled = searchState.infants >= searchState.adults || searchState.infants >= MAX_INFANTS;

    updatePaxLabel();
    updatePaxNoteVisibility();
  }

  adultsMinusEl.addEventListener('click', () => {
    if (searchState.adults > 1) {
      searchState.adults--;
      // infants can never exceed adults
      if (searchState.infants > searchState.adults) searchState.infants = searchState.adults;
      syncPaxUI();
    }
  });
  adultsPlusEl.addEventListener('click', () => {
    if (searchState.adults < MAX_ADULTS && (searchState.adults + searchState.children) < MAX_SEATED) {
      searchState.adults++;
      syncPaxUI();
    }
  });
  childrenMinusEl.addEventListener('click', () => {
    if (searchState.children > 0) {
      searchState.children--;
      syncPaxUI();
    }
  });
  childrenPlusEl.addEventListener('click', () => {
    if (searchState.children < MAX_CHILDREN && (searchState.adults + searchState.children) < MAX_SEATED) {
      searchState.children++;
      syncPaxUI();
    }
  });
  infantsMinusEl.addEventListener('click', () => {
    if (searchState.infants > 0) {
      searchState.infants--;
      syncPaxUI();
    }
  });
  infantsPlusEl.addEventListener('click', () => {
    if (searchState.infants < searchState.adults && searchState.infants < MAX_INFANTS) {
      searchState.infants++;
      syncPaxUI();
    }
  });

  syncPaxUI();

  // ---------- Search submit: build Travelpayouts deeplink & redirect ----------
  function buildSearchUrl() {
    const fieldFrom = document.getElementById('fieldFrom');
    const fieldTo = document.getElementById('fieldTo');
    const fromCode = (fieldFrom.dataset.code || '').toUpperCase();
    const toCode = (fieldTo.dataset.code || '').toUpperCase();

    if (!fromCode || !toCode) return null;

    const departDate = inputDepartEl.value;
    if (!departDate) return null;
    const returnDate = searchState.tripType === 'round' ? inputReturnEl.value : '';
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
    params.set('locale', langCode);
    // auto-trigger the search the instant the destination page loads
    params.set('autosearch', 'true');

    return `${base}?${params.toString()}`;
  }

  document.getElementById('searchSubmit').addEventListener('click', () => {
    const btn = document.getElementById('searchSubmit');
    btn.style.filter = 'brightness(1.25)';
    setTimeout(() => { btn.style.filter = ''; }, 220);

    const d = I18N[langCode];
    const fieldFrom = document.getElementById('fieldFrom');
    const fieldTo = document.getElementById('fieldTo');

    if (!fieldFrom.dataset.code || !fieldTo.dataset.code) {
      alert(d.pick_cities_alert || 'Please choose both a departure and a destination city');
      return;
    }
    if (!inputDepartEl.value || (searchState.tripType === 'round' && !inputReturnEl.value)) {
      alert(d.pick_dates_alert || 'Please choose your travel dates');
      return;
    }

    const url = buildSearchUrl();
    if (!url) return;
    window.location.href = url;
  });

  // ---------- Init ----------
  applyI18n();

  // Fade out scroll cue once the user actually scrolls
  const scrollCueEl = document.querySelector('.scroll-cue');
  if (scrollCueEl) {
    window.addEventListener('scroll', () => {
      scrollCueEl.style.opacity = window.scrollY > 60 ? '0' : '';
      scrollCueEl.style.pointerEvents = window.scrollY > 60 ? 'none' : '';
    }, { passive: true });
  }

})();
