'use strict';
/*
 * 挑战: goals the user sets for themself — a lift's 1RM, body weight, a girth, a number of workouts, or anything
 * else counted by hand. state.goals = [{ id, type, key, name, unit, target, start, manual, deadline, created, doneAt }].
 * Progress runs from the value when the goal was made (start) to the target, in either direction.
 */

const GOAL_TYPES = [
  ['lift', '🏋️ 力量', '某个主项的 1RM 达到多少'],
  ['weight', '⚖️ 体重', '增重或减到多少公斤'],
  ['girth', '📏 围度', '臂围、腿围或腰围'],
  ['sessions', '📅 训练次数', '一段时间内练够多少次'],
  ['custom', '✍️ 自定义', '任何能数的目标，自己更新进度'],
];
let goalBack = 'challenge';
let goalDraft = null;

/** Best known 1RM of a lift: entered maxes, week-12 tests and estimates from "+" / heavy sets. */
function liftBest(lift) {
  const hist = trainingHistory(state);
  const rec = personalRecords(state, hist)[lift] || {};
  const tests = Object.values(state.tests || {}).map((t) => (t && t[lift]) || 0);
  return Math.max((state.lifts[lift] && state.lifts[lift].oneRM) || 0, rec.best ? rec.best.value : 0, ...tests);
}
function latestOf(obj, pick) {
  const k = Object.keys(obj || {}).filter((d) => pick(obj[d]) > 0).sort().pop();
  return k ? pick(obj[k]) : 0;
}
/** Workouts finished since a day (plan sessions in the app or marked, and free workouts). */
function sessionsSince(key) {
  let n = 0;
  Object.keys(state.logs).filter((k) => k >= key).forEach((k) => {
    const l = state.logs[k];
    n += doneList(l).length + (l && l.free && l.free.done ? 1 : 0);
  });
  return n;
}
function goalCurrent(g) {
  if (g.type === 'lift') return liftBest(g.key);
  if (g.type === 'weight') return latestOf(state.bodyweight, (v) => v) || state.profile.weight;
  if (g.type === 'girth') return latestOf(state.girth, (v) => v && v[g.key]);
  if (g.type === 'sessions') return sessionsSince(g.created);
  return g.manual || 0;
}
const GIRTH_NAME = { arm: '臂围', thigh: '腿围', waist: '腰围' };
function goalTitle(g) {
  if (g.type === 'lift') return `${LIFT_NAMES[g.key]} ${fmtW(g.target)}kg`;
  if (g.type === 'weight') return `体重 ${fmtW(g.target)}kg`;
  if (g.type === 'girth') return `${GIRTH_NAME[g.key]} ${fmtW(g.target)}cm`;
  if (g.type === 'sessions') return `练够 ${g.target} 次`;
  return g.name;
}
const goalUnit = (g) => (g.type === 'girth' ? 'cm' : g.type === 'sessions' ? '次' : g.type === 'custom' ? g.unit || '' : 'kg');
function goalProgress(g) {
  const cur = goalCurrent(g);
  const span = g.target - g.start;
  const frac = span ? (cur - g.start) / span : cur === g.target ? 1 : 0;
  return { cur, frac: Math.max(0, Math.min(1, frac)), reached: span >= 0 ? cur >= g.target : cur <= g.target };
}
/** Mark goals reached since last time (and say so once). */
function checkGoals() {
  let hit = null;
  (state.goals || []).forEach((g) => {
    if (g.doneAt) return;
    if (goalProgress(g).reached) { g.doneAt = dateKey(new Date()); hit = g; }
  });
  if (hit) { save(); toast(`🏆 挑战完成：${goalTitle(hit)}！`); }
}

