'use strict';
/*
 * 导入训练计划: someone's plan as Excel / CSV / Word / PDF / photos / pasted text → the plan-import Edge Function
 * (Claude) → a plan in the app's own format (normalizePlanDef), saved in state.customPrograms and set up through the
 * questionnaire like the built-in plans. A plan can be shared on as a .json file and imported again without AI.
 */

let pim = null; // { files: [{ name, kind, media, data, size }], text, busy, plan, err }

/* ---------- reading files in the browser ---------- */
/** Minimal zip reader for .xlsx / .docx (both are zip archives of XML). */
async function unzipEntries(buf) {
  const dv = new DataView(buf);
  let e = buf.byteLength - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('文件已损坏或不是 Office 文件');
  const files = {};
  let p = dv.getUint32(e + 16, true);
  for (let i = 0, n = dv.getUint16(e + 10, true); i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
    const nl = dv.getUint16(p + 28, true);
    const name = new TextDecoder().decode(new Uint8Array(buf, p + 46, nl));
    files[name] = { method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) };
    p += 46 + nl + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  return async (name) => {
    const f = files[name];
    if (!f) return null;
    const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
    const data = new Uint8Array(buf, start, f.size);
    if (f.method === 0) return new TextDecoder().decode(data);
    return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  };
}
const xmlDoc = (s) => new DOMParser().parseFromString(s || '<x/>', 'application/xml');
const colIdx = (ref) => [...String(ref).replace(/\d+/g, '')].reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
/** Every sheet as tab-separated rows. */
async function xlsxText(buf) {
  const read = await unzipEntries(buf);
  const shared = [...xmlDoc(await read('xl/sharedStrings.xml')).getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join(''));
  const rels = {};
  [...xmlDoc(await read('xl/_rels/workbook.xml.rels')).getElementsByTagName('Relationship')].forEach((r) => (rels[r.getAttribute('Id')] = r.getAttribute('Target')));
  const out = [];
  for (const sh of xmlDoc(await read('xl/workbook.xml')).getElementsByTagName('sheet')) {
    const target = rels[sh.getAttribute('r:id')] || '';
    const xml = await read(target.startsWith('/') ? target.slice(1) : `xl/${target}`);
    if (!xml) continue;
    const lines = [...xmlDoc(xml).getElementsByTagName('row')].map((row) => {
      const cells = [];
      [...row.getElementsByTagName('c')].forEach((c) => {
        const t = c.getAttribute('t');
        const v = c.getElementsByTagName('v')[0];
        const val = t === 's' ? shared[Number(v && v.textContent)] : t === 'inlineStr' ? [...c.getElementsByTagName('t')].map((x) => x.textContent).join('') : v ? v.textContent : '';
        cells[colIdx(c.getAttribute('r'))] = String(val ?? '').replace(/\s+/g, ' ').trim();
      });
      return Array.from(cells, (x) => x || '').join('\t').replace(/\t+$/, '');
    }).filter((l) => l.trim());
    if (lines.length) out.push(`## 表格「${sh.getAttribute('name')}」\n${lines.join('\n')}`);
  }
  return out.join('\n\n');
}
/** Paragraphs as lines, table rows as tab-separated cells. */
async function docxText(buf) {
  const read = await unzipEntries(buf);
  const body = xmlDoc(await read('word/document.xml')).getElementsByTagName('w:body')[0];
  if (!body) throw new Error('读不出这个 Word 文件');
  const para = (p) => [...p.getElementsByTagName('w:t')].map((t) => t.textContent).join('');
  const lines = [];
  [...body.children].forEach((el) => {
    if (el.tagName === 'w:p') lines.push(para(el));
    else if (el.tagName === 'w:tbl') [...el.getElementsByTagName('w:tr')].forEach((tr) => lines.push([...tr.getElementsByTagName('w:tc')].map((tc) => [...tc.getElementsByTagName('w:p')].map(para).join(' ')).join('\t')));
  });
  return lines.filter((l) => l.trim()).join('\n');
}
const toBase64 = (buf) => {
  let s = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
};

