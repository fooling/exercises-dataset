/* 囚徒健身 · 徒手训练手册 — 前端逻辑（无依赖） */
'use strict';

const App = (() => {
  let DATA = null;
  let byId = {};
  const state = {
    parts: new Set(),
    diff: new Set(),
    fams: new Set(),
    q: '',
    goal: 0,          // 推荐组数：0 打基础 / 1 进阶 / 2 精通
    plan: { level: 'beginner', focus: 'full', gear: 'bar' },
  };

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const famOf = k => DATA.families.find(f => f.key === k);
  const diffOf = d => DATA.difficulty.find(x => x.level === d);

  /* ─────────────────────────── 路由 ─────────────────────────── */
  const TABS = ['system', 'library', 'plan'];

  function route() {
    const h = (location.hash || '#/system').slice(2).split('/');
    const [head, arg] = [h[0] || 'system', h[1]];

    $$('.view').forEach(v => v.classList.add('hidden'));
    const isSub = head === 'chain' || head === 'ex';
    $('#backBtn').classList.toggle('hidden', !isSub);

    if (head === 'chain') { renderChain(arg); $('#view-chain').classList.remove('hidden'); }
    else if (head === 'ex') { renderDetail(arg); $('#view-detail').classList.remove('hidden'); }
    else {
      const tab = TABS.includes(head) ? head : 'system';
      $('#view-' + tab).classList.remove('hidden');
      setTopbar(
        { system: '囚徒健身', library: '动作库', plan: '今日训练' }[tab],
        { system: '徒手 · 挂墙单杠训练手册', library: `${DATA.exercises.length} 个精选徒手动作`, plan: '按水平与目标排课' }[tab]
      );
    }
    $$('.tab').forEach(b => b.classList.toggle('active',
      b.dataset.tab === (isSub ? '' : (TABS.includes(head) ? head : 'system'))));
    window.scrollTo(0, 0);
  }

  const go = hash => { location.hash = hash; };
  const setTopbar = (t, s) => { $('#tbTitle').textContent = t; $('#tbSub').textContent = s; };

  /* ─────────────────────────── 六艺体系 ─────────────────────────── */
  function renderSystem() {
    const card = f => {
      const n = DATA.exercises.filter(e => e.fam === f.key).length;
      return `<button class="fam-card ${f.big6 ? 'big6' : ''}" onclick="App.go('#/chain/${f.key}')">
        <span class="fc-icon">${f.icon}</span>
        <div class="fc-name">${esc(f.zh)}</div>
        <div class="fc-sub">${esc(f.sub)}</div>
        <div class="fc-count">${n} 个动作 ›</div>
      </button>`;
    };
    $('#famGrid').innerHTML = DATA.families.filter(f => f.big6).map(card).join('');
    $('#famGridAux').innerHTML = DATA.families.filter(f => !f.big6).map(card).join('');
  }

  /* ─────────────────────────── 进阶链 ─────────────────────────── */
  function renderChain(key) {
    const f = famOf(key);
    if (!f) return go('#/system');
    setTopbar(f.zh, f.sub);
    const list = DATA.exercises.filter(e => e.fam === key);

    $('#chainHead').innerHTML = `<div class="chain-head">
      <div class="ch-icon">${f.icon}</div>
      <h2>${esc(f.zh)}进阶链</h2>
      <p>共 ${list.length} 级 · 从入门到大师。每级都练到「精通」标准再进入下一级。</p>
    </div>`;

    $('#chainList').innerHTML = list.map(e => `
      <button class="chain-item d${e.d}" onclick="App.go('#/ex/${e.id}')">
        <div class="chain-rail">
          <div class="chain-num">${e.step}</div>
          <div class="chain-line"></div>
        </div>
        <div class="chain-card">
          <img src="/${e.img}" alt="" loading="lazy">
          <div class="ex-info">
            <div class="ex-name">${esc(e.zh)}</div>
            <div class="ex-meta">
              <span class="dot d${e.d}">${esc(diffOf(e.d).zh)}</span>
              ${e.need !== '徒手' ? `<span class="tag gear">${esc(e.need)}</span>` : ''}
              <span class="tag">${esc(e.std[1].text)}</span>
            </div>
          </div>
        </div>
      </button>`).join('');
  }

  /* ─────────────────────────── 动作库筛选 ─────────────────────────── */
  function renderFilters() {
    const mk = (row, items, cls) => $(row).innerHTML = items.join('');

    mk('#filterParts', DATA.parts.map(p =>
      `<button class="chip ${state.parts.has(p) ? 'on' : ''}" onclick="App.toggle('parts','${p}')">${p}</button>`));

    mk('#filterDiff', DATA.difficulty.map(d =>
      `<button class="chip d${d.level} ${state.diff.has(d.level) ? 'on' : ''}" onclick="App.toggle('diff',${d.level})">${d.zh}</button>`));

    mk('#filterFam', DATA.families.map(f =>
      `<button class="chip ${state.fams.has(f.key) ? 'on' : ''}" onclick="App.toggle('fams','${f.key}')">${f.icon} ${f.zh}</button>`));
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return DATA.exercises.filter(e => {
      if (state.parts.size && !e.parts.some(p => state.parts.has(p))) return false;
      if (state.diff.size && !state.diff.has(e.d)) return false;
      if (state.fams.size && !state.fams.has(e.fam)) return false;
      if (q && !(e.zh.toLowerCase().includes(q) || e.en.toLowerCase().includes(q)
        || e.parts.some(p => p.includes(q)))) return false;
      return true;
    });
  }

  function renderLibrary() {
    renderFilters();
    const list = filtered();
    const active = state.parts.size + state.diff.size + state.fams.size + (state.q ? 1 : 0);
    $('#resultCount').textContent = `${list.length} 个动作`;
    $('#clearFilters').classList.toggle('hidden', !active);
    $('#emptyState').classList.toggle('hidden', list.length > 0);
    $('#exList').innerHTML = list.map(itemHTML).join('');
  }

  const itemHTML = e => `
    <button class="ex-item" onclick="App.go('#/ex/${e.id}')">
      <img class="ex-thumb" src="/${e.img}" alt="" loading="lazy">
      <div class="ex-info">
        <div class="ex-name">${esc(e.zh)}</div>
        <div class="ex-en">${esc(e.en)}</div>
        <div class="ex-meta">
          <span class="dot d${e.d}">${esc(diffOf(e.d).zh)}</span>
          <span class="tag">${esc(famOf(e.fam).zh)}</span>
          ${e.parts.slice(0, 2).map(p => `<span class="tag">${esc(p)}</span>`).join('')}
          ${e.need !== '徒手' ? `<span class="tag gear">${esc(e.need)}</span>` : ''}
        </div>
      </div>
    </button>`;

  /* ─────────────────────────── 动作详情 ─────────────────────────── */
  function renderDetail(id) {
    const e = byId[id];
    if (!e) return go('#/library');
    setTopbar(e.zh, `${famOf(e.fam).zh} · 第 ${e.step}/${e.chain_len} 级`);

    const prev = DATA.exercises.find(x => x.fam === e.fam && x.step === e.step - 1);
    const next = DATA.exercises.find(x => x.fam === e.fam && x.step === e.step + 1);

    $('#detailBody').innerHTML = `
      <div class="dt-media"><img src="/${e.gif}" alt="${esc(e.zh)}"></div>

      <div class="dt-title">
        <h2>${esc(e.zh)}</h2>
        <div class="dt-en">${esc(e.en)}</div>
        <div class="dt-tags">
          <span class="dot d${e.d}">${esc(diffOf(e.d).zh)}</span>
          <span class="tag gear">${esc(e.need)}</span>
          ${e.parts.map(p => `<span class="tag">${esc(p)}</span>`).join('')}
        </div>
        <div class="dt-desc">${esc(diffOf(e.d).desc)}</div>
      </div>

      <div class="card coach">
        <div class="card-h">🎯 发力要点 <span class="ch-badge">教练</span></div>
        <ol class="cues">${e.cues.map(c => `<li>${esc(c)}</li>`).join('')}</ol>
      </div>

      <div class="card">
        <div class="card-h">📊 推荐组数 <span class="ch-badge">教练</span></div>
        <div class="goal-tabs">
          ${e.std.map((s, i) => `<button class="goal-tab ${i === state.goal ? 'on' : ''}" onclick="App.setGoal(${i},'${e.id}')">${esc(s.goal)}</button>`).join('')}
        </div>
        <div class="rx-big">${esc(e.std[state.goal].text)}</div>
        <div class="rx-rows">
          <div class="rx-row"><div class="rx-k">节奏</div><div class="rx-v">${esc(e.tempo)}</div></div>
          <div class="rx-row"><div class="rx-k">休息</div><div class="rx-v">${esc(e.rest)}</div></div>
          <div class="rx-row"><div class="rx-k">频率</div><div class="rx-v">${esc(e.freq)}</div></div>
          <div class="rx-row"><div class="rx-k">主练</div><div class="rx-v">${esc(e.target)}${e.secondary.length ? '（协同：' + esc(e.secondary.join('、')) + '）' : ''}</div></div>
        </div>
      </div>

      ${e.errors.length ? `<div class="card warn">
        <div class="card-h">⚠️ 常见错误</div>
        <ul class="errs">${e.errors.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>` : ''}

      ${e.steps.length ? `<div class="card">
        <div class="card-h">📝 动作步骤</div>
        <ol class="steps">${e.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      </div>` : ''}

      ${e.note ? `<div class="card"><div class="card-h">💡 教练提示</div>
        <div class="note-box">${esc(e.note)}</div></div>` : ''}

      <div class="card">
        <div class="card-h">${famOf(e.fam).icon} ${esc(famOf(e.fam).zh)}进阶链</div>
        <div class="chain-pos">
          <span>当前第 <b>${e.step}</b> / ${e.chain_len} 级</span>
          <button class="link-btn" onclick="App.go('#/chain/${e.fam}')">查看完整链 ›</button>
        </div>
        ${prev ? navRow('← 降阶', prev) : ''}
        ${next ? navRow('进阶 →', next) : ''}
      </div>`;
  }

  const navRow = (label, e) => `
    <button class="plan-item" style="margin-top:10px" onclick="App.go('#/ex/${e.id}')">
      <img src="/${e.img}" alt="" loading="lazy">
      <div class="ex-info">
        <div class="ex-en">${esc(label)}</div>
        <div class="ex-name" style="font-size:14px">${esc(e.zh)}</div>
        <div class="ex-meta"><span class="dot d${e.d}">${esc(diffOf(e.d).zh)}</span></div>
      </div>
    </button>`;

  /* ─────────────────────────── 今日训练 ─────────────────────────── */
  const LEVELS = [
    { key: 'beginner', zh: '入门', range: [1, 2], goal: 0 },
    { key: 'inter', zh: '进阶', range: [2, 3], goal: 1 },
    { key: 'advanced', zh: '高手', range: [3, 5], goal: 2 },
  ];
  const FOCUS = [
    { key: 'full', zh: '全身', fams: ['push', 'pull', 'squat', 'legraise', 'bridge'] },
    { key: 'upper', zh: '上肢', fams: ['push', 'pull', 'dip', 'handstand'] },
    { key: 'lower', zh: '下肢', fams: ['squat', 'bridge', 'calf'] },
    { key: 'core', zh: '核心', fams: ['legraise', 'core', 'bridge'] },
    { key: 'pull', zh: '单杠专项', fams: ['pull', 'legraise'] },
    { key: 'burn', zh: '燃脂', fams: ['cardio', 'squat', 'core'] },
  ];
  const GEAR = [
    { key: 'none', zh: '纯徒手', allow: ['徒手'] },
    { key: 'bar', zh: '单杠', allow: ['徒手', '单杠', '单杠 + 凳'] },
    { key: 'full', zh: '单杠+双杠', allow: ['徒手', '单杠', '单杠 + 凳', '双杠', '罗马椅/双杠'] },
  ];

  function renderPlanForm() {
    const seg = (sel, items, cur, field) => $(sel).innerHTML = items.map(i =>
      `<button class="${i.key === cur ? 'on' : ''}" onclick="App.setPlan('${field}','${i.key}')">${i.zh}</button>`).join('');
    seg('#planLevel', LEVELS, state.plan.level, 'level');
    seg('#planFocus', FOCUS, state.plan.focus, 'focus');
    seg('#planGear', GEAR, state.plan.gear, 'gear');
  }

  function generatePlan() {
    const lv = LEVELS.find(l => l.key === state.plan.level);
    const fc = FOCUS.find(f => f.key === state.plan.focus);
    const gr = GEAR.find(g => g.key === state.plan.gear);
    const ok = e => gr.allow.includes(e.need);

    // 每个动作族里挑一个最贴近目标难度的动作
    const pick = fam => {
      const pool = DATA.exercises.filter(e => e.fam === fam && ok(e)
        && e.d >= lv.range[0] && e.d <= lv.range[1]);
      if (!pool.length) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    };

    const main = fc.fams.map(pick).filter(Boolean);
    const warm = shuffle(DATA.exercises.filter(e => e.fam === 'mobility')).slice(0, 3);
    const finish = shuffle(DATA.exercises.filter(e =>
      (e.fam === 'cardio' || e.fam === 'core') && ok(e) && e.d <= lv.range[1])).slice(0, 1);

    const block = (title, sub, items, showRx) => !items.length ? '' : `
      <div class="plan-block">
        <h3>${title} <span>${sub}</span></h3>
        ${items.map(e => `
          <button class="plan-item" onclick="App.go('#/ex/${e.id}')">
            <img src="/${e.img}" alt="" loading="lazy">
            <div class="ex-info">
              <div class="ex-name" style="font-size:14.5px">${esc(e.zh)}</div>
              <div class="plan-rx">${esc(showRx ? e.std[lv.goal].text : e.std[0].text)}</div>
              <div class="ex-meta"><span class="dot d${e.d}">${esc(diffOf(e.d).zh)}</span>
                <span class="tag">${esc(famOf(e.fam).zh)}</span></div>
            </div>
          </button>`).join('')}
      </div>`;

    $('#planResult').innerHTML =
      block('热身 · WARM-UP', '5 分钟，唤醒关节', warm, false) +
      block('主项 · MAIN', `${lv.zh}水平 · ${fc.zh}`, main, true) +
      block('收尾 · FINISHER', '力竭收官', finish, true) +
      `<div class="plan-note">
        · 主项按顺序完成，组间休息见各动作详情页。<br>
        · 任何一个动作做不到标准形态，就退回它的降阶动作，别硬撑。<br>
        · 同一动作能达到「精通」标准后，再进阶到链条的下一级。<br>
        · 再次点击「生成训练计划」可换一组动作。
      </div>`;
    $('#planResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);

  /* ─────────────────────────── 事件绑定 ─────────────────────────── */
  function bind() {
    $$('.tab').forEach(b => b.onclick = () => go('#/' + b.dataset.tab));
    $('#backBtn').onclick = () => history.back();
    $('#search').oninput = ev => { state.q = ev.target.value; renderLibrary(); };
    $('#clearFilters').onclick = () => clearFilters();
    $('#genPlan').onclick = () => generatePlan();
    window.addEventListener('hashchange', route);
  }

  function clearFilters() {
    state.parts.clear(); state.diff.clear(); state.fams.clear();
    state.q = ''; $('#search').value = '';
    renderLibrary();
  }

  /* ─────────────────────────── 启动 ─────────────────────────── */
  async function init() {
    DATA = await (await fetch('data/app-data.json')).json();
    DATA.exercises.forEach(e => byId[e.id] = e);
    renderSystem();
    renderLibrary();
    renderPlanForm();
    bind();
    route();
  }

  return {
    init, go, clearFilters,
    toggle(field, val) {
      const s = state[field];
      s.has(val) ? s.delete(val) : s.add(val);
      renderLibrary();
    },
    setGoal(i, id) { state.goal = i; renderDetail(id); },
    setPlan(field, val) { state.plan[field] = val; renderPlanForm(); },
  };
})();

App.init();
