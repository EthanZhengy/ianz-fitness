// Run: node tests/week.test.js — 调整当前周 for calendar plans (5/3/1) and auto-shift plans (推拉腿, Ian)
const assert = require('assert');
const E = require('../js/engine.js');
const S = require('../js/stats.js');

const base = (program, extra = {}) => ({
  program, ppl: { bench1RM: 100, squat1RM: 140 },
  lifts: { press: { variant: 'ohp', oneRM: 60 }, deadlift: { variant: 'conv_dl', oneRM: 180 }, bench: { variant: 'bb_bench', oneRM: 100 }, squat: { variant: 'bb_squat', oneRM: 140 } },
  plateInc: 2.5, tests: {}, startDate: '2026-10-19', schedule: E.progOf({ program }).defaultSchedule.slice(), programs: {}, accLog: {}, lastW: {},
  equipment: [], injuries: [], excluded: [], favorites: [], customEx: [], logs: {}, ...extra,
});
const today = E.parseKey('2026-10-22');

// 5/3/1 (calendar weeks): jump to week 5, then back to week 2
const a = base('531');
assert.strictEqual(E.position(a, today).week, 1);
E.setCurrentWeek(a, 5, today);
assert.strictEqual(E.position(a, today).week, 5);
assert.strictEqual(E.position(a, today).weekStart.getTime(), E.parseKey('2026-10-19').getTime(), 'same Monday-based week');
assert.strictEqual(S.sessionStatus(a, 2, 'press', today).status, 'skipped', 'jumped-over weeks are 已跳过');
E.setCurrentWeek(a, 2, today);
assert.strictEqual(E.position(a, today).week, 2);

// 推拉腿 (auto-shift): push done, jump to cycle 4 today → today is cycle 4 push
const b = base('ppl', { logs: { '2026-10-19': { done: true, session: 'pplPush' } } });
assert.strictEqual(E.position(b, today).week, 1);
E.setCurrentWeek(b, 4, today);
assert.strictEqual(E.position(b, today).week, 4);
assert.strictEqual(E.recommend(b, today).session, 'pplPush');
assert.strictEqual(E.buildSession(b, today, 'pplPush', {}).blocks[0].rows[0].w, 85, 'cycle 4 = 85%');
assert.strictEqual(E.position(b, E.parseKey('2026-10-19')).week, 1, 'earlier days keep their week');
assert.strictEqual(S.sessionStatus(b, 1, 'pplPush', today).status, 'skipped');
// progress continues from the new week
b.logs['2026-10-22'] = { done: true, session: 'pplPush' }; b.logs['2026-10-23'] = { done: true, session: 'pplPull' }; b.logs['2026-10-24'] = { done: true, session: 'pplLegs' };
assert.strictEqual(E.position(b, E.parseKey('2026-10-26')).week, 5);
// and back to cycle 2
E.setCurrentWeek(b, 2, E.parseKey('2026-10-26'));
assert.strictEqual(E.position(b, E.parseKey('2026-10-26')).week, 2);

// Ian (auto-shift, 12 weeks): jump to week 9 → TM steps of week 9
const c = base('ian');
E.setCurrentWeek(c, 9, today);
assert.strictEqual(E.position(c, today).week, 9);
assert.strictEqual(E.buildSession(c, today, 'ianChest', {}).blocks[0].sub, 'TM 95kg');

console.log('all week tests passed');
