/* dev-posters.js — TEMPORARY local preview overrides.
 *
 * Lets you see real posters before the Sheet's `poster_url` column is filled.
 * Keyed by country_id -> { slot: poster_url }. Applied in data.js ONLY when a
 * film's poster_url is empty, so the Google Sheet always wins once you fill it.
 *
 * These are TMDB image URLs (w500). To make them permanent, paste the same URLs
 * into the `films` sheet `poster_url` column, then delete this file + its <script>
 * tag in index.html.
 *
 * Currently filled: the 6/12-related matchday-1 films (M01–M04).
 */
window.DEV_POSTERS = {
  // 北京时间 6/12 — M01 墨西哥 vs 南非, M02 韩国 vs 捷克
  MEX: { 1: 'https://image.tmdb.org/t/p/w500/dtIIyQyALk57ko5bjac7hi01YQ.jpg' }, // 罗马 Roma
  RSA: { 1: 'https://image.tmdb.org/t/p/w500/r3ebTJFcDZ35GaKcuUQQe243z4f.jpg' }, // 黑帮暴徒 Tsotsi
  KOR: { 1: 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg' }, // 寄生虫 Parasite
  CZE: { 1: 'https://image.tmdb.org/t/p/w500/oKiOhsSRWO6fRqxtvda8WuCiXBm.jpg' }, // 严密监视的列车 Closely Watched Trains

  // ET 6/12 (北京时间 6/13) — M03 加拿大 vs 波黑, M04 美国 vs 巴拉圭
  CAN: { 1: 'https://image.tmdb.org/t/p/w500/uPDP0cHGOpkr47rdCdHWo4CyiPj.jpg' }, // 妈咪 Mommy
  BIH: { 1: 'https://image.tmdb.org/t/p/w500/oTEmaYRKqWig5lhmwEQE0ZU3SRl.jpg' }, // 无主之地 No Man's Land
  USA: { 1: 'https://image.tmdb.org/t/p/w500/sav0jxhqiH0bPr2vZFU0Kjt2nZL.jpg' }, // 公民凯恩 Citizen Kane
  PAR: { 1: 'https://image.tmdb.org/t/p/w500/46XAmfqTmsfBLr0SAlQNjlVjbsb.jpg' }, // 巴拉圭吊床 Paraguayan Hammock
};
