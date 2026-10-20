'use strict';
/* ================= 挑战: the active training program, week by week ================= */

const BADGE = {
  app: '<span class="badge app">✓ App 完成</span>',
  offline: '<span class="badge offline">📝 App 外完成</span>',
  missed: '<span class="badge missed">未完成</span>',
  skipped: '<span class="badge skipped">已跳过</span>',
  upcoming: '',
};

/** "60×5 · 60×5 · 60×5" → "60×5 ×3组" */
function compactRows(rows) {
  const parts = [];
  rows.forEach((r) => {
    const t = `${fmtW(r.w)}×${r.reps}${r.plus ? '+' : ''}`;
    const last = parts[parts.length - 1];
    if (last && last.t === t) last.n++; else parts.push({ t, n: 1 });
  });
  return parts.map((p) => (p.n > 1 ? `${p.t} ×${p.n}组` : p.t)).join(' · ');
}

function weekPreviewHtml(st, weekAbs, compact, withStatus) {
  const week = (weekAbs % progOf(st).weeks) + 1;
  const { start } = cycleRange(st, weekAbs);
  const today = new Date();
  return orderFor(week, st).map((sid, i) => {
    const stat = withStatus ? sessionStatus(st, weekAbs, sid, today) : null;
    const date = stat ? stat.date : addDays(start, st.schedule[i] ?? i);
    const s = buildSession(st, date, sid, {});
    if (!s) return '';
    const lines = s.blocks.map((b) => {
      if (b.type === 'main') return `<div><b>${esc(b.title.replace(/^(核心)?主项 · /, ''))}</b> ${compactRows(b.rows.filter((r) => !r.label || !r.label.startsWith('热身')))}</div>`;
      if (compact) return '';
      return `<div class="muted">${esc(b.title)}${b.w ? ` ${fmtW(b.w)}kg` : ''} ${b.sets}×${esc(b.reps)}</div>`;
    }).join('');
    let action = '';
    if (stat && stat.status === 'offline') action = `<button class="btn tiny ghost" data-unmark="${sid}" data-week="${weekAbs}">取消标记</button>`;
    else if (stat && !['app', 'skipped'].includes(stat.status) && dayDiff(start, today) >= 0) action = `<button class="btn tiny ghost" data-mark="${sid}" data-week="${weekAbs}">标记 App 外完成</button>`;
    return `<div class="preview ${stat ? stat.status : ''}"><div class="row between"><span class="row"><span class="tag">${sessionName(sid, week)}</span>${stat ? BADGE[stat.status] : ''}</span><span class="muted">${periodOf(st) === 7 ? WEEKDAYS[weekdayIdx(date)] : `第 ${i + 1} 练`} ${fmtDate(date)}</span></div>${lines}${action ? `<div class="row" style="justify-content:flex-end">${action}</div>` : ''}</div>`;
  }).join('');
}

const shiftOptHtml = (rule) => `<label class="row check shift-opt"><input type="checkbox" data-autoshift ${autoShift() ? 'checked' : ''}>
  <span><b>自动顺延未完成的训练</b><span class="muted small">前一天没练也没关系，后面的安排会自动往后顺延一位；${rule}</span></span></label>`;
