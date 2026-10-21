// Run: node tests/accedit.test.js — 模板里改计划的辅助动作 (replace / sets & reps / remove / restore, from a day on)
const assert = require('assert');
const E = require('../js/engine.js');

const st = {
  program: 'ian',
  lifts: { press: { variant: 'ohp', oneRM: 60 }, deadlift: { variant: 'conv_dl', oneRM: 180 }, bench: { variant: 'bb_bench', oneRM: 100 }, squat: { variant: 'bb_squat', oneRM: 140 } },
  ppl: { bench1RM: 100, squat1RM: 140 }, plateInc: 2.5, tests: {}, startDate: '2026-10-19', schedule: [0, 1, 2, 3], programs: {}, accLog: {}, lastW: {}, ianPick: {},
  equipment: [], injuries: [], excluded: [], favorites: [], customEx: [], logs: {},
  profile: { sex: 'male', age: 25, height: 175, weight: 80, activity: 1.35, goal: 'maintain' }, trainTime: '18:30',
};
const day = E.parseKey('2026-10-21');
const before = E.parseKey('2026-10-20');
const keys = (s) => s.blocks.map((b) => `${b.key}:${b.ex ? b.ex.name : b.title}`);
const orig = E.buildSession(st, day, 'ianChest', {});
const mid = orig.blocks.find((b) => b.key === 'mid');

// replace 中胸 with 哑铃飞鸟 4 × 10-15 from the 21st; double progression keeps going on the new exercise
st.accEdit = { ianChest: { mid: [{ since: '2026-10-21', id: 'Dumbbell_Flyes', name: '哑铃飞鸟', img: 'Dumbbell_Flyes', cat: 'chest', kind: 'db', sets: 4, reps: '10-15' }] } };
let s = E.buildSession(st, day, 'ianChest', {});
let b = s.blocks.find((x) => x.key === 'mid');
assert.strictEqual(b.title, '中胸 · 哑铃飞鸟');
assert.strictEqual(b.ex.id, 'acc_Dumbbell_Flyes_10-15');
assert.deepStrictEqual([b.sets, b.rows.length, b.rows[0].reps, !!b.dp, !!b.ianSlot], [4, 4, 10, true, false]);
st.accLog['acc_Dumbbell_Flyes_10-15'] = { last: { date: '2026-10-21', w: 12, reps: [15, 15, 15, 15] } };
b = E.buildSession(st, E.parseKey('2026-10-25'), 'ianChest', {}).blocks.find((x) => x.key === 'mid');
assert.strictEqual(b.rows[0].w, 14, 'db step 2kg');
// earlier days keep the plan; raw ignores edits
assert.strictEqual(E.buildSession(st, before, 'ianChest', {}).blocks.find((x) => x.key === 'mid').ex.name, mid.ex.name);
assert.strictEqual(E.buildSession(st, day, 'ianChest', { raw: true }).blocks.find((x) => x.key === 'mid').ex.name, mid.ex.name);
// main lift untouched, order kept
assert.deepStrictEqual(s.blocks.map((x) => x.key), orig.blocks.map((x) => x.key));

// only sets: same exercise, 4 sets
st.accEdit.ianChest.tri = [{ since: '2026-10-21', sets: 4, reps: '10-15' }];
b = E.buildSession(st, day, 'ianChest', {}).blocks.find((x) => x.key === 'tri');
assert.deepStrictEqual([b.ex.name, b.sets, b.rows.length], [orig.blocks.find((x) => x.key === 'tri').ex.name, 4, 4]);

// remove, then restore later
st.accEdit.ianChest.lower = [{ since: '2026-10-21', hide: true }, { since: '2026-10-28', reset: true }];
assert.ok(!E.buildSession(st, day, 'ianChest', {}).blocks.some((x) => x.key === 'lower'));
assert.ok(E.buildSession(st, E.parseKey('2026-10-28'), 'ianChest', {}).blocks.some((x) => x.key === 'lower'));

// 推拉腿 (no weights planned): fixed sets/reps, last weight used
st.program = 'ppl';
st.accEdit.pplPush = { a0: [{ since: '2026-10-21', id: 'Cable_Crossover', name: '龙门架夹胸', kind: 'cable', sets: 3, reps: '12' }] };
const p0 = E.buildSession(st, day, 'pplPush', {}).blocks.find((x) => x.key === 'a0');
assert.deepStrictEqual([p0.title.endsWith('龙门架夹胸'), p0.ex.id, p0.reps, !!p0.rows], [true, 'Cable_Crossover', '12', false]);
assert.ok(!E.accEditable(E.buildSession(st, day, 'pplPush', {}).blocks.find((x) => x.type === 'main')));
console.log('accessory edit tests passed');