function renderGoals() {
  checkGoals();
  const goals = state.goals || [];
  const today = dateKey(new Date());
  const card = (g) => {
    const { cur, frac } = goalProgress(g);
    const u = goalUnit(g);
    const left = g.deadline && !g.doneAt ? dayDiff(new Date(), parseKey(g.deadline)) : null;
    const late = left != null && left < 0;
    return `<div class="card goal${g.doneAt ? ' done' : late ? ' late' : ''}">
      <div class="row between"><b>${esc(goalTitle(g))}</b>${g.doneAt ? `<span class="tag">✓ ${fmtDate(parseKey(g.doneAt))}完成</span>` : left != null ? `<span class="muted small">${late ? `已过期 ${-left} 天` : left === 0 ? '今天截止' : `还剩 ${left} 天`}</span>` : ''}</div>
      ${g.type === 'custom' && g.note ? `<p class="muted small">${esc(g.note)}</p>` : ''}
      <div class="goal-bar"><i style="width:${(frac * 100).toFixed(1)}%"></i></div>
      <div class="row between small"><span>现在 <b>${fmtW(Math.round(cur * 10) / 10)}${u}</b>${g.type !== 'sessions' ? ` · 开始 ${fmtW(g.start)}${u}` : ''}</span><span class="muted">${Math.round(frac * 100)}%</span></div>
      <div class="row wrap goal-tools">${g.type === 'custom' && !g.doneAt ? `<button class="btn tiny" data-goal-step="${g.id}">＋1</button><button class="btn tiny ghost" data-goal-set="${g.id}">更新进度</button>` : ''}
        ${g.type === 'weight' && !g.doneAt ? '<button class="btn tiny ghost" data-goal-weigh>记体重</button>' : ''}${g.type === 'girth' && !g.doneAt ? '<button class="btn tiny ghost" data-goal-girth>记围度</button>' : ''}
        <button class="btn tiny ghost" data-goal-del="${g.id}">删除</button></div></div>`;
  };
  const open = goals.filter((g) => !g.doneAt), done = goals.filter((g) => g.doneAt);
  $('#view-goals').innerHTML = `<div class="sub-head"><button class="icon-round" data-goal-back aria-label="返回">${ICONS.back}</button><h1>我的挑战</h1></div>
    <p class="muted">给自己定个目标：卧推破 100kg、减到 70kg、这个月练 16 次……进度会根据你的训练、体重和围度记录自动更新。</p>
    <button class="btn block" data-goal-new>＋ 新挑战</button>
    ${open.map(card).join('') || '<div class="card center pad"><p>还没有进行中的挑战</p><p class="muted small">点上面「新挑战」开始</p></div>'}
    ${done.length ? `<h3>已完成 🏆</h3>${done.map(card).join('')}` : ''}
    <p class="muted small center">今天 ${fmtDate(parseKey(today))}</p>`;
}