/** One picked file → { name, kind: text | pdf | image, data } (or a shared plan file, imported straight away). */
async function readPlanFile(f) {
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (ext === 'json') {
    const j = JSON.parse(await f.text());
    if (!j || !j.ianzPlan || !j.plan) throw new Error('不是 Ianz Fitness 的计划文件');
    return { name: f.name, plan: j.plan };
  }
  if (['xlsx', 'xlsm'].includes(ext)) return { name: f.name, kind: 'text', data: await xlsxText(await f.arrayBuffer()) };
  if (ext === 'docx') return { name: f.name, kind: 'text', data: await docxText(await f.arrayBuffer()) };
  if (['xls', 'doc', 'numbers', 'pages', 'key'].includes(ext)) throw new Error(`.${ext} 格式读不了：请另存为 .xlsx / .docx，或导出 PDF、截图`);
  if (['csv', 'tsv', 'txt', 'md'].includes(ext) || f.type.startsWith('text/')) return { name: f.name, kind: 'text', data: await f.text() };
  if (ext === 'pdf' || f.type === 'application/pdf') {
    if (f.size > 6e6) throw new Error('PDF 太大了（最多 6MB）');
    return { name: f.name, kind: 'pdf', data: toBase64(await f.arrayBuffer()) };
  }
  if (f.type.startsWith('image/')) {
    const blob = await compressImage(f, 1600, 0.85);
    return { name: f.name, kind: 'image', media: 'image/jpeg', data: toBase64(await blob.arrayBuffer()) };
  }
  throw new Error('支持 Excel、Word、PDF、图片、CSV、文本，以及分享的计划文件');
}

/* ---------- sheets ---------- */
function openPlanImport() {
  pim = { files: [], text: '', busy: false, plan: null, err: '' };
  if (typeof ensureExdb === 'function') ensureExdb(); // exercise photos for the catalog
  drawPlanImport();
}
const aiImportOn = () => typeof CLOUD_CONFIG !== 'undefined' && !!CLOUD_CONFIG.aiImport;
function drawPlanImport() {
  if (pim.plan) return drawPlanPreview();
  if (!aiImportOn()) {
    return openSheet('导入训练计划', `<p class="muted">打开朋友分享给你的计划文件（文件名以 <b>.ianzplan.json</b> 结尾），导入后可以先预览再使用，不用登录。</p>
      <label class="btn block pim-pick">📎 选择计划文件<input type="file" id="pimFile" accept=".json,application/json" hidden></label>
      ${pim.err ? `<p class="pim-err">${esc(pim.err)}</p>` : ''}
      <div class="card"><h3>怎么分享计划</h3><p class="muted small">朋友在「挑战 → 切换计划」里，点他导入的计划下面的「分享」，把生成的文件通过微信等发给你；你在微信里把文件存到手机（「文件」App 或下载），再回到这里选择它。</p></div>
      <p class="muted small">AI 识别 Excel / PDF / 照片暂未开放。</p>`, { type: 'planimport' });
  }
  const login = cloudEnabled() && cloud.user;
  openSheet('导入训练计划', `<p class="muted">把别人发给你的训练计划交给 AI：Excel、Word、PDF、照片 / 截图都可以，也能直接粘贴文字。AI 会按 App 的方式生成计划：主项按 1RM 百分比、辅助动作按双进阶自动加重，导入后可以先看再用。</p>
    <label class="btn block ghost pim-pick">📎 选择文件<input type="file" id="pimFile" multiple hidden accept=".xlsx,.xlsm,.docx,.pdf,.csv,.tsv,.txt,.md,.json,image/*"></label>
    ${pim.files.length ? `<div class="pim-files">${pim.files.map((f, i) => `<div class="kv"><span>${f.kind === 'image' ? '🖼' : f.kind === 'pdf' ? '📄' : '📊'} ${esc(f.name)}</span><button class="btn tiny ghost" data-pim-rm="${i}">移除</button></div>`).join('')}</div>` : ''}
    <label>或者粘贴计划内容</label>
    <textarea id="pimText" rows="5" maxlength="20000" placeholder="例如：周一 卧推 5×5 @75%，哑铃划船 3×8-12……">${esc(pim.text)}</textarea>
    ${pim.err ? `<p class="pim-err">${esc(pim.err)}</p>` : ''}
    ${pim.busy ? '<div class="pim-busy"><span class="spin"></span><span>AI 正在读计划，通常需要 30–90 秒，请不要关闭…</span></div>'
      : login ? '<button class="btn block" data-pim-go>✨ AI 生成训练计划</button>'
      : '<button class="btn block" data-pim-login>登录后使用 AI 导入</button><p class="muted small">朋友分享的计划文件（.json）不用登录，直接选择文件就能导入。</p>'}
    <p class="muted small">文件只用来生成这一次的计划，不会公开。每天最多 AI 导入 10 次。</p>`, { type: 'planimport' });
}

