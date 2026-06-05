/* i18n.js — default UI strings + language/timezone helpers.
 *
 * The `strings` sheet tab is authoritative when filled; these defaults are the
 * fallback so the site is fully usable while that tab is still empty.
 * Language also decides the timezone (see spec §4):
 *   zh -> Beijing (Asia/Shanghai), en -> US East (America/New_York).
 */
(function () {
  'use strict';

  // key -> { zh, en }. Merged over by the `strings` sheet tab at runtime.
  const DEFAULT_STRINGS = {
    site_title:      { zh: '世界杯影院',   en: 'World Cup Cinema' },
    tab_group_stage: { zh: '小组赛',       en: 'Group Stage' },
    tab_knockout:    { zh: '淘汰赛',       en: 'Knockout' },
    view_by_date:    { zh: '按日期',       en: 'By date' },
    view_by_group:   { zh: '按小组',       en: 'By group' },
    vs:              { zh: 'VS',           en: 'VS' },
    group_label:     { zh: '组',           en: 'Group' },
    matchday_label:  { zh: '第 {n} 轮',    en: 'Matchday {n}' },
    knockout_tbd:    { zh: '赛程待定',     en: 'Bracket TBD' },
    knockout_hint:   { zh: '淘汰赛对阵取决于小组赛结果,稍后开放。', en: 'Knockout matchups depend on group results — coming soon.' },
    hover_hint:      { zh: '悬停查看片名', en: 'Hover to reveal title' },
    films_heading:   { zh: '代表电影',     en: 'Featured films' },
    fixtures_heading:{ zh: '小组赛对阵',   en: 'Group fixtures' },
    back:            { zh: '← 返回赛程',   en: '← Back to schedule' },
    loading:         { zh: '加载中…',       en: 'Loading…' },
    load_error:      { zh: '数据加载失败,请稍后重试。', en: 'Failed to load data. Please try again later.' },
    footer_note:     { zh: '临时项目 · 世界杯结束即下线', en: 'A temporary project — offline after the World Cup' },
    director_label:  { zh: '导演',         en: 'Director' },
    letterboxd:      { zh: 'Letterboxd',   en: 'Letterboxd' },
    tz_note:         { zh: '北京时间',     en: 'ET' },
    no_film:         { zh: '电影待定',     en: 'Film TBD' },
    not_found:       { zh: '未找到该国家', en: 'Country not found' },
  };

  const TZ = { zh: 'Asia/Shanghai', en: 'America/New_York' };
  const LOCALE = { zh: 'zh-CN', en: 'en-US' };

  const state = { lang: 'zh', strings: DEFAULT_STRINGS };

  function setLang(lang) {
    state.lang = lang === 'en' ? 'en' : 'zh';
  }
  function getLang() {
    return state.lang;
  }

  /** Merge sheet-provided strings over the defaults (sheet wins). */
  function mergeStrings(rows) {
    const merged = {};
    for (const k in DEFAULT_STRINGS) merged[k] = Object.assign({}, DEFAULT_STRINGS[k]);
    (rows || []).forEach((r) => {
      const key = (r.key || '').trim();
      if (!key) return;
      merged[key] = {
        zh: (r.zh != null && r.zh !== '') ? r.zh : (merged[key] ? merged[key].zh : ''),
        en: (r.en != null && r.en !== '') ? r.en : (merged[key] ? merged[key].en : ''),
      };
    });
    state.strings = merged;
  }

  /** Look up a UI string in the current language, with {n}-style interpolation. */
  function t(key, vars) {
    const entry = state.strings[key];
    let s = entry ? (entry[state.lang] || entry.zh || key) : key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return s;
  }

  /** Build the absolute instant for a fixture. kickoff_et is ET == UTC-4 (EDT). */
  function fixtureInstant(date, kickoffEt) {
    const time = normalizeTime(kickoffEt);
    // Treat date + time as a wall-clock time in UTC-4 (EDT, fixed all tournament).
    return new Date(`${date}T${time}:00-04:00`);
  }

  function normalizeTime(s) {
    const m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return '00:00';
    return String(m[1]).padStart(2, '0') + ':' + m[2];
  }

  function tz() { return TZ[state.lang]; }
  function locale() { return LOCALE[state.lang]; }

  /** "18:00" in the current language's timezone. */
  function formatTime(instant) {
    return new Intl.DateTimeFormat(locale(), {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz(),
    }).format(instant);
  }

  /** Full date label for section headers, e.g. "6月11日 周四" / "Thu, Jun 11". */
  function formatDateFull(instant) {
    return new Intl.DateTimeFormat(locale(), {
      month: 'short', day: 'numeric', weekday: 'short', timeZone: tz(),
    }).format(instant);
  }

  /** YYYY-MM-DD bucket key in the current timezone (so Beijing cross-midnight regroups). */
  function dateKey(instant) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz(),
    }).formatToParts(instant);
    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  window.I18N = {
    setLang, getLang, mergeStrings, t,
    fixtureInstant, formatTime, formatDateFull, dateKey, tz, locale,
  };
})();
