/* predictions.js — Claude Fable 5's daily parlay picks (过关方案).
 *
 * Maps a fixture's match_id -> the predicted winning country_id. One pick per
 * match. Use the literal 'DRAW' for a draw pick. Hand-maintained per matchday;
 * by design the UI shows only the pick, never the reasoning.
 */
window.PREDICTIONS = {
  // 2026-06-11 · 首日
  M01: 'MEX', // 墨西哥 vs 南非  -> 墨西哥胜
  M02: 'KOR', // 韩国 vs 捷克    -> 韩国胜
};