/** What one exercise does in week 1, e.g. "5×5 @75%" or "3×8–12 · 双进阶". */
function planExLine(ex) {
  const sets = cpSets(ex, 1).filter((s) => !s.warm);
  if (!sets.length) return '本周不练';
  const rep = (s) => (s.repsMax > s.reps ? `${s.reps}–${s.repsMax}` : `${s.reps || s.repsMax}`);
  const same = sets.every((s) => rep(s) === rep(sets[0]) && s.pct === sets[0].pct && s.kg === sets[0].kg && s.amrap === sets[0].amrap);
  const body = same ? `${sets.length}×${rep(sets[0])}${sets[0].amrap ? '+' : ''}` : sets.map((s) => `${rep(s)}${s.amrap ? '+' : ''}`).join('/');
  const load = ex.load === 'pct' ? (same ? ` @${sets[0].pct}%` : ` @${sets.map((s) => s.pct).join('/')}%`) : ex.load === 'kg' ? ` · ${fmtW(sets[0].kg)}kg` : ex.load === 'double' ? ' · 双进阶' : sets[0].rpe ? ` · RPE ${sets[0].rpe}` : '';
  return body + load;
}
function drawPlanPreview() {
  const d = pim.plan;
  const lifts = planLifts(d);
  const varies = d.days.some((x) => x.ex.some((e) => e.plan.length > 1));
  openSheet('确认导入的计划', `<label>计划名称</label><input id="pimName" maxlength="30" value="${esc(d.name)}">
    <div class="card pim-sum"><div class="kv"><span>周期</span><b>${d.weeks} 周${d.weekInfo.some((w) => w.deload) ? `（第 ${d.weekInfo.map((w, i) => (w.deload ? i + 1 : 0)).filter(Boolean).join('、')} 周减载）` : ''}</b></div>
      <div class="kv"><span>安排</span><b>${d.mode === 'rotation' ? `${d.days.length} 个训练日按顺序轮换${d.restAfter ? ` + 休 ${d.restAfter} 天` : ''}` : `一周 ${d.days.length} 练`}</b></div>
      ${lifts.length ? `<div class="kv"><span>需要填写 1RM</span><b>${lifts.map((l) => LIFT_NAMES[l]).join('、')}</b></div>` : ''}
      ${d.desc ? `<p class="muted small">${esc(d.desc)}</p>` : ''}</div>
    ${d.warnings.length ? `<div class="card pim-warn"><b>⚠️ 需要你确认</b>${d.warnings.map((w) => `<p class="small">${esc(w)}</p>`).join('')}</div>` : ''}
    ${d.days.map((day) => `<div class="card"><h3>${esc(day.name)}</h3>${day.note ? `<p class="muted small">${esc(day.note)}</p>` : ''}
      ${day.ex.map((e) => `<div class="kv"><span>${esc(e.name)}</span><b class="small">${esc(planExLine(e))}</b></div>`).join('')}</div>`).join('')}
    ${varies ? '<p class="muted small">上面是第 1 周的安排，之后每周的重量和组数按计划变化。</p>' : ''}
    <button class="btn block" data-pim-use>使用这个计划</button>
    <div class="row"><button class="btn ghost grow" data-pim-save>只保存</button><button class="btn ghost grow" data-pim-back>重新导入</button></div>`, { type: 'planimport' });
}

