/* data.js — load + parse the four data tabs, then shape them into lookup
 * structures the renderer can use. No backend, no API key.
 *
 * Data is BAKED into the repo (data/*.csv, data/results.json) by build_data.py
 * via a scheduled GitHub Action, and served from our own origin. This avoids a
 * runtime dependency on Google Sheets / TMDB, both blocked in mainland China.
 */
(function () {
  'use strict';

  const csvUrl = (tab) => `./data/${tab}.csv`;

  // Live scores: ESPN's unofficial FIFA World Cup scoreboard (no key, CORS *).
  // We try it live first (instant updates), then fall back to the baked
  // data/results.json snapshot when ESPN is unreachable (e.g. behind the GFW).
  const ESPN_URL =
    'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300';
  const RESULTS_LOCAL = './data/results.json';

  // Parsed + shaped model, populated by load().
  const model = {
    countriesById: {},   // country_id -> country row
    countriesByGroup: {}, // group letter -> [country rows]
    filmsByCountry: {},  // country_id -> { slot(int) -> film row }
    fixtures: [],        // [{...row, instant}] sorted by kickoff
    fixturesByCountry: {}, // country_id -> [fixtures]
    groups: [],          // sorted group letters present in data
    resultsByPair: {},   // "AAA|BBB" (sorted) -> { state, scores:{id:n}, detail }
    loaded: false,
  };

  // Order-independent key for the two teams in a match.
  const pairKey = (a, b) => [String(a).trim(), String(b).trim()].sort().join('|');

  function fetchCsv(tab) {
    return new Promise((resolve, reject) => {
      Papa.parse(csvUrl(tab), {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data),
        error: (err) => reject(err),
      });
    });
  }

  async function load() {
    const [countries, films, fixtures, strings] = await Promise.all([
      fetchCsv('countries'),
      fetchCsv('films'),
      fetchCsv('fixtures'),
      fetchCsv('strings'),
    ]);

    shapeCountries(countries);
    shapeFilms(films);
    shapeFixtures(fixtures);
    window.I18N.mergeStrings(strings);

    model.loaded = true;
    // Scores are best-effort: a failure here must not break the schedule.
    await fetchResults().catch((e) => console.warn('results fetch failed', e));
    return model;
  }

  function fetchJson(url, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { cache: 'no-store', signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .finally(() => clearTimeout(timer));
  }

  /** (Re)build resultsByPair from ESPN (live) or the baked snapshot. Returns true if changed. */
  async function fetchResults() {
    let data;
    try {
      data = await fetchJson(ESPN_URL, 5000);        // live, works outside China
    } catch (e) {
      data = await fetchJson(RESULTS_LOCAL, 8000);   // baked fallback (~15 min old)
    }
    const next = {};
    (data.events || []).forEach((e) => {
      const comp = (e.competitions && e.competitions[0]) || {};
      const cs = comp.competitors || [];
      if (cs.length < 2) return;
      const type = (e.status && e.status.type) || {};
      const scores = {};
      const shootout = {};
      let winner = null, hasPens = false;
      cs.forEach((c) => {
        const ab = c.team && c.team.abbreviation;
        if (!ab) return;
        scores[ab.trim()] = c.score;
        // shootoutScore is present on a penalty-decided knockout match
        if (c.shootoutScore != null && c.shootoutScore !== '') {
          shootout[ab.trim()] = c.shootoutScore; hasPens = true;
        }
        if (c.winner) winner = ab.trim();   // set by ESPN incl. on penalties
      });
      const ab0 = cs[0].team && cs[0].team.abbreviation;
      const ab1 = cs[1].team && cs[1].team.abbreviation;
      if (!ab0 || !ab1) return;
      next[pairKey(ab0, ab1)] = {
        state: type.state || 'pre',        // 'pre' | 'in' | 'post'
        completed: !!type.completed,
        detail: type.shortDetail || type.detail || '',
        scores,
        shootout: hasPens ? shootout : null,
        winner,
      };
    });
    const changed = JSON.stringify(next) !== JSON.stringify(model.resultsByPair);
    model.resultsByPair = next;
    return changed;
  }

  /**
   * Result for a fixture, oriented to its own home/away ids. Returns null when
   * the match isn't in the results feed yet.
   *   { state, completed, detail, home, away }  (home/away are score strings)
   */
  function resultForFixture(fx) {
    const h = (fx.home_id || '').trim();
    const a = (fx.away_id || '').trim();
    const r = model.resultsByPair[pairKey(h, a)];
    if (!r) return null;
    return {
      state: r.state,
      completed: r.completed,
      detail: r.detail,
      home: r.scores[h],
      away: r.scores[a],
      winner: r.winner,
      homePen: r.shootout ? r.shootout[h] : null,
      awayPen: r.shootout ? r.shootout[a] : null,
    };
  }

  function shapeCountries(rows) {
    rows.forEach((r) => {
      const id = (r.country_id || '').trim();
      if (!id) return;
      model.countriesById[id] = r;
      const g = (r.group || '').trim();
      if (!g) return;
      (model.countriesByGroup[g] = model.countriesByGroup[g] || []).push(r);
    });
    model.groups = Object.keys(model.countriesByGroup).sort();
  }

  function shapeFilms(rows) {
    rows.forEach((r) => {
      const id = (r.country_id || '').trim();
      const slot = parseInt((r.slot || '').trim(), 10);
      if (!id || !slot) return;
      // Temporary: fill empty poster_url from dev-posters.js so we can preview
      // before the Sheet's poster_url column is populated. Sheet always wins.
      if (!(r.poster_url || '').trim() && window.DEV_POSTERS) {
        const dev = window.DEV_POSTERS[id];
        if (dev && dev[slot]) r.poster_url = dev[slot];
      }
      (model.filmsByCountry[id] = model.filmsByCountry[id] || {})[slot] = r;
    });
  }

  function shapeFixtures(rows) {
    rows.forEach((r) => {
      const id = (r.match_id || '').trim();
      if (!id) return;
      r.matchdayNum = parseInt((r.matchday || '').trim(), 10) || 1;
      r.instant = window.I18N.fixtureInstant((r.date || '').trim(), r.kickoff_et);
      model.fixtures.push(r);

      [r.home_id, r.away_id].forEach((cid) => {
        cid = (cid || '').trim();
        if (!cid) return;
        (model.fixturesByCountry[cid] = model.fixturesByCountry[cid] || []).push(r);
      });
    });

    model.fixtures.sort((a, b) => a.instant - b.instant);
    Object.values(model.fixturesByCountry).forEach((list) =>
      list.sort((a, b) => a.matchdayNum - b.matchdayNum));
  }

  /**
   * The film representing `countryId` in a given matchday: its slot == matchday,
   * falling back to slot 1 (fallback countries only fill slot 1). Returns null
   * if even slot 1 is missing.
   */
  function filmForMatch(countryId, matchday) {
    const bySlot = model.filmsByCountry[countryId] || {};
    return bySlot[matchday] || bySlot[1] || null;
  }

  function filmsList(countryId) {
    const bySlot = model.filmsByCountry[countryId] || {};
    return Object.keys(bySlot)
      .map(Number)
      .sort((a, b) => a - b)
      .map((slot) => bySlot[slot]);
  }

  /** Result for an arbitrary team pair (used for knockout matches). */
  function resultForPair(a, b) {
    const r = model.resultsByPair[pairKey(a, b)];
    if (!r) return null;
    const at = (a || '').trim(), bt = (b || '').trim();
    return {
      state: r.state, completed: r.completed, detail: r.detail, winner: r.winner,
      home: r.scores[at], away: r.scores[bt],
      homePen: r.shootout ? r.shootout[at] : null,
      awayPen: r.shootout ? r.shootout[bt] : null,
    };
  }

  window.DATA = {
    model, load, filmForMatch, filmsList, fetchResults, resultForFixture, resultForPair,
  };
})();
