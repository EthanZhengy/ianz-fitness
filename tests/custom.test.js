// Run: node tests/custom.test.js — imported plans (AI / plan file): normalizing, registering, building sessions
const assert = require('assert');
const E = require('../js/engine.js');
const S = require('../js/stats.js');

const raw = {
  name: '测试四周计划', desc: '上下肢', weeks: 4, mode: 'weekly', restAfter: 0,
  weekInfo: [{ name: '积累', deload: false, note: '' }, { name: '加量', deload: false, note: '' }, { name: '冲击', deload: false, note: '' }, { name: '减载', deload: true, note: '' }],
  days: [
    { name: '上肢 A', focus: 'upper', note: '先热身', exercises: [
      { name: '杠铃卧推', img: 'Barbell_Bench_Press_-_Medium_Grip', cat: 'chest', lift: 'bench', load: 'pct', equip: 'bb', rest: 180, note: '',
        plan: [{ weeks: [], sets: [{ reps: 5, repsMax: 0, pct: 75, kg: 0, rpe: 0, amrap: false, warm: false }, { reps: 5, repsMax: 0, pct: 75, kg: 0, rpe: 0, amrap: true, warm: false }] },
          { weeks: [4], sets: [{ reps: 5, repsMax: 0, pct: 60, kg: 0, rpe: 0, amrap: false, warm: false }] }] },
      { name: '哑铃划船', img: '', cat: 'back', lift: '', load: 'double', equip: 'db', rest: 90, note: '',
        plan: [{ weeks: [], sets: [{ reps: 8, repsMax: 12, pct: 0, kg: 0, rpe: 8, amrap: false, warm: false }, { reps: 8, repsMax: 12, pct: 0, kg: 0, rpe: 8, amrap: false, warm: false }, { reps: 8, repsMax: 12, pct: 0, kg: 0, rpe: 8, amrap: false, warm: false }] }] },
      { name: '平板支撑', img: '../../x', cat: 'nope', lift: 'curl', load: 'pct', equip: 'bw', rest: 60, note: '',
        plan: [{ weeks: [1, 2, 99], sets: [{ reps: 1, repsMax: 0, pct: 0, kg: 0, rpe: 0, amrap: false, warm: false }] }] },
    ] },
    { name: '下肢 A', focus: 'lower', note: '', exercises: [
      { name: '杠铃深蹲', img: '', cat: 'leg', lift: 'squat', load: 'pct', equip: 'bb', rest: 180, note: '',
        plan: [{ weeks: [], sets: [{ reps: 5, repsMax: 0, pct: 40, kg: 0, rpe: 0, amrap: false, warm: true }, { reps: 3, repsMax: 0, pct: 85, kg: 0, rpe: 0, amrap: false, warm: false }] }] },
      { name: '腿举', img: '', cat: 'leg', lift: '', load: 'kg', equip: 'press', rest: 120, note: '',
        plan: [{ weeks: [], sets: [{ reps: 10, repsMax: 0, pct: 0, kg: 120, rpe: 0, amrap: false, warm: false }] }] },
    ] },
    { name: '空的', focus: 'full', note: '', exercises: [] },
  ],
  warnings: ['第 3 周没写重量，按第 2 周处理'],
};

// normalizing: bad values are dropped or clamped, empty days removed
const def = E.normalizePlanDef(raw, 'cp_test1');
assert.strictEqual(def.days.length, 2);
const plank = def.days[0].ex[2];
assert.strictEqual(plank.img, '', 'paths are not exercise ids');
assert.strictEqual(plank.cat, '');
assert.strictEqual(plank.lift, '');
assert.strictEqual(plank.load, 'free', 'pct without a lift → free');
assert.deepStrictEqual(plank.plan[0].weeks, [1, 2, 4], 'week 99 clamps into range');
assert.throws(() => E.normalizePlanDef({ days: [] }), /没有识别到/);

const st = {
  program: 'cp_test1', customPrograms: { cp_test1: def },
  lifts: { press: { variant: 'ohp', oneRM: 60 }, deadlift: { variant: 'conv_dl', oneRM: 180 }, bench: { variant: 'bb_bench', oneRM: 100 }, squat: { variant: 'bb_squat', oneRM: 140 } },
  plateInc: 2.5, tests: {}, startDate: '2026-10-19', schedule: [0, 3], programs: {}, accLog: {}, lastW: {},
  equipment: [], injuries: [], excluded: [], favorites: [], customEx: [], logs: {},
  profile: { sex: 'male', age: 25, height: 175, weight: 80, activity: 1.35, goal: 'maintain' }, trainTime: '18:30',
};
E.registerCustomPrograms(st);
const day = (n) => E.addDays(E.parseKey(st.startDate), n);
assert.strictEqual(E.progOf(st).id, 'cp_test1');
assert.deepStrictEqual(E.orderFor(1, st), ['cp_test1_d0', 'cp_test1_d1']);
assert.strictEqual(E.programOfSession('cp_test1_d1'), 'cp_test1');
assert.strictEqual(E.weekName(4, st), '减载');
assert.deepStrictEqual(E.planLifts(def), ['bench', 'squat']);