function programCardHtml(cycle) {
  if (isCustom()) {
    const def = progOf().def;
    const lifts = planLifts(def);
    return `<div class="card"><h2>${lifts.length ? `主项 1RM（第 ${cycle + 1} 轮）` : '计划内容'}</h2>
      ${lifts.map((l) => `<div class="kv"><span>${LIFT_NAMES[l]} 1RM</span><b>${fmtW(roundTo(cpMax(state, cycle, l), 0.5))}kg</b></div>`).join('')}
      ${def.days.map((d) => `<div class="kv"><span>${esc(d.name)}</span><b class="small">${d.ex.map((e) => esc(e.name)).join('、')}</b></div>`).join('')}
      <p class="muted">${def.desc ? `${esc(def.desc)} ` : ''}${lifts.length ? `按 1RM 百分比的动作每练完一轮上肢 +2.5kg、下肢 +5kg。` : ''}写着次数范围的辅助动作按双进阶：每组都做到上限，下次自动加重。</p>
      ${progOf().flex ? shiftOptHtml('所有训练日都练完才进入下一轮的下一周。') : ''}
      <div class="row wrap">${lifts.length ? '<button class="btn small ghost" data-act="edit-lifts">修改 1RM</button>' : ''}
        <button class="btn small ghost" data-act="plan-share">分享计划文件</button>
        ${autoShift() ? '' : `<button class="btn small ghost" data-act="postpone">整体顺延一周</button>
        <button class="btn small ghost" data-act="advance">往前调一周</button>`}</div></div>`;
  }
  if (isIan()) {
    const lifts = ['bench', 'squat', 'deadlift'];
    return `<div class="card"><h2>训练最大重量 TM（第 ${cycle + 1} 轮）</h2>
      <table class="tm"><tr><th></th><th>1–4周</th><th>5–8周</th><th>9–12周</th></tr>
      ${lifts.map((l) => `<tr><td>${variantOf(state, l).name.replace(/（.*）/, '')}</td>${[1, 5, 9].map((w) => `<td>${fmtW(roundTo(tmFor(state, cycle, w, l), 0.5))}</td>`).join('')}</tr>`).join('')}</table>
      <p class="muted">和 5/3/1 计划一样的 12 周：第 5、9 周卧推 +2.5kg、深蹲 / 硬拉 +5kg；第 4、8 周减载；第 12 周胸日测卧推、腿日测深蹲、背日测硬拉，下一轮按新 1RM × 90% 重新计算。胸 → 腿 → 肩 → 背四天练完算一「周」，主项后做 FSL 补量；辅助动作双进阶，每组都做到次数上限，下次自动加重。</p>
      ${shiftOptHtml('胸、腿、肩、背都练完才进入下一周。')}
      <div class="row wrap"><button class="btn small ghost" data-act="edit-lifts">修改 1RM / 主项动作</button>
        ${autoShift() ? '' : `<button class="btn small ghost" data-act="postpone">整体顺延一周</button>
        <button class="btn small ghost" data-act="advance">往前调一周</button>`}</div></div>`;
  }
  if (isPPL()) {
    return `<div class="card"><h2>主项 1RM（第 ${cycle + 1} 轮）</h2>
      <div class="kv"><span>杠铃卧推 1RM</span><b>${fmtW(roundTo(pplMax(state, cycle, 'bench'), 0.5))}kg</b></div>
      <div class="kv"><span>杠铃深蹲 1RM</span><b>${fmtW(roundTo(pplMax(state, cycle, 'squat'), 0.5))}kg</b></div>
      <table class="tm"><tr><th>循环</th><th>主项</th><th>卧推</th><th>深蹲</th></tr>
      ${PPL_CYCLES.map((c, i) => `<tr><td>${'一二三四五六'[i]}</td><td>${c.main[0]}×${c.main[1]} @${c.main[2]}%</td><td>${fmtW(roundTo(pplMax(state, cycle, 'bench') * c.main[2] / 100, state.plateInc || 2.5))}</td><td>${fmtW(roundTo(pplMax(state, cycle, 'squat') * c.main[2] / 100, state.plateInc || 2.5))}</td></tr>`).join('')}</table>
      <p class="muted">推 → 拉 → 腿 → 休，四天一循环。辅助动作 3 组 × 8–12 次（RPE 8），第六个循环减载。练完 6 个循环，下一轮卧推 +2.5kg、深蹲 +5kg。</p>
      ${shiftOptHtml('推、拉、腿都练完才进入下一个循环。')}
      <div class="row wrap"><button class="btn small ghost" data-act="edit-lifts">修改 1RM</button>
        ${autoShift() ? '' : `<button class="btn small ghost" data-act="postpone">这个循环没练完，整体顺延</button>
        <button class="btn small ghost" data-act="advance">往前调一个循环</button>`}</div></div>`;
  }
  if (isMike()) {
    const m = state.mike;
    const v = MIKE_VARIANTS[m.variant] || MIKE_VARIANTS.pause;
    return `<div class="card"><h2>卧推 1RM（第 ${cycle + 1} 轮）</h2>
      <div class="kv"><span>杠铃卧推 1RM</span><b>${fmtW(roundTo(mikeMax(state, cycle, 'bench'), 0.5))}kg</b></div>
      <div class="kv"><span>窄推 1RM</span><b>${fmtW(roundTo(mikeMax(state, cycle, 'cg'), 0.5))}kg</b></div>
      <div class="kv"><span>五选一辅助卧推（第 5 周起）</span><b>${esc(v.name)}</b></div>
      <p class="muted">所有重量都按 1RM 的百分比计算。第 16 周测出新极限后，下一轮自动按新 1RM 重新计算。</p>
      <div class="row wrap"><button class="btn small ghost" data-act="edit-lifts">修改 1RM / 辅助卧推</button>
        <button class="btn small ghost" data-act="postpone">本周没练完，整体顺延一周</button>
        <button class="btn small ghost" data-act="advance">往前调一周</button></div></div>`;
  }
  return `<div class="card"><h2>训练最大重量 TM（第 ${cycle + 1} 轮）</h2>
    <table class="tm"><tr><th></th><th>1–4周</th><th>5–8周</th><th>9–12周</th></tr>
    ${LIFTS.map((l) => `<tr><td>${variantOf(state, l).name.replace(/（.*）/, '')}</td>${[1, 5, 9].map((w) => `<td>${fmtW(roundTo(tmFor(state, cycle, w, l), 0.5))}</td>`).join('')}</tr>`).join('')}</table>
    <p class="muted">第 5、9 周上肢 +2.5kg，下肢 +5kg。第 12 周测完极限，下一轮按新 1RM × 90% 重新计算。</p>
    <div class="row wrap"><button class="btn small ghost" data-act="edit-lifts">修改最大重量 / 设置</button>
      <button class="btn small ghost" data-act="postpone">本周没练完，整体顺延一周</button>
      <button class="btn small ghost" data-act="advance">往前调一周</button></div></div>`;
}

