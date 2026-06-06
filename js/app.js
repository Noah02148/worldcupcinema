/* app.js — hash router + rendering. Data is fetched once and cached; language
 * and view switches re-render from memory (no refetch), per spec §4.
 */
(function () {
  'use strict';

  const { t, getLang, setLang } = window.I18N;
  const I18N = window.I18N;
  const DATA = window.DATA;

  const appEl = document.getElementById('app');

  const ui = {
    lang: 'zh',
    view: 'date', // 'date' | 'group' — group-stage layout toggle
  };

  /* ---------- helpers ---------- */

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const countryName = (c) =>
    !c ? '' : (getLang() === 'en' ? (c.country_en || c.country_zh) : (c.country_zh || c.country_en));

  const filmTitle = (f) =>
    !f ? '' : (getLang() === 'en' ? (f.title_en || f.title_original || f.title_zh)
                                  : (f.title_zh || f.title_original || f.title_en));

  /* ---------- match status / score ---------- */

  // Resolve a fixture's live/final state into display bits.
  function matchStatus(fx) {
    const r = DATA.resultForFixture(fx);
    const live = !!(r && r.state === 'in');
    const done = !!(r && (r.state === 'post' || r.completed));
    const hasScore = live || done;
    const h = r && r.home != null && r.home !== '' ? r.home : '-';
    const a = r && r.away != null && r.away !== '' ? r.away : '-';
    const score = hasScore ? `${esc(h)}<span class="sc-dash">–</span>${esc(a)}` : null;
    let label, cls;
    if (live) { cls = 'is-live'; label = t('status_live') + (r.detail ? ' · ' + r.detail : ''); }
    else if (done) { cls = 'is-final'; label = t('status_final'); }
    else { cls = 'is-pre'; label = t('status_pre'); }
    return { hasScore, live, done, score, label, cls };
  }

  /* ---------- poster ---------- */

  // The fill script writes the literal "待定" into url cells it couldn't resolve,
  // so treat those (and TBD titles) as "not set" rather than real values.
  const SKIP_TITLES = new Set(['', '待定', 'tbd', 'tbd.']);
  const cleanUrl = (s) => {
    const u = (s || '').trim();
    return /^https?:\/\//i.test(u) ? u : '';
  };
  const posterUrlOf = (f) => (f ? cleanUrl(f.poster_url) : '');
  function isTbdFilm(f) {
    if (!f) return true;
    return [f.title_zh, f.title_en, f.title_original]
      .every((s) => SKIP_TITLES.has((s || '').trim().toLowerCase()));
  }

  // Le Voyage dans la Lune (1902, public domain) — the most iconic film image.
  const TBD_ICON =
    '<img class="tbd-moon" src="./assets/moon.jpg" alt="" loading="lazy">';

  function posterEl(film) {
    const slot = el('div', 'poster');
    const url = posterUrlOf(film);

    if (url) {
      const img = el('img', 'poster-img');
      img.loading = 'lazy';
      img.src = url;
      img.alt = filmTitle(film);
      slot.appendChild(img);
      addPosterHover(slot, film); // wall hides title; hover reveals
    } else if (isTbdFilm(film)) {
      // unified placeholder for a not-yet-chosen film
      slot.classList.add('poster--empty', 'poster--tbd');
      slot.innerHTML =
        `<div class="tbd">${TBD_ICON}` +
        `<div class="tbd-title">${esc(t('tbd_title'))}</div>` +
        `<div class="tbd-sub">${esc(t('tbd_sub'))}</div></div>`;
    } else {
      // film is known but its poster image isn't filled in yet
      slot.classList.add('poster--empty');
      slot.appendChild(el('div', 'poster-fallback', esc(filmTitle(film))));
      addPosterHover(slot, film);
    }
    return slot;
  }

  function addPosterHover(slot, film) {
    const cap = el('div', 'poster-hover');
    const yr = (film.year || '').trim();
    cap.innerHTML = `<span class="ph-title">${esc(filmTitle(film))}</span>` +
      (yr ? `<span class="ph-year">${esc(yr)}</span>` : '');
    slot.appendChild(cap);
  }

  /* ---------- match card ---------- */

  function matchCard(fx) {
    const card = el('article', 'match-card');

    const home = DATA.model.countriesById[(fx.home_id || '').trim()];
    const away = DATA.model.countriesById[(fx.away_id || '').trim()];
    const md = fx.matchdayNum;

    // meta line: Group X · time · city
    const meta = el('div', 'match-meta');
    const groupTxt = `${t('group_label')} ${esc(fx.group)}`;
    const timeTxt = I18N.formatTime(fx.instant);
    const city = esc(I18N.cityName(fx.venue_city));
    const st = matchStatus(fx);
    meta.innerHTML =
      `<span class="m-group">${groupTxt}</span>` +
      `<span class="m-dot">·</span><span class="m-time">${timeTxt}</span>` +
      `<span class="m-tz">${esc(t('tz_note'))}</span>` +
      (city ? `<span class="m-dot">·</span><span class="m-city">${city}</span>` : '') +
      `<span class="m-status ${st.cls}">${esc(st.label)}</span>`;
    card.appendChild(meta);

    const body = el('div', 'match-body');
    body.appendChild(teamSide(home, fx.home_id, md));
    const center = el('div', 'vs' + (st.hasScore ? ' has-score' : ''));
    center.innerHTML = st.hasScore
      ? `<span class="score">${st.score}</span>`
      : `<span>${esc(t('vs'))}</span>`;
    body.appendChild(center);
    body.appendChild(teamSide(away, fx.away_id, md));
    card.appendChild(body);

    return card;
  }

  function teamSide(country, countryId, matchday) {
    const id = (countryId || '').trim();
    const film = DATA.filmForMatch(id, matchday);
    const side = el('a', 'team-side');
    side.href = `#/country/${encodeURIComponent(id)}`;

    side.appendChild(posterEl(film));

    const label = el('div', 'team-label');
    label.innerHTML =
      `<span class="flag">${esc((country && country.flag) || '')}</span>` +
      `<span class="cname">${esc(countryName(country) || id)}</span>`;
    side.appendChild(label);
    return side;
  }

  /* ---------- group-stage view toggle ---------- */

  function viewToggle() {
    const wrap = el('div', 'view-toggle');
    [['date', 'view_by_date'], ['group', 'view_by_group']].forEach(([v, key]) => {
      const b = el('button', 'view-btn' + (ui.view === v ? ' is-active' : ''), esc(t(key)));
      b.addEventListener('click', () => {
        if (ui.view === v) return;
        ui.view = v;
        try { localStorage.setItem('wcc_view', v); } catch (e) {}
        render();
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  /* ---------- pages ---------- */

  function renderGroupStage() {
    appEl.innerHTML = '';
    setActiveTab('group');
    appEl.appendChild(viewToggle());

    const container = el('div', 'schedule');
    if (ui.view === 'date') renderByDate(container);
    else renderByGroup(container);
    appEl.appendChild(container);
  }

  function renderByDate(container) {
    // "Today" in the current language's timezone, so it tracks the same clock
    // the times are shown in (zh -> Beijing, en -> ET). `?today=YYYY-MM-DD`
    // overrides it for previewing the live ordering before the tournament.
    const override = new URLSearchParams(location.search).get('today');
    const todayKey = /^\d{4}-\d{2}-\d{2}$/.test(override || '')
      ? override : I18N.dateKey(new Date());

    const buckets = new Map(); // dateKey -> { key, instant, fixtures[] }
    DATA.model.fixtures.forEach((fx) => {
      const key = I18N.dateKey(fx.instant);
      if (!buckets.has(key)) buckets.set(key, { key, instant: fx.instant, fixtures: [] });
      buckets.get(key).fixtures.push(fx);
    });

    const all = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
    const todayBuckets = all.filter((b) => b.key === todayKey);
    const future = all.filter((b) => b.key > todayKey);          // ascending: next up first
    const past = all.filter((b) => b.key < todayKey).reverse();   // most recent completed first

    const renderDay = (b, isToday) => {
      const section = el('section', 'day-section' + (isToday ? ' is-today' : ''));
      const label = (isToday ? t('today') + ' · ' : '') + I18N.formatDateFull(b.instant);
      section.appendChild(el('h2', 'section-head', esc(label)));
      const grid = el('div', 'card-grid');
      b.fixtures
        .slice()
        .sort((a, c) => a.instant - c.instant)
        .forEach((fx) => grid.appendChild(matchCard(fx)));
      section.appendChild(grid);
      container.appendChild(section);
    };

    // Upcoming first (today pinned at the very top), completed below a divider.
    todayBuckets.forEach((b) => renderDay(b, true));
    future.forEach((b) => renderDay(b, false));
    if (past.length) {
      container.appendChild(el('h2', 'completed-head', esc(t('completed_heading'))));
      past.forEach((b) => renderDay(b, false));
    }
  }

  function renderByGroup(container) {
    const byGroup = {};
    DATA.model.fixtures.forEach((fx) => {
      const g = (fx.group || '').trim();
      (byGroup[g] = byGroup[g] || []).push(fx);
    });

    Object.keys(byGroup).sort().forEach((g) => {
      const section = el('section', 'day-section');
      section.appendChild(
        el('h2', 'section-head', `${esc(t('group_label'))} ${esc(g)}`));
      const grid = el('div', 'card-grid');
      byGroup[g]
        .slice()
        .sort((a, b) => (a.matchdayNum - b.matchdayNum) || (a.instant - b.instant))
        .forEach((fx) => grid.appendChild(matchCard(fx)));
      section.appendChild(grid);
      container.appendChild(section);
    });
  }

  function renderKnockout() {
    appEl.innerHTML = '';
    setActiveTab('knockout');
    const ph = el('div', 'placeholder');
    ph.appendChild(el('div', 'ph-big', esc(t('knockout_tbd'))));
    ph.appendChild(el('div', 'ph-sub', esc(t('knockout_hint'))));
    appEl.appendChild(ph);
  }

  function renderCountry(countryId) {
    appEl.innerHTML = '';
    setActiveTab('group');
    const id = decodeURIComponent(countryId).trim();
    const country = DATA.model.countriesById[id];

    const back = el('a', 'back-link', esc(t('back')));
    back.href = '#/';
    appEl.appendChild(back);

    if (!country) {
      appEl.appendChild(el('div', 'placeholder', `<div class="ph-big">${esc(t('not_found'))}</div>`));
      return;
    }

    const head = el('div', 'country-head');
    head.innerHTML =
      `<span class="country-flag">${esc(country.flag || '')}</span>` +
      `<h1 class="country-name">${esc(countryName(country))}</h1>` +
      `<span class="country-group">${esc(t('group_label'))} ${esc(country.group)}</span>`;
    appEl.appendChild(head);

    // Fixtures
    appEl.appendChild(el('h2', 'block-head', esc(t('fixtures_heading'))));
    const fxList = el('div', 'fixture-list');
    (DATA.model.fixturesByCountry[id] || []).forEach((fx) => {
      fxList.appendChild(countryFixtureRow(fx, id));
    });
    appEl.appendChild(fxList);

    // Films
    appEl.appendChild(el('h2', 'block-head', esc(t('films_heading'))));
    const films = DATA.filmsList(id);
    const grid = el('div', 'film-grid');
    if (!films.length) {
      grid.appendChild(el('div', 'muted', esc(t('no_film'))));
    } else {
      films.forEach((f) => grid.appendChild(filmCard(f)));
    }
    appEl.appendChild(grid);
  }

  function countryFixtureRow(fx, selfId) {
    const oppId = (fx.home_id || '').trim() === selfId
      ? (fx.away_id || '').trim() : (fx.home_id || '').trim();
    const opp = DATA.model.countriesById[oppId];

    // Result chip, oriented to this country (self score first).
    const st = matchStatus(fx);
    let resultHTML;
    if (st.hasScore) {
      const r = DATA.resultForFixture(fx);
      const selfHome = (fx.home_id || '').trim() === selfId;
      const selfScore = selfHome ? r.home : r.away;
      const oppScore = selfHome ? r.away : r.home;
      let outcome = 'is-live';
      if (st.done) {
        const a = Number(selfScore), b = Number(oppScore);
        outcome = a > b ? 'is-win' : a < b ? 'is-loss' : 'is-draw';
      }
      resultHTML = `<span class="fr-result ${outcome}">${esc(selfScore)} - ${esc(oppScore)}</span>`;
    } else {
      resultHTML = `<span class="fr-result is-pre">${esc(t('status_pre'))}</span>`;
    }

    const row = el('a', 'fixture-row');
    row.href = `#/country/${encodeURIComponent(oppId)}`;
    row.innerHTML =
      `<span class="fr-md">${esc(t('matchday_label', { n: fx.matchdayNum }))}</span>` +
      `<span class="fr-opp"><span class="flag">${esc((opp && opp.flag) || '')}</span>` +
        `<span>${esc(countryName(opp) || oppId)}</span></span>` +
      resultHTML +
      `<span class="fr-when">${esc(I18N.formatDateFull(fx.instant))} · ${esc(I18N.formatTime(fx.instant))}` +
        `<span class="fr-tz">${esc(t('tz_note'))}</span></span>` +
      `<span class="fr-city">${esc(I18N.cityName(fx.venue_city))}</span>`;
    return row;
  }

  function filmCard(f) {
    const card = el('div', 'film-card');
    card.appendChild(posterEl(f));

    const info = el('div', 'film-info');

    if (isTbdFilm(f)) {
      info.innerHTML =
        `<div class="film-title">${esc(t('tbd_title'))}</div>` +
        `<div class="film-dir">${esc(t('tbd_sub'))}</div>`;
      card.appendChild(info);
      return card;
    }

    const title = esc(filmTitle(f));
    const orig = (f.title_original || '').trim();
    const yr = (f.year || '').trim();
    const dir = (f.director || '').trim();

    info.innerHTML =
      `<div class="film-title">${title}${yr ? ` <span class="film-year">${esc(yr)}</span>` : ''}</div>` +
      (orig && orig !== filmTitle(f) ? `<div class="film-orig">${esc(orig)}</div>` : '') +
      (dir ? `<div class="film-dir">${esc(t('director_label'))}: ${esc(dir)}</div>` : '');

    const lb = cleanUrl(f.letterboxd_url);
    if (lb) {
      const a = el('a', 'lb-link', esc(t('letterboxd')) + ' →');
      a.href = lb;
      a.target = '_blank';
      a.rel = 'noopener';
      info.appendChild(a);
    }
    card.appendChild(info);
    return card;
  }

  /* ---------- chrome: tabs, language ---------- */

  function setActiveTab(which) {
    document.querySelectorAll('.tab').forEach((t) =>
      t.classList.toggle('is-active', t.dataset.tab === which));
  }

  function applyStaticI18n() {
    document.documentElement.lang = getLang();
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll('.lang-btn').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.lang === getLang()));
  }

  function switchLang(lang) {
    setLang(lang);
    try { localStorage.setItem('wcc_lang', getLang()); } catch (e) {}
    const url = new URL(location.href);
    url.searchParams.set('lang', getLang());
    history.replaceState(null, '', url);
    render();
  }

  /* ---------- router ---------- */

  function render() {
    if (!DATA.model.loaded) return;
    applyStaticI18n();
    const hash = location.hash || '#/';
    const m = hash.match(/^#\/country\/(.+)$/);
    if (m) return renderCountry(m[1]);
    if (hash.startsWith('#/knockout')) return renderKnockout();
    return renderGroupStage();
  }

  /* ---------- init ---------- */

  function restorePrefs() {
    const url = new URL(location.href);
    const qpLang = url.searchParams.get('lang');
    let lang = qpLang;
    try { lang = lang || localStorage.getItem('wcc_lang'); } catch (e) {}
    setLang(lang === 'en' ? 'en' : 'zh');

    try {
      const v = localStorage.getItem('wcc_view');
      if (v === 'date' || v === 'group') ui.view = v;
    } catch (e) {}
  }

  function wireChrome() {
    document.querySelectorAll('.lang-btn').forEach((b) =>
      b.addEventListener('click', () => switchLang(b.dataset.lang)));
    window.addEventListener('hashchange', render);
  }

  // Poll ESPN for live scores; re-render only when something actually changed
  // (so the page doesn't jump while you're reading a static schedule).
  function startResultPolling() {
    setInterval(async () => {
      if (document.hidden) return;
      try {
        const changed = await DATA.fetchResults();
        if (changed) render();
      } catch (e) { /* keep last-known scores */ }
    }, 60000);
  }

  async function init() {
    restorePrefs();
    applyStaticI18n();
    wireChrome();
    try {
      await DATA.load();
      render();
      startResultPolling();
    } catch (err) {
      console.error(err);
      appEl.innerHTML = '';
      appEl.appendChild(el('div', 'placeholder',
        `<div class="ph-big">⚠️</div><div class="ph-sub">${esc(t('load_error'))}</div>`));
    }
  }

  init();
})();