async function runPlanImport() {
  pim.text = ($('#pimText') && $('#pimText').value.trim()) || '';
  if (!pim.files.length && !pim.text) { pim.err = '先选择文件或粘贴计划内容'; return drawPlanImport(); }
  pim.busy = true; pim.err = '';
  drawPlanImport();
  try {
    const catalog = typeof EXDB !== 'undefined' ? EXDB.map((e) => `${e.id}|${e.name}`).join('\n') : '';
    const { data, error } = await cloud.client.functions.invoke('plan-import', { body: { files: pim.files.map(({ name, kind, media, data: x }) => ({ name, kind, media, data: x })), text: pim.text, catalog } });
    if (error) {
      let msg = '';
      try { msg = (await error.context.json()).error; } catch { /* no JSON body */ }
      throw new Error(msg || (/Failed to send|fetch/i.test(error.message) ? '网络连接失败，或者 AI 导入还没有部署' : error.message));
    }
    pim.plan = normalizePlanDef({ ...data.plan, source: 'ai' }, newPlanId());
  } catch (e) {
    pim.err = e.message || String(e);
  }
  pim.busy = false;
  if (sheetCtx && sheetCtx.type === 'planimport') drawPlanImport();
}
const newPlanId = () => `cp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Save the previewed plan; `use` = set it up now (1RM and schedule steps of the questionnaire). */
function savePlan(use) {
  const d = pim.plan;
  d.name = ($('#pimName').value.trim() || d.name).slice(0, 30);
  state.customPrograms = { ...(state.customPrograms || {}), [d.id]: d };
  save();
  registerCustomPrograms(state);
  pim = null;
  closeSheet();
  if (!use) { toast('已保存，在「切换计划」里随时可以开始'); render(); return; }
  startWizard(true, d.id, planLifts(d).length ? 'lifts' : 'schedule');
}

/** Send an imported plan to a friend as a file; opening it in 导入训练计划 brings it in without AI. */
async function sharePlanFile(id) {
  const d = (state.customPrograms || {})[id];
  if (!d) return;
  const { id: _id, hidden, createdAt, ...plan } = d;
  const json = JSON.stringify({ ianzPlan: 1, app: 'Ianz Fitness', plan }, null, 1);
  const name = `${d.name.replace(/[\\/:*?"<>|]/g, '')}.ianzplan.json`;
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: d.name }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  download(name, json, 'application/json');
  toast('计划文件已下载，发给朋友，在「导入训练计划」里打开');
}

function bindPlanImport() {
  const sheet = $('#sheet');
  sheet.addEventListener('change', async (e) => {
    if (e.target.id !== 'pimFile' || !pim) return;
    pim.text = ($('#pimText') && $('#pimText').value) || pim.text;
    pim.err = '';
    for (const f of e.target.files) {
      try {
        const r = await readPlanFile(f);
        if (r.plan) { pim.plan = normalizePlanDef({ ...r.plan, source: 'file' }, newPlanId()); break; }
        if (!aiImportOn()) throw new Error('这不是计划文件。AI 识别暂未开放，现在只能导入别人分享的 .ianzplan.json 文件');
        if (r.kind === 'text' && !r.data.trim()) throw new Error('里面没有读到文字');
        if (pim.files.length >= 6) throw new Error('最多 6 个文件');
        pim.files.push({ ...r, size: r.data.length });
      } catch (err) { pim.err = `${f.name}：${err.message}`; }
    }
    drawPlanImport();
  });
  sheet.addEventListener('click', (e) => {
    if (!sheetCtx || sheetCtx.type !== 'planimport' || !pim) return;
    const b = e.target.closest('button');
    if (!b || pim.busy) return;
    if (b.dataset.pimRm !== undefined) { pim.text = $('#pimText').value; pim.files.splice(Number(b.dataset.pimRm), 1); drawPlanImport(); }
    else if (b.dataset.pimGo !== undefined) runPlanImport();
    else if (b.dataset.pimLogin !== undefined) openLoginSheet();
    else if (b.dataset.pimUse !== undefined) savePlan(true);
    else if (b.dataset.pimSave !== undefined) savePlan(false);
    else if (b.dataset.pimBack !== undefined) { pim.plan = null; drawPlanImport(); }
  });
}
