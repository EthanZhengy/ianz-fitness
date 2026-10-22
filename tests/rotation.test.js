// Run: node tests/rotation.test.js — 按循环安排: a weekly plan run as a rotation (in order, then rest days)
const assert = require('assert');
const E = require('../js/engine.js');

const st = {
  program: '531', rotation: { 531: 1 },
  lifts: { press: { variant: 'ohp', oneRM: 60 }, deadlift: { variant: 'conv_dl', oneRM: 180 }, bench: { variant: 'bb_bench', oneRM: 100 }, squat: { variant: 'bb_squat', oneRM: 140 } },
  mike: { bench1RM: 100, cg1RM: 90, variant: 'pause' }, plateInc: 2.5, tests: {}, startDate: '2026-10-21', schedule: [0, 1, 2, 3], programs: {}, accLog: {}, lastW: {},
  equipment: [], injuries: [], excluded: [], favorites: [], customEx: [], logs: {},
  profile: { sex: 'male', age: 25, height: 175, weight: 80, activity: 1.35, goal: 'maintain' }, trainTime: '18:30',
};
const d = (k) => E.parseKey(k);
const P = E.progOf(st);
assert.ok(P.flex && P.rotated && P.restAfter === 1 && P.period === 5 && P.weeks === 12);
assert.strictEqual(E.progOf({ ...st, rotation: {} }).flex, undefined, 'off → weekly as before');

// in order, whatever the weekday; a missed day waits
const order = E.orderFor(1, st);
assert.strictEqual(E.recommend(st, d('2026-10-21')).session, order[0]);
st.logs['2026-10-21'] = { done: true, session: order[0] };
assert.strictEqual(E.recommend(st, d('2026-10-23')).session, order[1], 'skipped the 22nd: still the 2nd session');
st.logs['2026-10-23'] = { done: true, session: order[1] };
st.logs['2026-10-24'] = { done: true, session: order[2] };
st.logs['2026-10-25'] = { done: true, session: order[3] };
assert.strictEqual(E.recommend(st, d('2026-10-26')).session, 'rest', 'one rest day after the week');
assert.strictEqual(E.position(st, d('2026-10-27')).week, 2);
assert.strictEqual(E.recommend(st, d('2026-10-27')).session, order[0]);

// rest days 0 → straight into week 2
const st0 = { ...st, rotation: { 531: 0 } };
assert.strictEqual(E.position(st0, d('2026-10-26')).week, 2);

// Mike: two sessions per rotation
const m = { ...st, program: 'mike', rotation: { mike: 2 }, logs: {} };
assert.deepStrictEqual([E.progOf(m).period, E.orderFor(1, m).length], [4, 2]);
console.log('rotation tests passed');
