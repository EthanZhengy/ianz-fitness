// Run: node tests/nextweek.test.js — 进入下一周 once every session of the week is done
const assert = require('assert');
const E = require('../js/engine.js');

const base = () => ({
  lifts: { press: { variant: 'ohp', oneRM: 60 }, deadlift: { variant: 'conv_dl', oneRM: 180 }, bench: { variant: 'bb_bench', oneRM: 100 }, squat: { variant: 'bb_squat', oneRM: 140 } },
  ppl: { bench1RM: 100, squat1RM: 140 }, plateInc: 2.5, tests: {}, programs: {}, accLog: {}, lastW: {}, ianPick: {},
  equipment: [], injuries: [], excluded: [], favorites: [], customEx: [], logs: {},
  profile: { sex: 'male', age: 25, height: 175, weight: 80, activity: 1.35, goal: 'maintain' }, trainTime: '18:30',
});
const d = (k) => E.parseKey(k);
const done = (st, k, sid, off) => { st.logs[k] = off ? { off: [sid] } : { done: true, session: sid }; };

// 5/3/1 by calendar week (Mon 10-12 start): four sessions done Mon–Thu, Friday free → week 2 starts today
let st = { ...base(), program: '531', startDate: '2026-10-12', schedule: [0, 1, 3, 4] };
done(st, '2026-10-12', 'press'); done(st, '2026-10-13', 'deadlift'); done(st, '2026-10-14', 'bench', true); done(st, '2026-10-15', 'squat');
assert.ok(E.weekComplete(st, d('2026-10-16')));
let r = E.advanceWeek(st, d('2026-10-16'));
assert.strictEqual(E.dateKey(r.start), '2026-10-16');
assert.strictEqual(E.position(st, d('2026-10-16')).week, 2);
assert.strictEqual(E.position(st, d('2026-10-15')).week, 1);
assert.deepStrictEqual(E.doneSessions(st, E.position(st, d('2026-10-15'))).sort(), ['bench', 'deadlift', 'press', 'squat'], 'week 1 keeps its sessions');
assert.notStrictEqual(E.recommend(st, d('2026-10-16')).session, 'rest', 'something to train today');

// trained today → the next week starts tomorrow, today's workout stays in week 1
st = { ...base(), program: '531', startDate: '2026-10-12', schedule: [0, 1, 3, 4] };
['press', 'deadlift', 'bench', 'squat'].forEach((s, i) => done(st, E.dateKey(E.addDays(d('2026-10-12'), i)), s));
r = E.advanceWeek(st, d('2026-10-15'));
assert.strictEqual(E.dateKey(r.start), '2026-10-16');
assert.strictEqual(E.position(st, d('2026-10-15')).week, 1);
assert.strictEqual(E.position(st, d('2026-10-16')).week, 2);

// Ian (自动顺延, no rest day): finished today → tomorrow is week 2 anyway, nothing to do
st = { ...base(), program: 'ian', startDate: '2026-10-12', schedule: [0, 1, 2, 3] };
['ianChest', 'ianLegs', 'ianShoulder', 'ianBack'].forEach((s, i) => done(st, E.dateKey(E.addDays(d('2026-10-12'), i)), s));
assert.ok(E.weekComplete(st, d('2026-10-15')));
assert.strictEqual(E.advanceWeek(st, d('2026-10-15')), null);

// 推拉腿 (one rest day after the cycle): finished yesterday, today is the rest day → cycle 2 starts today
st = { ...base(), program: 'ppl', startDate: '2026-10-12', schedule: [0, 1, 2] };
['pplPush', 'pplPull', 'pplLegs'].forEach((s, i) => done(st, E.dateKey(E.addDays(d('2026-10-12'), i)), s));
assert.strictEqual(E.recommend(st, d('2026-10-15')).session, 'rest');
r = E.advanceWeek(st, d('2026-10-15'));
assert.strictEqual(E.dateKey(r.start), '2026-10-15');
assert.strictEqual(E.position(st, d('2026-10-15')).week, 2);
assert.strictEqual(E.recommend(st, d('2026-10-15')).session, 'pplPush');
assert.strictEqual(E.position(st, d('2026-10-14')).week, 1);

// last week of the plan → week 1 of the next round
st = { ...base(), program: 'ppl', startDate: '2026-10-12', schedule: [0, 1, 2], autoShift: false };
E.setCurrentWeek(st, 6, d('2026-10-12'));
['pplPush', 'pplPull', 'pplLegs'].forEach((s, i) => done(st, E.dateKey(E.addDays(d('2026-10-12'), i)), s));
r = E.advanceWeek(st, d('2026-10-15'));
const p = E.position(st, d('2026-10-15'));
assert.deepStrictEqual([p.cycle, p.week], [1, 1]);
console.log('next week tests passed');

// 调回第一轮: round 2 week 3 → round 1 week 3
{
  const s = { ...base(), program: 'ppl', startDate: '2026-09-20', schedule: [0, 1, 2], autoShift: false };
  const today = d('2026-10-20');
  const before = E.position(s, today);
  assert.strictEqual(before.cycle, 1, 'calendar 4-day cycles: in round 2');
  E.setCurrentWeek(s, before.week, today, 0);
  const after = E.position(s, today);
  assert.deepStrictEqual([after.cycle, after.week], [0, before.week]);
  // auto-shift too
  const s2 = { ...base(), program: 'ppl', startDate: '2026-10-01', schedule: [0, 1, 2] };
  E.setCurrentWeek(s2, 6, today, 0); E.setCurrentWeek(s2, 6, d('2026-10-21'));
  E.setCurrentWeek(s2, 2, d('2026-10-22'), 1);
  assert.deepStrictEqual([E.position(s2, d('2026-10-22')).cycle, E.position(s2, d('2026-10-22')).week], [1, 2]);
  E.setCurrentWeek(s2, 2, d('2026-10-22'), 0);
  assert.deepStrictEqual([E.position(s2, d('2026-10-22')).cycle, E.position(s2, d('2026-10-22')).week], [0, 2]);
}
console.log('round tests passed');
