// Run: node tests/ian.test.js — Ian 力量举训练: 5/3/1 main lifts in a chest → legs → shoulders → back rotation + double progression
const assert = require('assert');
const E = require('../js/engine.js');

const st = {
  program: 'ian',
  lifts: { press: { variant: 'ohp', oneRM: 60 }, deadlift: { variant: 'conv_dl', oneRM: 180 }, bench: { variant: 'bb_bench', oneRM: 100 }, squat: { variant: 'bb_squat', oneRM: 140 } },
  plateInc: 2.5, tests: {}, startDate: '2026-10-19', schedule: [0, 1, 2, 3], programs: {}, accLog: {}, lastW: {}, ianPick: {},
  equipment: [], injuries: [], excluded: [], favorites: [], customEx: [], logs: {},
  profile: { sex: 'male', age: 25, height: 175, weight: 80, activity: 1.35, goal: 'maintain' }, trainTime: '18:30',
};
const day = (n) => E.addDays(E.parseKey(st.startDate), n);
const key = (n) => E.dateKey(day(n));
const main = (s) => s.blocks.find((b) => b.type === 'main');
const blk = (s, k) => s.blocks.find((b) => b.key === k);

// rotation follows completion: chest → legs → shoulders → back, no fixed rest day
assert.strictEqual(E.recommend(st, day(0)).session, 'ianChest');
st.logs[key(0)] = { done: true, session: 'ianChest' };
assert.strictEqual(E.recommend(st, day(1)).session, 'ianLegs');
assert.strictEqual(E.recommend(st, day(3)).session, 'ianLegs', 'missed days shift the plan');
['ianLegs', 'ianShoulder', 'ianBack'].forEach((sid, i) => { st.logs[key(3 + i)] = { done: true, session: sid }; });
assert.strictEqual(E.position(st, day(6)).week, 2, 'four days done → 5/3/1 week 2');
assert.strictEqual(E.recommend(st, day(6)).session, 'ianChest');

// 12-week 5/3/1 (same table as the 5/3/1 plan): week 1 70/80/90 ×3 (+) and a 100% single, then FSL at the first-set weight
const w1 = main(E.buildSession({ ...st, logs: {} }, day(0), 'ianChest', {}));
assert.deepStrictEqual(w1.rows.map((r) => [r.w, r.reps, !!r.plus, r.label || (r.extra ? 'single' : '')]),
  [[62.5, 3, false, ''], [72.5, 3, false, ''], [80, 3, true, ''], [90, 1, false, 'single'],
    [62.5, 5, false, 'FSL'], [62.5, 5, false, 'FSL'], [62.5, 5, false, 'FSL'], [62.5, 5, false, 'FSL'], [62.5, 5, false, 'FSL']]);
const w2 = main(E.buildSession(st, day(6), 'ianChest', {}));
assert.deepStrictEqual(w2.rows.slice(0, 3).map((r) => r.w), [57.5, 67.5, 77.5], 'week 2: 65/75/85 ×5');
assert.ok(!main(E.buildSession(st, day(5), 'ianShoulder', {})), 'no overhead press on shoulder day');
assert.strictEqual(E.progOf(st).weeks, 12);
// TM steps up at weeks 5 and 9 like the 5/3/1 plan; week 12 = max tests
assert.strictEqual(E.ianTM(st, 0, 'bench', 5), 92.5);
assert.strictEqual(E.ianTM(st, 0, 'deadlift', 9), 172);
const cal = { ...st, logs: {}, autoShift: false };
const wk = (w, sid) => E.buildSession(cal, E.addDays(E.parseKey(st.startDate), (w - 1) * 5), sid, {});
assert.ok(wk(12, 'ianChest').test); assert.strictEqual(main(wk(12, 'ianBack')).lift, 'deadlift');
assert.ok(blk(wk(12, 'ianShoulder'), 'rear').deload, 'shoulder day stays light in test week');
assert.ok(main(wk(4, 'ianLegs')).rows.every((r) => !r.label), 'no FSL in the deload week');

// double progression on face pulls (12–15): all sets at 15 → +2.5kg back to 12 reps
const fp = (rec) => {
  const s = E.buildSession({ ...st, accLog: { 'ian_Face_Pull_cable_12-15': { last: rec } } }, day(6), 'ianShoulder', {});
  return blk(s, 'rear');
};
let b = fp({ date: key(5), w: 20, reps: [15, 15, 15] });
assert.deepStrictEqual(b.rows.map((r) => [r.w, r.reps]), [[22.5, 12], [22.5, 12], [22.5, 12]]);
// not there yet → same weight, +1 rep per set
b = fp({ date: key(5), w: 20, reps: [15, 13, 12] });
assert.deepStrictEqual(b.rows.map((r) => [r.w, r.reps]), [[20, 15], [20, 14], [20, 13]]);
// far below the range → 10% lighter
b = fp({ date: key(5), w: 30, reps: [9, 8, 7] });
assert.deepStrictEqual(b.rows.map((r) => r.w), [27.5, 27.5, 27.5]);
// a record from the same day is ignored (planning uses the previous session)
b = fp({ date: key(6), w: 20, reps: [15, 15, 15] });
assert.strictEqual(b.rows[0].w, null);
// dumbbell steps are 2kg; machine 5kg
const lat = E.buildSession({ ...st, accLog: { 'ian_Side_Lateral_Raise_db_12-15': { last: { date: key(5), w: 10, reps: [15, 15, 15] } } } }, day(6), 'ianShoulder', {});
assert.strictEqual(blk(lat, 'side1').rows[0].w, 12);
// deload week (week 4): one set less, 20% lighter
const late = { ...st, logs: {}, autoShift: false, accLog: { 'ian_Face_Pull_cable_12-15': { last: { date: '2026-01-01', w: 20, reps: [15, 15, 15] } } } };
const dl = blk(E.buildSession(late, E.addDays(E.parseKey(st.startDate), 3 * 5), 'ianShoulder', {}), 'rear'); // week 4 = deload
assert.ok(dl.deload); assert.strictEqual(dl.rows.length, 2); assert.strictEqual(dl.rows[0].w, 17.5);
// leg-day arm slot alternates biceps / triceps by week
assert.strictEqual(blk(E.buildSession({ ...st, logs: {} }, day(0), 'ianLegs', {}), 'arm').cat, 'bi');
assert.strictEqual(blk(E.buildSession(st, day(7), 'ianLegs', {}), 'arm').cat, 'tri');
// a remembered swap
assert.strictEqual(blk(E.buildSession({ ...st, ianPick: { 'ianShoulder:rear': '反向蝴蝶机飞鸟' } }, day(6), 'ianShoulder', {}), 'rear').ex.name, '反向蝴蝶机飞鸟');

console.log('all ian tests passed');