function renderChallenge() {
  const today = new Date();
  const P = progOf();
  const pos = position(state, today);
  const cycle = pos ? pos.cycle : 0;
  const weeksDone = Array.from({ length: P.weeks }, (_, w) => cycle * P.weeks + w).filter((wa) => {
    const wk = (wa % P.weeks) + 1;
    return orderFor(wk).slice(0, requiredFor(wk)).every((sid) => ['app', 'offline', 'skipped'].includes(sessionStatus(state, wa, sid, today).status));
  }).length;
  const C = 2 * Math.PI * 42;
  let html = `<div class="page-head"><h1>挑战</h1><button class="pill-btn big" data-act="switch-program">切换计划</button></div>
    <button class="card mk-entry" data-act="market"><span class="mk-entry-ic">🏆</span><span class="grow"><b>大神方案</b><span class="muted small">看看别人怎么练，一键加入自己的训练模板</span></span><span class="muted">›</span></button>
    <div class="card challenge-hero">
      <div class="ring big r-main"><div class="ring-fig"><svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="42"/>
        <circle class="val" cx="50" cy="50" r="42" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - weeksDone / P.weeks)).toFixed(1)}" transform="rotate(-90 50 50)"/></svg>
        <div class="ring-txt"><b>${weeksDone}</b><small>/${P.weeks} ${unitOf()}</small></div></div></div>
      <div class="grow"><div class="muted">第 ${cycle + 1} 轮</div><h2>${esc(P.name)}</h2>
        <label class="week-pick">当前在 <select data-setweek>${Array.from({ length: P.weeks }, (_, i) => `<option value="${i + 1}" ${pos && pos.week === i + 1 ? 'selected' : ''}>第 ${i + 1} ${unitOf()} · ${esc(weekName(i + 1))}</option>`).join('')}</select></label>
        ${pos ? '' : `<div class="muted">${fmtDate(parseKey(state.startDate))} 开始</div>`}
        <div class="muted">${isCustom() ? `${progOf().def.days.map((d) => esc(d.name)).join(' · ')}${progOf().flex ? ' · 按顺序轮换' : ''}` : isIan() ? '胸 → 腿 → 肩 → 背 · 5/3/1 + 双进阶' : isPPL() ? '推 · 拉 · 腿 · 休 · 四天一循环' : isMike() ? '一周两推 · 按 1RM 百分比' : '一周四练 · 5/3/1 · TM = 90% 1RM'}</div></div></div>
    ${programCardHtml(cycle)}`;
  for (let w = 0; w < P.weeks; w++) {
    const weekAbs = cycle * P.weeks + w;
    const { start } = cycleRange(state, weekAbs);
    const isCur = pos && pos.weekAbs === weekAbs;
    const sts = orderFor(w + 1).slice(0, requiredFor(w + 1)).map((sid) => sessionStatus(state, weekAbs, sid, today).status);
    const nApp = sts.filter((x) => x === 'app').length, nOff = sts.filter((x) => x === 'offline').length;
    const past = pos && weekAbs <= pos.weekAbs;
    const summary = !past ? '' : sts.every((x) => x === 'skipped') ? BADGE.skipped : nApp + nOff >= sts.length ? `<span class="badge ${nApp ? 'app' : 'offline'}">${nOff && !nApp ? '📝' : '✓'} 已完成</span>`
      : `<span class="badge${isCur ? '' : ' missed'}">${nApp + nOff}/${sts.length}</span>`;
    html += `<details class="card week"${isCur ? ' open' : ''}><summary><b>第 ${w + 1} ${unitOf()}</b> ${esc(isPPL() ? weekName(w + 1).replace(/^循环. · /, '') : weekName(w + 1))} ${summary}
      <span class="muted">${fmtDate(start)}起${isCur ? ` · 本${unitOf()}` : ''}</span></summary>${weekPreviewHtml(state, weekAbs, false, true)}</details>`;
  }
  $('#view-challenge').innerHTML = html;
}

