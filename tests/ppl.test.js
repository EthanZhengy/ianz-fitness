// Run: node tests/ppl.test.js — 三分化 5+1 计划（推·拉·腿，四天一循环）against the plan spreadsheet
const assert = require('assert');
const E = require('../js/engine.js');
const S = require('../js/stats.js');

const st = {
  program: 'ppl', ppl: { bench1RM: 100, squat1RM: 140 },
  lifts: { press: { variant: 'ohp', oneRM: 60 }, deadlift: { variant: 'conv_dl', oneRM: 150 }, bench: { variant: 'bb_bench', oneRM: 100 }, squat: { variant: 'bb_squat', oneRM: 140 } },
  plateInc: 2.5, tests: {}, startDate: '2026-10-18', schedule: [0, 1, 2], programs: {},
  equipment: [], injuries: [], excluded: [], favorites: [], customEx: [], logs: {},
  profile: { sex: 'male', age: 25, height: 175, weight: 80, activity: 1.35, goal: 'maintain' }, trainTime: '18:30',
};
const day = (cycle, d) => E.addDays(E.parseKey(st.startDate), (cycle - 1) * 4 + d);
const main = (s) => s.blocks.find((b) => b.type === 'main');

// four-day cycles: push / pull / legs / rest
assert.strictEqual(E.position(st, day(1, 3)).week, 1);
assert.strictEqual(E.position(st, day(2, 0)).week, 2);
assert.strictEqual(E.position(st, day(7, 0)).cycle, 1, 'cycle 7 starts round 2');
assert.deepStrictEqual([0, 1, 2].map((d) => E.recommend(st, day(1, d)).session), ['pplPush', 'pplPull', 'pplLegs']);

// main lifts per cycle: [sets, reps, %]
const plan = [[4, 6, 70], [4, 5, 75], [3, 5, 80], [3, 4, 85], [3, 3, 88], [2, 5, 60]];
plan.forEach(([sets, reps, pct], i) => {
  const push = main(E.buildSession(st, day(i + 1, 0), 'pplPush', {}));
  const legs = main(E.buildSession(st, day(i + 1, 2), 'pplLegs', {}));
  assert.strictEqual(push.rows.length, sets); assert.strictEqual(push.rows[0].reps, reps);
  assert.strictEqual(push.rows[0].w, E.roundTo(100 * pct / 100, 2.5));
  assert.strictEqual(legs.rows[0].w, E.roundTo(140 * pct / 100, 2.5));
});
// pull day: no main lift, five accessories at 3 × 8–12
const pull = E.buildSession(st, day(1, 1), 'pplPull', {});
assert.ok(!main(pull));
assert.deepStrictEqual(pull.blocks.map((b) => `${b.sets}x${b.reps}`), Array(5).fill('3x8-12'));
// deload cycle: accessories start 20% under the last weight used
const legs6 = E.buildSession(st, day(6, 2), 'pplLegs', {});
const legPress = legs6.blocks.find((b) => b.ex && b.ex.name === '腿举');
assert.ok(legPress.deload);
assert.strictEqual(S.blockRows({ ...st, lastW: { [legPress.ex.id]: { w: 200, r: 10 } } }, { sx: {} }, 'pplLegs', legPress)[0].w, 160);
// round 2: bench +2.5, squat +5
assert.strictEqual(main(E.buildSession(st, day(7, 0), 'pplPush', {})).rows[0].w, E.roundTo(102.5 * 0.7, 2.5));

console.log('all ppl tests passed');
