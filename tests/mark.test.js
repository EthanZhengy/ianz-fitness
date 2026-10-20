// Run: node tests/mark.test.js — 标记完成 on any day, without touching that day's own workout
const assert = require('assert');
const E = require('../js/engine.js');
const S = require('../js/stats.js');

const st = {
  program: 'ian',
  lifts: { press: { variant: 'ohp', oneRM: 60 }, deadlift: { variant: 'conv_dl', oneRM: 180 }, bench: { variant: 'bb_bench', oneRM: 100 }, squat: { variant: 'bb_squat', oneRM: 140 } },
  plateInc: 2.5, tests: {}, startDate: '2026-10-12', schedule: [0, 1, 2, 3], programs: {}, accLog: {}, lastW: {}, ianPick: {},
  equipment: [], injuries: [], excluded: [], favorites: [], customEx: [], logs: {},
  profile: { sex: 'male', age: 25, height: 175, weight: 80, activity: 1.35, goal: 'maintain' }, trainTime: '18:30', autoShift: false,
};
const d = (k) => E.parseKey(k);
const today = d('2026-10-15');
// today: chest day in progress in the app
st.logs['2026-10-15'] = { session: 'ianChest', sets: { 'ianChest:main': [true, true] }, amrap: {}, sx: {}, extra: {}, swaps: {}, done: false };

// mark legs as done today: today's own workout is untouched
assert.ok(S.markOffline(st, 0, 'ianLegs', today, today));
const l = st.logs['2026-10-15'];
assert.strictEqual(l.session, 'ianChest');
assert.strictEqual(l.done, false);
assert.deepStrictEqual(l.sets['ianChest:main'], [true, true]);
assert.deepStrictEqual(l.off, ['ianLegs']);
assert.strictEqual(S.sessionStatus(st, 0, 'ianLegs', today).status, 'offline');
assert.notStrictEqual(E.recommend(st, today).session, 'ianLegs', 'legs no longer recommended');

// any earlier day of the week; marking again moves it
assert.ok(S.markOffline(st, 0, 'ianShoulder', today, d('2026-10-13')));
assert.ok(S.markOffline(st, 0, 'ianShoulder', today, d('2026-10-12')));
assert.ok(!st.logs['2026-10-13'].off, 'moved away from the 13th');
assert.strictEqual(E.dateKey(S.sessionStatus(st, 0, 'ianShoulder', today).date), '2026-10-12');
// future days are refused
assert.ok(!S.markOffline(st, 0, 'ianBack', today, d('2026-10-17')));

// finishing today's chest workout: both count, history has both
l.done = true;
const h = S.trainingHistory(st).filter((x) => x.key === '2026-10-15').map((x) => [x.session, x.offline]);
assert.deepStrictEqual(h, [['ianChest', false], ['ianLegs', true]]);
assert.deepStrictEqual(E.doneSessions(st, E.position(st, today)).sort(), ['ianChest', 'ianLegs', 'ianShoulder']);

// unmark
S.unmarkOffline(st, 0, 'ianLegs');
assert.ok(!l.off);
assert.strictEqual(l.session, 'ianChest');

// older marks (log.session + offline) still read and unmark
st.logs['2026-10-14'] = { session: 'ianBack', done: true, offline: true };
assert.strictEqual(S.sessionStatus(st, 0, 'ianBack', today).status, 'offline');
S.unmarkOffline(st, 0, 'ianBack');
assert.strictEqual(S.sessionStatus(st, 0, 'ianBack', today).status, 'upcoming');
console.log('mark tests passed');