/** Pick another training program; setting it up goes through the questionnaire's plan steps. */
function openProgramPicker() {
  openSheet('选择训练计划', `<button class="card mk-entry" data-act="plan-import"><span class="mk-entry-ic">✨</span><span class="grow"><b>导入训练计划</b><span class="muted small">上传 Excel / PDF / Word / 图片，AI 自动生成计划；也能打开朋友分享的计划文件</span></span><span class="muted">›</span></button>
    ${Object.values(PROGRAMS).filter((p) => !p.hidden).map((p) => {
    const on = progOf().id === p.id;
    const saved = state.programs && state.programs[p.id];
    return `<button class="prog-card${on ? ' on' : ''}" data-program="${p.id}">
      <div class="row between"><b>${esc(p.name)}</b>${on ? '<span class="tag">当前</span>' : saved ? '<span class="tag">有进度</span>' : ''}</div>
      <div class="muted">${p.flex ? `${p.weeks} ${p.unit === '周' ? '周' : '轮'} · ${p.days} 个训练日按顺序轮换` : `${p.weeks} 周 · 一周 ${p.days} 练`}${p.custom ? ' · 导入的计划' : ''}</div><p>${esc(p.desc)}</p></button>
      ${p.custom ? `<div class="row wrap prog-tools"><button class="btn tiny ghost" data-plan-share="${p.id}">分享</button>${on ? '' : `<button class="btn tiny ghost" data-plan-del="${p.id}">删除</button>`}</div>` : ''}`;
  }).join('')}
    <p class="muted">切换后，之前计划的训练记录都会保留在「历史」里；切回来时可以接着之前的进度练。</p>`, { type: 'program' });
}

function bindChallenge() {
  $('#view-challenge').addEventListener('change', (e) => {
    if (e.target.dataset.setweek !== undefined) {
      const w = Number(e.target.value);
      const pos = position(state, new Date());
      if (pos && pos.week === w) return;
      if (!confirm(`把当前进度调到第 ${w} ${unitOf()}「${weekName(w)}」？\n\n从今天起按第 ${w} ${unitOf()}的重量和安排训练，已有的训练记录都保留。`)) { render(); return; }
      setCurrentWeek(state, w);
      save(); render(); syncPushSoon();
      return toast(`已调整到第 ${w} ${unitOf()}`);
    }
    if (e.target.dataset.autoshift === undefined) return;
    if (!e.target.checked) {
      // keep today's cycle when going back to the calendar: re-anchor the start date
      const pos = position(state, new Date());
      if (pos) state.startDate = dateKey(addDays(pos.weekStart, -pos.weekAbs * periodOf()));
    }
    state.autoShift = e.target.checked;
    save(); render();
    toast(e.target.checked ? '已开启：没练的训练会自动往后顺延' : '已关闭：按日历四天一循环');
  });
  $('#sheet').addEventListener('click', (e) => {
    if (!sheetCtx || sheetCtx.type !== 'program') return;
    const t = e.target.closest('button');
    if (t && t.dataset.act === 'plan-import') return openPlanImport();
    if (t && t.dataset.planShare) return sharePlanFile(t.dataset.planShare);
    if (t && t.dataset.planDel) {
      if (!confirm(`删除「${PROGRAMS[t.dataset.planDel].name}」？\n\n用这个计划练过的记录会保留在「历史」里。`)) return;
      state.customPrograms[t.dataset.planDel].hidden = true;
      save(); registerCustomPrograms(state); return openProgramPicker();
    }
    const b = e.target.closest('[data-program]');
    if (!b) return;
    closeSheet();
    if (b.dataset.program === progOf().id) return;
    startWizard(true, b.dataset.program, 'program');
  });
  $('#view-challenge').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && (b.dataset.mark || b.dataset.unmark)) {
      const w = Number(b.dataset.week);
      if (b.dataset.mark) return openMarkSession(w, b.dataset.mark);
      unmarkOffline(state, w, b.dataset.unmark);
      save(); render(); return;
    }
    const a = b?.dataset.act;
    if (a === 'edit-lifts') startWizard(true, null, 'lifts');
    else if (a === 'switch-program') openProgramPicker();
    else if (a === 'market') openMarket();
    else if (a === 'plan-share') sharePlanFile(progOf().id);
    else if (a === 'postpone' && confirm(`把整个计划往后推一${unitOf() === '周' ? '周' : '个循环'}？（重新按当前这一${unitOf()}的内容练）`)) { state.startDate = dateKey(addDays(parseKey(state.startDate), periodOf())); save(); render(); toast('已顺延'); }
    else if (a === 'advance' && confirm(`把计划往前调一${unitOf() === '周' ? '周' : '个循环'}？（相当于跳到下一${unitOf()}）`)) { state.startDate = dateKey(addDays(parseKey(state.startDate), -periodOf())); save(); render(); }
  });
}
