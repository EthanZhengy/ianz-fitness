// Run: node tests/ppl.test.js — 三分化 5+1 计划（推·拉·腿，四天一循环）against the plan spreadsheet
const assert = require('assert');
const E = require('../js/engine.js');
const S = require('../js/stats.js');

const st = {
  program: 'ppl', ppl: { bench1RM: 100, squat1RM: 140 },
  lifts: { press: { variant: 'ohp', oneRM: 60 }, deadlift: { variant: 'conv_dl', oneRM: 150 }, bench: { variant: 'bb_bench', oneRM: 100 }, squat: { variant: 'bb_squat', oneRM: 140 } },
  autoShift: false, plateInc: 2.5, tests: {}, startDate: '2026-10-18', schedule: [0, 1, 2], programs: {},
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
// round 2: no automatic increase — the same 1RM until the user enters a new one
assert.strictEqual(main(E.buildSession(st, day(7, 0), 'pplPush', {})).rows[0].w, E.roundTo(100 * 0.7, 2.5));
assert.ok(E.manualMaxes(st));

// 自动顺延: missed days push the plan back; a cycle needs push, pull and legs, then one rest day
const sh = { ...st, autoShift: true, logs: {} };
const key = (n) => E.dateKey(day(1, n));
const train = (n, sid) => { sh.logs[key(n)] = { done: true, session: sid }; };
assert.strictEqual(E.recommend(sh, day(1, 0)).session, 'pplPush');
train(0, 'pplPush');
assert.strictEqual(E.recommend(sh, day(1, 1)).session, 'pplPull');
// skipped days 1 and 2: day 3 is still pull, still cycle 1
assert.strictEqual(E.recommend(sh, day(1, 3)).session, 'pplPull');
assert.strictEqual(E.position(sh, day(1, 3)).week, 1);
train(3, 'pplPull'); train(4, 'pplLegs');
assert.strictEqual(E.recommend(sh, day(1, 5)).session, 'rest', 'rest day after legs');
assert.strictEqual(E.position(sh, day(1, 6)).week, 2);
assert.strictEqual(E.recommend(sh, day(1, 6)).session, 'pplPush');
assert.strictEqual(main(E.buildSession(sh, day(1, 6), 'pplPush', {})).rows[0].w, 75, 'cycle 2 = 75%');
// training on the rest day starts the next cycle straight away
const sh2 = { ...sh, logs: {} };
['pplPush', 'pplPull', 'pplLegs', 'pplPush'].forEach((sid, n) => { sh2.logs[key(n)] = { done: true, session: sid }; });
assert.strictEqual(E.position(sh2, day(1, 3)).week, 2);
assert.strictEqual(E.recommend(sh2, day(1, 4)).session, 'pplPull');
// skip ahead (进入下一循环)
const sh3 = { ...sh, logs: { [key(0)]: { done: true, session: 'pplPush' } }, cycleBreaks: [key(1)] };
assert.strictEqual(E.position(sh3, day(1, 2)).week, 2);
assert.deepStrictEqual(E.cycleRange(sh3, 0), { start: day(1, 0), end: day(1, 1) });
// status of a missed session in a skipped cycle
assert.strictEqual(S.sessionStatus(sh3, 0, 'pplLegs', day(1, 5)).status, 'missed');

console.log('all ppl tests passed');
