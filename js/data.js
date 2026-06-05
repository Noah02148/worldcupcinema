/* data.js — runtime fetch + parse of the four gviz CSV tabs, then shape them
 * into lookup structures the renderer can use. No backend, no API key.
 */
(function () {
  'use strict';

  const FILE_ID = '1oMyg38c0hP450iMUUz5ctdXt1S0bs3sj53luddQd3vU';
  const csvUrl = (tab) =>
    `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

  // Parsed + shaped model, populated by load().
  const model = {
    countriesById: {},   // country_id -> country row
    countriesByGroup: {}, // group letter -> [country rows]
    filmsByCountry: {},  // country_id -> { slot(int) -> film row }
    fixtures: [],        // [{...row, instant}] sorted by kickoff
    fixturesByCountry: {}, // country_id -> [fixtures]
    groups: [],          // sorted group letters present in data
    loaded: false,
  };

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
    return model;
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

  window.DATA = { model, load, filmForMatch, filmsList };
})();
