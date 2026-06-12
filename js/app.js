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

  // Lazy-load posters but start ~1.5 screens early, so on a slow connection
  // they're usually ready by the time you scroll to them (native loading="lazy"
  // starts too late and shows a 1–2s blank).
  const lazyIO = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries, obs) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { obs.unobserve(e.target); if (e.target._start) e.target._start(); }
        });
      }, { rootMargin: '1400px 0px' })
    : null;

  function observeLazy(img, start) {
    if (lazyIO) { img._start = start; lazyIO.observe(img); }
    else start();
  }

  // The fill script writes the literal "待定" into url cells it couldn't resolve,
  // so treat those (and TBD titles) as "not set" rather than real values.
  const SKIP_TITLES = new Set(['', '待定', 'tbd', 'tbd.']);
  const cleanUrl = (s) => {
    const u = (s || '').trim();
    return /^https?:\/\//i.test(u) ? u : '';
  };
  const posterUrlOf = (f) => (f ? cleanUrl(f.poster_url) : '');

  // Poster source chain, tried in order onerror: jsDelivr CDN (cached globally,
  // usually more reachable/faster in China than raw github.io) -> our own
  // github.io copy -> the original TMDB URL. The film title shows behind if all
  // fail. New posters not yet on the CDN simply fall back to the github.io copy.
  const REPO_CDN = 'https://cdn.jsdelivr.net/gh/Noah02148/worldcupcinema@main/assets/posters/';
  const posterSources = (url) => {
    const m = (url || '').match(/image\.tmdb\.org\/t\/p\/[^/]+\/(.+)$/);
    return m ? [REPO_CDN + m[1], './assets/posters/' + m[1], url] : [url];
  };
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
      // Title sits behind the image so a slow/failed poster (common where
      // github.io is throttled) degrades to the film name, never a blank slot.
      // The <img> covers it once it paints.
      slot.classList.add('poster--empty');
      slot.appendChild(el('div', 'poster-fallback', esc(filmTitle(film))));

      const img = el('img', 'poster-img');
      img.decoding = 'async';
      img.alt = filmTitle(film);

      const sources = posterSources(url); // jsDelivr -> github.io -> TMDB
      let si = 0;
      img.onerror = () => {
        si += 1;
        if (si < sources.length) img.src = sources[si];
        else { img.onerror = null; img.style.display = 'none'; } // reveal title behind
      };
      slot.appendChild(img);
      observeLazy(img, () => { img.src = sources[0]; }); // preload ~1.5 screens early
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

  /* ---------- Claude Fable 5 parlay picks ---------- */

  const PREDICTIONS = window.PREDICTIONS || {};
  const revealedDays = new Set(); // future days the user clicked to reveal

  // Final outcome of a match for grading: winning country_id, 'DRAW', or null
  // when it isn't a completed result yet.
  function matchFinal(fx) {
    const r = DATA.resultForFixture(fx);
    if (!r || !(r.completed || r.state === 'post')) return null;
    const h = Number(r.home), a = Number(r.away);
    if (Number.isNaN(h) || Number.isNaN(a)) return null;
    if (h > a) return (fx.home_id || '').trim();
    if (a > h) return (fx.away_id || '').trim();
    return 'DRAW';
  }

  // Whether a match has a final result at all (any leg decided).
  function isFinished(fx) { return matchFinal(fx) != null; }

  // A ticket's standing: 'passed' (all legs hit), 'failed' (a leg missed), or
  // 'pending' (still undecided legs, none missed yet).
  function ticketStatus(ticket, fxById) {
    const ids = Object.keys(ticket.picks).filter((mid) => fxById[mid]);
    let anyMiss = false, anyPending = false;
    ids.forEach((mid) => {
      const out = matchFinal(fxById[mid]);
      if (out == null) anyPending = true;
      else if (out !== ticket.picks[mid]) anyMiss = true;
    });
    if (anyMiss) return 'failed';
    if (anyPending) return 'pending';
    return 'passed';
  }

  // Reveal button: "生成 Claude AI 预测方案" for upcoming days, or
  // "查看 Claude AI 预测方案" (review) once a day has results.
  function revealButton(bucket, section, settled) {
    const btn = el('button', 'parlay-reveal');
    btn.innerHTML =
      `<span class="parlay-reveal-icon" aria-hidden="true">${settled ? '📊' : '🔮'}</span>` +
      `<span>${esc(t(settled ? 'view_parlay' : 'generate_parlay'))}</span>`;
    btn.addEventListener('click', () => {
      revealedDays.add(bucket.key);
      const slip = parlayCard(bucket.key, bucket.fixtures);
      if (slip) section.replaceChild(slip, btn); else btn.remove();
    });
    return btn;
  }

  // One side: flag + name. `dim` faintens the loser/opponent in a win row.
  const teamHTML = (c, id, dim) =>
    `<span class="flag">${esc((c && c.flag) || '')}</span>` +
    `<span class="cname${dim ? ' is-opp' : ''}">${esc(countryName(c) || id)}</span>`;

  // Pick badge with grading: 胜/平, plus ✓/✗ and hit/miss colour once final.
  function pickBadge(fx, pick) {
    const label = pick === 'DRAW' ? t('pick_draw') : t('pick_win');
    const out = matchFinal(fx);
    let cls = 'parlay-pick' + (pick === 'DRAW' ? ' is-draw' : '');
    let mark = '';
    if (out != null) {
      if (out === pick) { cls += ' is-hit'; mark = ' ✓'; }
      else { cls += ' is-miss'; mark = ' ✗'; }
    }
    return `<span class="${cls}">${esc(label)}${esc(mark)}</span>`;
  }

  // One pick row: winner VS opponent + 胜, or both teams + 平 for a draw. Both
  // sides always show a flag.
  function pickRow(fx, pick) {
    const home = DATA.model.countriesById[(fx.home_id || '').trim()];
    const away = DATA.model.countriesById[(fx.away_id || '').trim()];
    const row = el('div', 'parlay-row');

    if (pick === 'DRAW') {
      row.innerHTML =
        `<span class="parlay-team">` +
          teamHTML(home, fx.home_id) +
          `<span class="parlay-vs">${esc(t('vs'))}</span>` +
          teamHTML(away, fx.away_id) +
        `</span>` + pickBadge(fx, pick);
    } else {
      const win = DATA.model.countriesById[pick];
      const oppId = pick === (fx.home_id || '').trim() ? fx.away_id : fx.home_id;
      const opp = DATA.model.countriesById[(oppId || '').trim()];
      row.innerHTML =
        `<span class="parlay-team">` +
          teamHTML(win, pick) +
          `<span class="parlay-vs">${esc(t('vs'))}</span>` +
          teamHTML(opp, oppId, true) +
        `</span>` + pickBadge(fx, pick);
    }
    return row;
  }

  // One ticket: label + stake% + N串1, then its pick rows. Each ticket is
  // capped at 3 legs by the data (4-match days are split into two 2串1).
  function ticketEl(ticket, fxById) {
    if (!ticket || !ticket.picks) return null;
    const ids = Object.keys(ticket.picks).filter((mid) => fxById[mid]);
    if (!ids.length) return null;
    ids.sort((a, b) => fxById[a].instant - fxById[b].instant);

    const tk = el('div', 'parlay-ticket' + (ticket.dim ? ' is-alt' : ''));
    const head = el('div', 'ticket-head');
    head.innerHTML =
      `<span class="ticket-label">${esc(t(ticket.label || 'parlay_main'))}</span>` +
      (ticket.stake != null ? `<span class="ticket-stake">${esc(ticket.stake)}%</span>` : '') +
      (ids.length > 1 ? `<span class="ticket-combo">${esc(ids.length)}${esc(t('parlay_combo'))}</span>` : '');
    tk.appendChild(head);

    const list = el('div', 'parlay-list');
    ids.forEach((mid) => list.appendChild(pickRow(fxById[mid], ticket.picks[mid])));
    tk.appendChild(list);
    return tk;
  }

  // Group verdict from its main/hedge tickets: 'main' (主推过关成功),
  // 'alt' (副推过关成功), 'fail' (过关失败), or null while still pending.
  function groupVerdict(grp, fxById) {
    const main = (grp.tickets || []).find((tk) => tk.label === 'parlay_main');
    const alt = (grp.tickets || []).find((tk) => tk.label === 'parlay_alt');
    if (main && ticketStatus(main, fxById) === 'passed') return 'main';
    if (alt && ticketStatus(alt, fxById) === 'passed') return 'alt';
    const decided = (tk) => !tk || ticketStatus(tk, fxById) === 'failed';
    return decided(main) && decided(alt) ? 'fail' : null;
  }

  // The day's parlay slip, keyed by the Beijing date the day section uses. Each
  // group offers main+hedge alternatives over a subset of matches; with 2+
  // groups the user mixes one ticket per group (e.g. their own 四串一). Once
  // results land, each group shows a 主推/副推过关成功 or 过关失败 verdict.
  function parlayCard(dateKey, fixtures) {
    const day = PREDICTIONS[dateKey];
    if (!day || !day.groups) return null;
    const fxById = {};
    fixtures.forEach((fx) => { fxById[(fx.match_id || '').trim()] = fx; });

    const groups = day.groups
      .map((grp) => ({ tickets: (grp.tickets || []).map((tk) => ticketEl(tk, fxById)).filter(Boolean),
                       verdict: groupVerdict(grp, fxById) }))
      .filter((g) => g.tickets.length);
    if (!groups.length) return null;
    const multi = groups.length > 1;

    const card = el('section', 'parlay');
    const head = el('div', 'parlay-head',
      `<span class="parlay-mark" aria-hidden="true">🎟</span>` +
      `<span class="parlay-title">${esc(t('parlay_title'))}</span>` +
      `<button class="parlay-info" type="button" aria-label="${esc(t('parlay_info'))}">?</button>` +
      `<span class="parlay-tip" role="tooltip" hidden>${esc(t('parlay_info'))}</span>`);
    const info = head.querySelector('.parlay-info');
    const tip = head.querySelector('.parlay-tip');
    info.addEventListener('click', (e) => {
      e.stopPropagation();
      tip.hidden = !tip.hidden;
    });
    card.appendChild(head);

    groups.forEach((grp, gi) => {
      const g = el('div', 'parlay-group');
      if (multi) g.appendChild(el('div', 'parlay-group-head',
        `<span class="parlay-group-label">${esc(t('parlay_group', { n: gi + 1 }))}</span>`));
      grp.tickets.forEach((tk) => g.appendChild(tk));
      // verdict sits at the bottom of the group: 预测结果：主推过关成功
      if (grp.verdict) g.appendChild(el('div', 'parlay-result',
        `<span class="parlay-result-label">${esc(t('verdict_label'))}</span>` +
        `<span class="parlay-verdict is-${grp.verdict}">${esc(t('verdict_' + grp.verdict))}</span>`));
      card.appendChild(g);
    });
    if (multi) card.appendChild(el('div', 'parlay-hint', esc(t('parlay_combine_hint'))));
    return card;
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
    // overrides it for previewing before the tournament.
    const override = new URLSearchParams(location.search).get('today');
    const todayKey = /^\d{4}-\d{2}-\d{2}$/.test(override || '')
      ? override : I18N.dateKey(new Date());

    const buckets = new Map(); // dateKey -> { key, instant, fixtures[] }
    DATA.model.fixtures.forEach((fx) => {
      const key = I18N.dateKey(fx.instant);
      if (!buckets.has(key)) buckets.set(key, { key, instant: fx.instant, fixtures: [] });
      buckets.get(key).fixtures.push(fx);
    });

    // Always chronological — earliest day at the top.
    const all = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));

    // Scroll target for the "今日比赛" button: today if it still has an unplayed
    // match, else the next day that does (so after today wraps up it jumps to
    // tomorrow's upcoming matches).
    const focus = all.find((b) => b.key >= todayKey && b.fixtures.some((fx) => !isFinished(fx)));
    const focusKey = focus ? focus.key : todayKey;

    // Only the next two day-sections get a "生成" button (keeps it from looking
    // like a betting site; days further out stay hidden until they're closer).
    const generatable = new Set(all.filter((b) => b.key > todayKey).slice(0, 2).map((b) => b.key));

    all.forEach((b) => {
      const isToday = b.key === todayKey;
      const section = el('section', 'day-section' +
        (isToday ? ' is-today' : '') + (b.key === focusKey ? ' is-focus' : ''));
      const label = (isToday ? t('today') + ' · ' : '') + I18N.formatDateFull(b.instant);
      section.appendChild(el('h2', 'section-head', esc(label)));

      // Parlay visibility (kept low-key):
      //  · today, still in progress → auto-show (graded live as legs finish)
      //  · next two upcoming days   → "生成 Claude AI 预测方案" button
      //  · further-out days         → nothing yet
      //  · finished / past days     → "查看 Claude AI 预测方案" (review + verdict)
      if (PREDICTIONS[b.key] && PREDICTIONS[b.key].groups) {
        const allDone = b.fixtures.every((fx) => isFinished(fx));
        if ((isToday && !allDone) || revealedDays.has(b.key)) {
          const slip = parlayCard(b.key, b.fixtures);
          if (slip) section.appendChild(slip);
        } else if (b.key > todayKey) {
          if (generatable.has(b.key)) section.appendChild(revealButton(b, section, false));
        } else {
          section.appendChild(revealButton(b, section, true)); // today all done, or past
        }
      }

      const grid = el('div', 'card-grid');
      b.fixtures
        .slice()
        .sort((a, c) => a.instant - c.instant)
        .forEach((fx) => grid.appendChild(matchCard(fx)));
      section.appendChild(grid);
      container.appendChild(section);
    });
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

  /* ---------- standings ---------- */

  // Tally a country's completed group matches into a standings record.
  function standingFor(country) {
    const id = (country.country_id || '').trim();
    const rec = { country, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
    (DATA.model.fixturesByCountry[id] || []).forEach((fx) => {
      const r = DATA.resultForFixture(fx);
      if (!r || !(r.state === 'post' || r.completed)) return;
      const selfHome = (fx.home_id || '').trim() === id;
      const gf = Number(selfHome ? r.home : r.away);
      const ga = Number(selfHome ? r.away : r.home);
      if (Number.isNaN(gf) || Number.isNaN(ga)) return;
      rec.P += 1; rec.GF += gf; rec.GA += ga;
      if (gf > ga) rec.W += 1; else if (gf < ga) rec.L += 1; else rec.D += 1;
    });
    rec.GD = rec.GF - rec.GA;
    rec.Pts = rec.W * 3 + rec.D;
    return rec;
  }

  // Group standings, sorted (points -> GD -> GF -> name).
  function groupStandings(g) {
    return (DATA.model.countriesByGroup[g] || [])
      .map(standingFor)
      .sort((a, b) =>
        b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF ||
        countryName(a.country).localeCompare(countryName(b.country)));
  }

  function renderStandings() {
    appEl.innerHTML = '';
    setActiveTab('standings');
    const container = el('div', 'standings');

    DATA.model.groups.forEach((g) => {
      const section = el('section', 'standings-group');
      section.appendChild(el('h2', 'section-head', `${esc(t('group_label'))} ${esc(g)}`));

      const table = el('div', 'standings-table');
      table.appendChild(standingsHeader());

      groupStandings(g).forEach((s, i) => table.appendChild(standingsRow(s, i + 1)));

      section.appendChild(table);
      container.appendChild(section);
    });

    appEl.appendChild(container);
  }

  function standingsHeader() {
    const h = el('div', 'standings-row standings-head');
    h.innerHTML =
      '<span class="st-rank"></span>' +
      '<span class="st-poster"></span>' +
      `<span class="st-team">${esc(t('st_team'))}</span>` +
      `<span class="st-n">${esc(t('st_p'))}</span>` +
      `<span class="st-n st-wdl">${esc(t('st_w'))}</span>` +
      `<span class="st-n st-wdl">${esc(t('st_d'))}</span>` +
      `<span class="st-n st-wdl">${esc(t('st_l'))}</span>` +
      `<span class="st-n">${esc(t('st_gd'))}</span>` +
      `<span class="st-n st-pts">${esc(t('st_pts'))}</span>`;
    return h;
  }

  function standingsRow(s, rank) {
    const country = s.country;
    const id = (country.country_id || '').trim();
    const row = el('a', 'standings-row' + (rank <= 2 ? ' is-advancing' : ''));
    row.href = `#/country/${encodeURIComponent(id)}`;

    row.appendChild(el('span', 'st-rank', String(rank)));

    const pw = el('span', 'st-poster');
    pw.appendChild(posterEl(DATA.filmsList(id)[0] || null)); // first available film (slot 1, or next)
    row.appendChild(pw);

    const team = el('span', 'st-team');
    team.innerHTML =
      `<span class="flag">${esc(country.flag || '')}</span>` +
      `<span class="cname">${esc(countryName(country) || id)}</span>`;
    row.appendChild(team);

    const gd = (s.GD > 0 ? '+' : '') + s.GD;
    [['st-n', s.P], ['st-n st-wdl', s.W], ['st-n st-wdl', s.D], ['st-n st-wdl', s.L],
     ['st-n', gd], ['st-n st-pts', s.Pts]].forEach(([cls, val]) =>
      row.appendChild(el('span', cls, String(val))));

    return row;
  }

  /* ---------- knockout bracket ---------- */

  // Official 2026 bracket. Slot codes: "1A"/"2A" = group winner/runner-up;
  // "3:C,E,F,H" = a best-third-place slot (constraint groups); "W74"/"L101" =
  // winner/loser of that match. Rounds render in this order.
  const BRACKET = [
    { round: 'r32', matches: [
      { n: 73, a: '2A', b: '2B' },
      { n: 74, a: '1E', b: '3:A,B,C,D,F' },
      { n: 75, a: '1F', b: '2C' },
      { n: 76, a: '1C', b: '2F' },
      { n: 77, a: '1I', b: '3:C,D,F,G,H' },
      { n: 78, a: '2E', b: '2I' },
      { n: 79, a: '1A', b: '3:C,E,F,H,I' },
      { n: 80, a: '1L', b: '3:E,H,I,J,K' },
      { n: 81, a: '1D', b: '3:B,E,F,I,J' },
      { n: 82, a: '1G', b: '3:A,E,H,I,J' },
      { n: 83, a: '2K', b: '2L' },
      { n: 84, a: '1H', b: '2J' },
      { n: 85, a: '1B', b: '3:E,F,G,I,J' },
      { n: 86, a: '1J', b: '2H' },
      { n: 87, a: '1K', b: '3:D,E,I,J,L' },
      { n: 88, a: '2D', b: '2G' },
    ] },
    { round: 'r16', matches: [
      { n: 89, a: 'W74', b: 'W77' }, { n: 90, a: 'W73', b: 'W75' },
      { n: 91, a: 'W76', b: 'W78' }, { n: 92, a: 'W79', b: 'W80' },
      { n: 93, a: 'W83', b: 'W84' }, { n: 94, a: 'W81', b: 'W82' },
      { n: 95, a: 'W86', b: 'W88' }, { n: 96, a: 'W85', b: 'W87' },
    ] },
    { round: 'qf', matches: [
      { n: 97, a: 'W89', b: 'W90' }, { n: 98, a: 'W93', b: 'W94' },
      { n: 99, a: 'W91', b: 'W92' }, { n: 100, a: 'W95', b: 'W96' },
    ] },
    { round: 'sf', matches: [
      { n: 101, a: 'W97', b: 'W98' }, { n: 102, a: 'W99', b: 'W100' },
    ] },
    { round: 'third', matches: [{ n: 103, a: 'L101', b: 'L102' }] },
    { round: 'final', matches: [{ n: 104, a: 'W101', b: 'W102' }] },
  ];

  function buildKnockoutCtx() {
    const ctx = { standings: {}, groupComplete: {}, wl: {}, matchByNum: {} };
    DATA.model.groups.forEach((g) => {
      ctx.standings[g] = groupStandings(g);
      const fxs = DATA.model.fixtures.filter((fx) => (fx.group || '').trim() === g);
      ctx.groupComplete[g] = fxs.length > 0 && fxs.every((fx) => {
        const r = DATA.resultForFixture(fx);
        return r && (r.state === 'post' || r.completed);
      });
    });
    BRACKET.forEach((rd) => rd.matches.forEach((m) => { ctx.matchByNum[m.n] = m; }));
    return ctx;
  }

  // country_id for a slot, or null if not yet determined.
  function resolveSlot(code, ctx) {
    if (/^[12][A-L]$/.test(code)) {
      const g = code[1];
      if (!ctx.groupComplete[g]) return null;
      const rec = (ctx.standings[g] || [])[code[0] === '1' ? 0 : 1];
      return rec ? (rec.country.country_id || '').trim() : null;
    }
    if (code.charAt(0) === 'W') return resolveWL(+code.slice(1), ctx).winner;
    if (code.charAt(0) === 'L') return resolveWL(+code.slice(1), ctx).loser;
    return null; // best-third-place slot "3:..."
  }

  function resolveWL(n, ctx) {
    if (ctx.wl[n]) return ctx.wl[n];
    ctx.wl[n] = { winner: null, loser: null }; // memo + cycle guard
    const m = ctx.matchByNum[n];
    const out = { winner: null, loser: null };
    if (m) {
      const a = resolveSlot(m.a, ctx);
      const b = resolveSlot(m.b, ctx);
      if (a && b) {
        const r = DATA.resultForPair(a, b);
        if (r && (r.completed || r.state === 'post') && r.winner) {
          out.winner = r.winner;
          out.loser = r.winner === a ? b : a;
        }
      }
    }
    ctx.wl[n] = out;
    return out;
  }

  function slotLabel(code) {
    if (/^[12][A-L]$/.test(code)) return { main: code[1] + code[0] };          // 1A -> A1
    if (code.charAt(0) === '3') return { main: t('ko_third_slot'), sub: code.slice(2).split(',').join('/') };
    return { main: code };                                                      // W74 / L101
  }

  function moonPoster() {
    const slot = el('div', 'poster poster--empty poster--tbd');
    slot.innerHTML = '<div class="tbd"><img class="tbd-moon" src="./assets/moon.jpg" alt="" loading="lazy"></div>';
    return slot;
  }

  // One compact team row: mini poster (or moon) + flag + name, or a slot label.
  function bTeam(code, ctx, wl) {
    const id = resolveSlot(code, ctx);
    const mini = el('span', 'bmini');
    if (id) {
      const country = DATA.model.countriesById[id];
      const row = el('a', 'bteam' + (wl.winner === id ? ' is-winner' : ''));
      row.href = `#/country/${encodeURIComponent(id)}`;
      mini.appendChild(posterEl(DATA.filmsList(id)[0] || null));
      row.appendChild(mini);
      row.appendChild(el('span', 'bteam-main',
        `<span class="flag">${esc((country && country.flag) || '')}</span>` +
        `<span class="cname">${esc(countryName(country) || id)}</span>`));
      return row;
    }
    const lbl = slotLabel(code);
    const row = el('div', 'bteam');
    mini.appendChild(moonPoster());
    row.appendChild(mini);
    row.appendChild(el('span', 'bteam-main',
      `<span class="cname slot-code">${esc(lbl.main)}</span>` +
      (lbl.sub ? `<span class="slot-sub">${esc(lbl.sub)}</span>` : '')));
    return row;
  }

  function bMatch(m, ctx) {
    const card = el('div', 'bcard');
    card.appendChild(el('div', 'bcard-no', 'M' + m.n));
    const wl = resolveWL(m.n, ctx); // for winner highlight
    card.appendChild(bTeam(m.a, ctx, wl));
    card.appendChild(bTeam(m.b, ctx, wl));
    return card;
  }

  // Order matches per round so each pair's two feeders are adjacent (visual
  // bracket order), derived top-down from the final via the W##/L## references.
  function bracketColumns() {
    const byNum = {};
    BRACKET.forEach((rd) => rd.matches.forEach((m) => { byNum[m.n] = m; }));
    const feeders = (m) => [m.a, m.b]
      .map((c) => { const x = /^[WL](\d+)$/.exec(c); return x ? +x[1] : null; });

    const cols = [[104]]; // final
    let cur = [104];
    for (let i = 0; i < 4; i++) {
      const next = [];
      cur.forEach((n) => feeders(byNum[n]).forEach((f) => { if (f) next.push(f); }));
      if (!next.length) break;
      cols.unshift(next);
      cur = next;
    }
    return cols.map((nums) => nums.map((n) => byNum[n])); // [r32, r16, qf, sf, final]
  }

  function renderKnockout() {
    appEl.innerHTML = '';
    setActiveTab('knockout');
    const ctx = buildKnockoutCtx();
    const cols = bracketColumns();
    const keys = ['r32', 'r16', 'qf', 'sf', 'final'];

    const bracket = el('div', 'bracket');
    cols.forEach((matches, ci) => {
      const round = el('div', 'bround' +
        (ci === 0 ? ' is-first' : '') + (ci === cols.length - 1 ? ' is-last' : ''));
      round.appendChild(el('div', 'bround-title', esc(t('ko_' + keys[ci]))));
      const cells = el('div', 'bcells');
      matches.forEach((m) => {
        const cell = el('div', 'bcell');
        cell.appendChild(bMatch(m, ctx));
        cells.appendChild(cell);
      });
      round.appendChild(cells);
      bracket.appendChild(round);
    });
    appEl.appendChild(bracket);

    // third-place match sits off the main tree
    const third = (BRACKET.find((r) => r.round === 'third') || {}).matches[0];
    if (third) {
      const tp = el('div', 'third-place');
      tp.appendChild(el('h2', 'section-head', esc(t('ko_third'))));
      const cell = el('div', 'bcell');
      cell.appendChild(bMatch(third, ctx));
      tp.appendChild(cell);
      appEl.appendChild(tp);
    }
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
    if (lazyIO) lazyIO.disconnect(); // drop observations from the previous render
    applyStaticI18n();
    const hash = location.hash || '#/';
    const m = hash.match(/^#\/country\/(.+)$/);
    if (m) return renderCountry(m[1]);
    if (hash.startsWith('#/standings')) return renderStandings();
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
    // Reset scroll to top on route changes (only hashchange — not lang/view
    // switches or the score poll, which re-render in place).
    window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

    // Contact: smooth-scroll to the footer without touching the hash router.
    const contact = document.querySelector('.contact-nav');
    if (contact) contact.addEventListener('click', (e) => {
      e.preventDefault();
      const sec = document.getElementById('contact');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Close any open parlay info tooltip when clicking elsewhere. (The icon's
    // own handler stops propagation, so its toggles aren't undone here.)
    document.addEventListener('click', () => {
      document.querySelectorAll('.parlay-tip:not([hidden])').forEach((tip) => { tip.hidden = true; });
    });

    // Today's matches: jump to the pinned "today" section. That block only
    // exists on the group-stage page in date view, so route there first if
    // needed, then smooth-scroll to it (or to the top if nothing is on today).
    const today = document.querySelector('.today-nav');
    if (today) today.addEventListener('click', (e) => {
      e.preventDefault();
      const scrollToToday = () => {
        // is-focus = today if it still has unplayed matches, else the next day
        // that does; fall back to today's section, then the top.
        const sec = document.querySelector('.day-section.is-focus') ||
                    document.querySelector('.day-section.is-today');
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      if ((location.hash || '#/') !== '#/' || ui.view !== 'date') {
        ui.view = 'date';
        try { localStorage.setItem('wcc_view', 'date'); } catch (err) {}
        location.hash = '#/';
        render();              // re-render synchronously so the section exists
        setTimeout(scrollToToday, 0); // after the hashchange handler's scroll-to-top
      } else {
        scrollToToday();
      }
    });
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