// weekly plan: Monday + Thursday
assert.strictEqual(E.recommend(st, day(0)).session, 'cp_test1_d0');
st.logs[E.dateKey(day(0))] = { done: true, session: 'cp_test1_d0' };
assert.strictEqual(E.recommend(st, day(1)).session, 'rest');
assert.strictEqual(E.recommend(st, day(3)).session, 'cp_test1_d1');
st.logs = {};
const s1 = E.buildSession(st, day(0), 'cp_test1_d0', {});
const bench = s1.blocks.find((b) => b.key === 'e0');
assert.strictEqual(bench.type, 'main');
assert.deepStrictEqual(bench.rows.map((r) => [r.w, r.reps, r.plus]), [[75, 5, false], [75, 5, true]]);
const row = s1.blocks.find((b) => b.key === 'e1');
assert.ok(row.dp && row.reps === '8-12' && row.rows.length === 3, 'double progression block');
assert.strictEqual(s1.blocks.find((b) => b.key === 'e2').rows[0].w, null);

// week 4: the deload entry replaces the default; the plank (weeks 1, 2, 4) is still there
const s4 = E.buildSession(st, day(21), 'cp_test1_d0', {});
assert.deepStrictEqual(s4.blocks.find((b) => b.key === 'e0').rows.map((r) => r.w), [60]);
assert.ok(s4.blocks.some((b) => b.key === 'e2'));
assert.ok(!E.buildSession(st, day(14), 'cp_test1_d0', {}).blocks.some((b) => b.key === 'e2'), 'plank not in week 3');

// lower day: warm-up set, fixed weight
const s2 = E.buildSession(st, day(3), 'cp_test1_d1', {});
assert.deepStrictEqual(s2.blocks[0].rows.map((r) => [r.w, r.label]), [[55, '热身'], [120, undefined]]);
assert.strictEqual(s2.blocks[1].rows[0].w, 120);
assert.strictEqual(s2.kind, 'lower');

// double progression: every set at the top of the range → heavier next time
st.accLog[row.ex.id] = { last: { date: '2026-10-19', w: 30, reps: [12, 12, 12] } };
const next = E.buildSession(st, day(7), 'cp_test1_d0', {}).blocks.find((b) => b.key === 'e1');
assert.deepStrictEqual(next.rows.map((r) => [r.w, r.reps]), [[32, 8], [32, 8], [32, 8]]);

// next round: the same 1RM (the user updates it)
assert.strictEqual(E.cpMax(st, 1, 'bench'), 100);
assert.strictEqual(E.cpMax(st, 1, 'squat'), 140);

// rotation plan: in order, 自动顺延
const rot = E.normalizePlanDef({ ...raw, mode: 'rotation', restAfter: 1 }, 'cp_rot');
const st2 = { ...st, program: 'cp_rot', customPrograms: { cp_test1: def, cp_rot: rot }, logs: {}, accLog: {} };
E.registerCustomPrograms(st2);
assert.strictEqual(E.periodOf(st2), 3);
assert.strictEqual(E.recommend(st2, day(0)).session, 'cp_rot_d0');
st2.logs[E.dateKey(day(0))] = { done: true, session: 'cp_rot_d0' };
assert.strictEqual(E.recommend(st2, day(2)).session, 'cp_rot_d1', 'a missed day shifts the plan');

// history: summary counts the session; e1RM from the heaviest main-lift set
const log = { done: true, session: 'cp_test1_d0', sets: { 'cp_test1_d0:e0': [true, true] } };
const sum = S.summarizeSession(st, day(0), 'cp_test1_d0', log);
assert.strictEqual(sum.lift, 'bench');
assert.ok(sum.e1rm && sum.e1rm.value > 75);
assert.ok(S.tmSeries(st, 'bench', day(0)).length > 0);

// unregistering: removed plans disappear from PROGRAMS
E.registerCustomPrograms({ customPrograms: {} });
assert.ok(!E.isCustomProg('531') && !require('../js/data.js').PROGRAMS.cp_test1);
console.log('custom plan tests passed');