function openGoalForm() {
  const d = goalDraft;
  const tp = d.type;
  let fields = '';
  if (tp === 'lift') {
    const cur = liftBest(d.key);
    fields = `<label>哪个主项</label><div class="chips">${LIFTS.map((l) => chip(LIFT_NAMES[l], `data-gkey="${l}"`, d.key === l)).join('')}</div>
      <label>目标 1RM (kg)</label><input id="gTarget" type="number" inputmode="decimal" step="0.5" value="${d.target || ''}" placeholder="${cur ? `现在约 ${fmtW(cur)}` : '例如 100'}">
      <p class="muted small">现在的 1RM 按你填写的最大重量、测试结果和带「+」组的估算取最高值${cur ? `：约 ${fmtW(cur)}kg` : ''}。</p>`;
  } else if (tp === 'weight') {
    fields = `<label>目标体重 (kg)</label><input id="gTarget" type="number" inputmode="decimal" step="0.1" value="${d.target || ''}" placeholder="现在 ${fmtW(goalCurrent({ type: 'weight' }))}kg">`;
  } else if (tp === 'girth') {
    fields = `<label>哪个围度</label><div class="chips">${Object.entries(GIRTH_NAME).map(([k, n]) => chip(n, `data-gkey="${k}"`, d.key === k)).join('')}</div>
      <label>目标 (cm)</label><input id="gTarget" type="number" inputmode="decimal" step="0.1" value="${d.target || ''}" placeholder="${goalCurrent({ type: 'girth', key: d.key }) ? `现在 ${goalCurrent({ type: 'girth', key: d.key })}cm` : '先在「我的 → 身体数据」记一次'}">`;
  } else if (tp === 'sessions') {
    fields = `<label>练够几次</label><input id="gTarget" type="number" inputmode="numeric" min="1" value="${d.target || ''}" placeholder="例如 16">
      <p class="muted small">从今天起，计划训练（包括标记 App 外完成的）和新建训练都算一次。</p>`;
  } else {
    fields = `<label>挑战名称</label><input id="gName" maxlength="24" value="${esc(d.name || '')}" placeholder="例如 引体向上做到 15 个">
      <div class="grid2"><div><label>从多少开始</label><input id="gStart" type="number" inputmode="decimal" value="${d.start ?? 0}"></div>
        <div><label>目标</label><input id="gTarget" type="number" inputmode="decimal" value="${d.target || ''}" placeholder="15"></div></div>
      <label>单位（可选）</label><input id="gUnit" maxlength="6" value="${esc(d.unit || '')}" placeholder="个 / 次 / 公里">
      <label>备注（可选）</label><input id="gNote" maxlength="60" value="${esc(d.note || '')}">`;
  }
  openSheet('新挑战', `<div class="chips">${GOAL_TYPES.map(([k, l]) => chip(l, `data-gtype="${k}"`, tp === k)).join('')}</div>
    <p class="muted small">${GOAL_TYPES.find(([k]) => k === tp)[2]}</p>
    ${fields}
    <label>截止日期（可选）</label><input id="gDeadline" type="date" value="${d.deadline || ''}" min="${dateKey(new Date())}">
    <button class="btn block" data-gsave>开始挑战</button>`, { type: 'goal', reopen: openGoalForm });
}
function readGoalForm() {
  const d = goalDraft;
  const num = (id) => ($(id) && $(id).value !== '' ? Number($(id).value) : undefined);
  d.target = num('#gTarget') ?? d.target;
  if ($('#gName')) { d.name = $('#gName').value.trim(); d.unit = $('#gUnit').value.trim(); d.note = $('#gNote').value.trim(); d.start = num('#gStart') ?? 0; }
  if ($('#gDeadline')) d.deadline = $('#gDeadline').value || '';
}
function saveGoal() {
  readGoalForm();
  const d = goalDraft;
  if (!(d.target > 0)) return toast('请填写目标');
  if (d.type === 'custom' && !d.name) return toast('请填写挑战名称');
  const g = { id: `g_${Date.now().toString(36)}`, type: d.type, key: d.key, target: d.target, deadline: d.deadline || undefined, created: dateKey(new Date()) };
  if (d.type === 'custom') Object.assign(g, { name: d.name, unit: d.unit, note: d.note, start: d.start || 0, manual: d.start || 0 });
  else if (d.type === 'sessions') g.start = 0;
  else g.start = goalCurrent(g);
  if (d.type === 'girth' && !g.start) return toast('先在「我的 → 身体数据」记一次现在的围度');
  if (d.type !== 'custom' && d.type !== 'sessions' && g.start === g.target) return toast('目标和现在一样，定个新的吧');
  state.goals = [...(state.goals || []), g];
  goalDraft = null;
  save(); closeSheet(); render();
  toast(`已开始挑战：${goalTitle(g)} 💪`);
}
function openGoals(from) {
  goalBack = from || currentView;
  currentView = 'goals';
  render(); window.scrollTo(0, 0);
}

function bindGoals() {
  $('#view-goals').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    const g = (state.goals || []).find((x) => x.id === (ds.goalStep || ds.goalSet || ds.goalDel));
    if (ds.goalBack !== undefined) { currentView = goalBack === 'goals' ? 'challenge' : goalBack; return render(); }
    if (ds.goalNew !== undefined) { goalDraft = { type: 'lift', key: 'bench' }; return openGoalForm(); }
    if (ds.goalWeigh !== undefined) return openWeightSheet();
    if (ds.goalGirth !== undefined) { currentView = 'me'; meSub = 'body'; return render(); }
    if (ds.goalStep && g) g.manual = (g.manual || 0) + 1;
    else if (ds.goalSet && g) {
      const v = prompt(`现在的进度（${g.unit || '数字'}）`, String(g.manual || 0));
      if (v === null || v === '' || isNaN(Number(v))) return;
      g.manual = Number(v);
    } else if (ds.goalDel && g) {
      if (!confirm(`删除挑战「${goalTitle(g)}」？`)) return;
      state.goals = state.goals.filter((x) => x !== g);
    } else return;
    save(); render();
  });
  $('#sheet').addEventListener('click', (e) => {
    if (!sheetCtx || sheetCtx.type !== 'goal') return;
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.gtype) { readGoalForm(); goalDraft = { type: b.dataset.gtype, key: { lift: 'bench', girth: 'arm' }[b.dataset.gtype], deadline: goalDraft.deadline }; return openGoalForm(); }
    if (b.dataset.gkey) { readGoalForm(); goalDraft.key = b.dataset.gkey; goalDraft.target = undefined; return openGoalForm(); }
    if (b.dataset.gsave !== undefined) saveGoal();
  });
}
