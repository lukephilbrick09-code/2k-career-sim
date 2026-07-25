// ===================== SETUP =====================
const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
let currentCareerId = null;
let cache = { career: null, attrs: [], badges: [], logs: [], contracts: [], awards: [] };

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ===================== DATA DEFS =====================
const ATTRIBUTE_DEFS = {
  Finishing: ["Close Shot","Driving Layup","Driving Dunk","Standing Dunk","Post Control","Post Hook","Post Fade"],
  Shooting: ["Mid Range","Three Point","Free Throw"],
  Playmaking: ["Pass Accuracy","Ball Handle","Speed With Ball"],
  Defense: ["Interior Defense","Perimeter Defense","Steal","Block","Offensive Rebound","Defensive Rebound"],
  Athleticism: ["Speed","Acceleration","Agility","Strength","Vertical","Stamina"]
};

const BADGE_DEFS = {
  Finishing: ["Aerial Wizard","Float Game","Hook Specialist","Layup Mixmaster","Paint Prodigy","Physical Finisher","Post Fade Phenom","Post Powerhouse","Post-Up Poet","Posterizer","Rise Up"],
  Shooting: ["Deadeye","Limitless Range","Mini Marksman","Set Shot Specialist","Shifty Shooter"],
  Playmaking: ["Ankle Assassin","Bail Out","Break Starter","Dimer","Handles for Days","Lightning Launch","Strong Handle","Unpluckable","Versatile Visionary"],
  Defense: ["Challenger","Glove","Interceptor","High-Flying Denier","Immovable Enforcer","Off-Ball Pest","On-Ball Menace","Paint Patroller","Pick Dodger","Post Lockdown"],
  Rebounding: ["Boxout Beast","Rebound Chaser"],
  Physical: ["Brick Wall","Slippery Off-Ball","Pogo Stick"]
};

const TIERS = ["none","bronze","silver","gold","hof","legend"];
const TIER_THRESHOLDS = { none: 300, bronze: 900, silver: 2000, gold: 4000, hof: 8000, legend: Infinity };

// Level milestones -> total career XP required
const LEVEL_MILESTONES = [[1,0],[2,4000],[5,20000],[10,60000],[20,250000],[30,700000],[40,1500000],[50,3000000],[60,6000000],[70,10000000],[80,15000000],[90,20000000],[99,25000000]];
function levelXpTable() {
  const table = {};
  for (let i = 0; i < LEVEL_MILESTONES.length - 1; i++) {
    const [l1, x1] = LEVEL_MILESTONES[i];
    const [l2, x2] = LEVEL_MILESTONES[i + 1];
    for (let l = l1; l <= l2; l++) {
      const t = (l - l1) / (l2 - l1);
      table[l] = x1 === 0 ? Math.round(x2 * t * t) : Math.round(x1 * Math.pow(x2 / x1, t));
    }
  }
  return table;
}
const LEVEL_TABLE = levelXpTable();
function levelForTotalXp(xp) {
  let lvl = 1;
  for (let l = 1; l <= 99; l++) { if (xp >= (LEVEL_TABLE[l] || 0)) lvl = l; else break; }
  return lvl;
}
function xpNeededForAttr(value) { return Math.round(3.2 * Math.pow(1.113, value)); }

// ===================== HOME SCREEN =====================
async function loadCareerSlots() {
  const { data, error } = await supabase.from('careers').select('*').order('last_played', { ascending: false });
  const container = document.getElementById('career-slots');
  if (error) { container.innerHTML = `<div class="empty">Error loading careers: ${error.message}</div>`; return; }
  if (!data.length) { container.innerHTML = `<div class="empty">No careers yet. Create one to get started.</div>`; return; }
  container.innerHTML = data.map(c => `
    <div class="slot-card-wrap">
      <div class="slot-card" data-id="${c.id}">
        <div class="slot-main">
          <h3>${c.name}</h3>
          <div class="slot-sub">${c.position} · ${c.team} · S${c.season} · YR${c.years_pro} · LVL ${c.level}</div>
          <div class="slot-actions">
            <button class="ghost dup" data-id="${c.id}">Duplicate</button>
            <button class="ghost exp" data-id="${c.id}">Export</button>
            <button class="ghost del" data-id="${c.id}" style="color:var(--red); border-color:var(--red)">Delete</button>
          </div>
        </div>
        <div class="slot-ovr"><div class="n">${c.overall}</div><div class="l">OVR</div></div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.slot-card').forEach(el => el.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    openCareer(el.dataset.id);
  }));
  container.querySelectorAll('.dup').forEach(el => el.addEventListener('click', () => duplicateCareer(el.dataset.id)));
  container.querySelectorAll('.exp').forEach(el => el.addEventListener('click', () => exportCareer(el.dataset.id)));
  container.querySelectorAll('.del').forEach(el => el.addEventListener('click', () => deleteCareer(el.dataset.id)));
}

async function createCareer(name) {
  const { data, error } = await supabase.from('careers').insert({ name: name || 'My Player' }).select().single();
  if (error) { toast('Error creating career'); return; }
  const attrRows = [];
  for (const [cat, names] of Object.entries(ATTRIBUTE_DEFS)) {
    for (const n of names) attrRows.push({ career_id: data.id, category: cat, name: n, value: 25, xp: 0, xp_needed: xpNeededForAttr(25) });
  }
  const badgeRows = [];
  for (const [cat, names] of Object.entries(BADGE_DEFS)) {
    for (const n of names) badgeRows.push({ career_id: data.id, category: cat, name: n, tier: 'none', xp: 0, xp_needed: TIER_THRESHOLDS.none });
  }
  await supabase.from('attributes').insert(attrRows);
  await supabase.from('badges').insert(badgeRows);
  toast('Career created');
  loadCareerSlots();
}

async function duplicateCareer(id) {
  const { data: c } = await supabase.from('careers').select('*').eq('id', id).single();
  const { data: attrs } = await supabase.from('attributes').select('*').eq('career_id', id);
  const { data: badges } = await supabase.from('badges').select('*').eq('career_id', id);
  const { data: newCareer } = await supabase.from('careers').insert({
    name: c.name + ' (Copy)', position: c.position, team: c.team, season: c.season,
    years_pro: c.years_pro, overall: c.overall, level: c.level, total_xp: c.total_xp, vc: c.vc
  }).select().single();
  await supabase.from('attributes').insert(attrs.map(a => ({ career_id: newCareer.id, category: a.category, name: a.name, value: a.value, xp: a.xp, xp_needed: a.xp_needed })));
  await supabase.from('badges').insert(badges.map(b => ({ career_id: newCareer.id, category: b.category, name: b.name, tier: b.tier, xp: b.xp, xp_needed: b.xp_needed })));
  toast('Career duplicated');
  loadCareerSlots();
}

async function deleteCareer(id) {
  if (!confirm('Delete this career permanently? This cannot be undone.')) return;
  await supabase.from('careers').delete().eq('id', id);
  toast('Career deleted');
  loadCareerSlots();
}

async function exportCareer(id) {
  const { data: c } = await supabase.from('careers').select('*').eq('id', id).single();
  const { data: attrs } = await supabase.from('attributes').select('*').eq('career_id', id);
  const { data: badges } = await supabase.from('badges').select('*').eq('career_id', id);
  const { data: logs } = await supabase.from('game_logs').select('*').eq('career_id', id);
  const { data: contracts } = await supabase.from('contracts').select('*').eq('career_id', id);
  const { data: awards } = await supabase.from('awards').select('*').eq('career_id', id);
  const blob = new Blob([JSON.stringify({ career: c, attrs, badges, logs, contracts, awards }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${c.name.replace(/\s+/g, '_')}_career.json`;
  a.click();
}

async function importCareerFile(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  const c = payload.career;
  const { data: newCareer } = await supabase.from('careers').insert({
    name: c.name + ' (Imported)', position: c.position, team: c.team, season: c.season,
    years_pro: c.years_pro, overall: c.overall, level: c.level, total_xp: c.total_xp, vc: c.vc
  }).select().single();
  if (payload.attrs?.length) await supabase.from('attributes').insert(payload.attrs.map(a => ({ career_id: newCareer.id, category: a.category, name: a.name, value: a.value, xp: a.xp, xp_needed: a.xp_needed })));
  if (payload.badges?.length) await supabase.from('badges').insert(payload.badges.map(b => ({ career_id: newCareer.id, category: b.category, name: b.name, tier: b.tier, xp: b.xp, xp_needed: b.xp_needed })));
  if (payload.logs?.length) await supabase.from('game_logs').insert(payload.logs.map(l => { const { id, career_id, ...rest } = l; return { career_id: newCareer.id, ...rest }; }));
  if (payload.contracts?.length) await supabase.from('contracts').insert(payload.contracts.map(x => { const { id, career_id, ...rest } = x; return { career_id: newCareer.id, ...rest }; }));
  if (payload.awards?.length) await supabase.from('awards').insert(payload.awards.map(x => { const { id, career_id, ...rest } = x; return { career_id: newCareer.id, ...rest }; }));
  toast('Career imported');
  loadCareerSlots();
}

// ===================== OPEN CAREER =====================
async function openCareer(id) {
  currentCareerId = id;
  await supabase.from('careers').update({ last_played: new Date().toISOString() }).eq('id', id);
  document.getElementById('screen-home').style.display = 'none';
  document.getElementById('screen-career').style.display = 'block';
  await refreshCareer();
}

async function refreshCareer() {
  const { data: career } = await supabase.from('careers').select('*').eq('id', currentCareerId).single();
  const { data: attrs } = await supabase.from('attributes').select('*').eq('career_id', currentCareerId).order('category');
  const { data: badges } = await supabase.from('badges').select('*').eq('career_id', currentCareerId).order('category');
  const { data: logs } = await supabase.from('game_logs').select('*').eq('career_id', currentCareerId).order('played_at', { ascending: false });
  const { data: contracts } = await supabase.from('contracts').select('*').eq('career_id', currentCareerId).order('signed_at', { ascending: false });
  const { data: awards } = await supabase.from('awards').select('*').eq('career_id', currentCareerId).order('created_at', { ascending: false });
  cache = { career, attrs: attrs || [], badges: badges || [], logs: logs || [], contracts: contracts || [], awards: awards || [] };
  renderPlayerCard();
  renderAttributes();
  renderBadges();
  renderContract();
  renderSeasons();
  renderHistory();
}

function renderPlayerCard() {
  const c = cache.career;
  document.getElementById('playerName').textContent = c.name;
  document.getElementById('playerMeta').textContent = `${c.position} · ${c.team} · Season ${c.season}`;
  document.getElementById('vcBalance').textContent = `$${Math.round(c.vc).toLocaleString()} VC`;
  document.getElementById('ovrNum').textContent = c.overall;
  document.getElementById('lvlLabel').textContent = `LVL ${c.level}`;
  const curFloor = LEVEL_TABLE[c.level] || 0;
  const nextNeed = LEVEL_TABLE[c.level + 1] || (curFloor + 1);
  const pct = Math.min(100, Math.round(((c.total_xp - curFloor) / (nextNeed - curFloor)) * 100));
  document.getElementById('lvlFill').style.width = pct + '%';
}

// ===================== ATTRIBUTES =====================
function renderAttributes() {
  const container = document.getElementById('attrs-container');
  const byCat = {};
  cache.attrs.forEach(a => { (byCat[a.category] = byCat[a.category] || []).push(a); });
  container.innerHTML = Object.entries(byCat).map(([cat, list]) => `
    <div class="attr-cat">
      <h3>${cat}</h3>
      ${list.map(a => {
        const pct = Math.min(100, Math.round((a.xp / a.xp_needed) * 100));
        return `
        <div class="attr-row">
          <div class="top"><span class="name">${a.name}</span><span class="val">${a.value}</span></div>
          <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
          <div class="attr-meta"><span>${Math.round(a.xp)} / ${Math.round(a.xp_needed)} XP</span><span>Next: ${a.value + 1}</span></div>
          <div class="train-row">
            <button class="ghost discount train-sm" data-id="${a.id}" data-cost="50" data-xp="10">Train +10 XP (50 VC)</button>
            <button class="ghost discount train-lg" data-id="${a.id}" data-cost="220" data-xp="50">Train +50 XP (220 VC)</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `).join('');
  container.querySelectorAll('.train-sm, .train-lg').forEach(btn => btn.addEventListener('click', () => trainAttribute(btn.dataset.id, Number(btn.dataset.cost), Number(btn.dataset.xp))));
}

async function trainAttribute(attrId, vcCost, xpGain) {
  if (cache.career.vc < vcCost) { toast('Not enough VC'); return; }
  const attr = cache.attrs.find(a => a.id === attrId);
  let xp = attr.xp + xpGain, value = attr.value, xpNeeded = attr.xp_needed;
  while (xp >= xpNeeded && value < 99) { xp -= xpNeeded; value++; xpNeeded = xpNeededForAttr(value); }
  await supabase.from('attributes').update({ xp, value, xp_needed: xpNeeded }).eq('id', attrId);
  const newVc = cache.career.vc - vcCost;
  const newOvr = await recomputeOverall(newVc);
  await supabase.from('careers').update({ vc: newVc, overall: newOvr }).eq('id', currentCareerId);
  toast(`Trained ${attr.name} (+${xpGain} XP)`);
  refreshCareer();
}

async function recomputeOverall(vcOverride) {
  const { data: attrs } = await supabase.from('attributes').select('value').eq('career_id', currentCareerId);
  const avg = attrs.reduce((s, a) => s + a.value, 0) / attrs.length;
  return Math.round(avg);
}

// ===================== BADGES =====================
function renderBadges() {
  const container = document.getElementById('badges-container');
  const byCat = {};
  cache.badges.forEach(b => { (byCat[b.category] = byCat[b.category] || []).push(b); });
  container.innerHTML = Object.entries(byCat).map(([cat, list]) => `
    <div class="attr-cat">
      <h3>${cat}</h3>
      <div class="badge-grid">
        ${list.map(b => {
          const pct = b.tier === 'legend' ? 100 : Math.min(100, Math.round((b.xp / b.xp_needed) * 100));
          return `
          <div class="badge">
            <div class="name">${b.name}</div>
            <div class="tier-chip tier-${b.tier}">${b.tier.toUpperCase()}</div>
            <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `).join('');
}

// ===================== LOG GAME =====================
function statCategoryPools(s) {
  const finishing = (s.fgm - s.tpm) * 3;
  const shooting = s.tpm * 5 + s.ftm * 1.5;
  const playmaking = Math.max(0, s.ast * 4 - s.tov * 1.5);
  const defense = s.stl * 6 + s.blk * 6;
  const rebounding = s.reb * 3;
  const physical = (s.pts + s.reb + s.ast + s.stl + s.blk) * 0.3;

  const milestoneHits = [s.pts >= 10, s.reb >= 10, s.ast >= 10, s.stl >= 10, s.blk >= 10].filter(Boolean).length;
  let bonus = 0;
  if (milestoneHits >= 4) bonus += 900;
  else if (milestoneHits >= 3) bonus += 400;
  else if (milestoneHits >= 2) bonus += 150;
  if (s.win) bonus += 50;
  if (s.playoff) bonus += 100;
  if (s.finals) bonus += 250;
  if (s.championship) bonus += 1000;
  if (s.clutch) bonus += 150;
  if (s.player_of_game) bonus += 300;
  const bonusEach = bonus / 6;

  return {
    Finishing: finishing + bonusEach, Shooting: shooting + bonusEach, Playmaking: playmaking + bonusEach,
    Defense: defense + bonusEach, Rebounding: rebounding + bonusEach, Physical: physical + bonusEach
  };
}

async function submitGame() {
  const s = {
    opponent: document.getElementById('in-opp').value || 'Opponent',
    minutes: Number(document.getElementById('in-min').value) || 0,
    plus_minus: Number(document.getElementById('in-pm').value) || 0,
    pts: Number(document.getElementById('in-pts').value) || 0,
    reb: Number(document.getElementById('in-reb').value) || 0,
    ast: Number(document.getElementById('in-ast').value) || 0,
    stl: Number(document.getElementById('in-stl').value) || 0,
    blk: Number(document.getElementById('in-blk').value) || 0,
    tov: Number(document.getElementById('in-tov').value) || 0,
    fgm: Number(document.getElementById('in-fgm').value) || 0,
    fga: Number(document.getElementById('in-fga').value) || 0,
    tpm: Number(document.getElementById('in-tpm').value) || 0,
    tpa: Number(document.getElementById('in-tpa').value) || 0,
    ftm: Number(document.getElementById('in-ftm').value) || 0,
    fta: Number(document.getElementById('in-fta').value) || 0,
    win: document.getElementById('in-win').checked,
    playoff: document.getElementById('in-playoff').checked,
    finals: document.getElementById('in-finals').checked,
    championship: document.getElementById('in-champ').checked,
    clutch: document.getElementById('in-clutch').checked,
    player_of_game: document.getElementById('in-potg').checked
  };

  const pools = statCategoryPools(s);
  const totalXp = Object.values(pools).reduce((a, b) => a + b, 0);

  // Distribute to attributes (Defense attrs absorb Defense+Rebounding pools, Athleticism absorbs Physical)
  const attrPools = {
    Finishing: pools.Finishing, Shooting: pools.Shooting, Playmaking: pools.Playmaking,
    Defense: pools.Defense + pools.Rebounding, Athleticism: pools.Physical
  };
  for (const [cat, names] of Object.entries(ATTRIBUTE_DEFS)) {
    const share = attrPools[cat] / names.length;
    const rows = cache.attrs.filter(a => a.category === cat);
    for (const a of rows) {
      let xp = a.xp + share, value = a.value, xpNeeded = a.xp_needed;
      while (xp >= xpNeeded && value < 99) { xp -= xpNeeded; value++; xpNeeded = xpNeededForAttr(value); }
      await supabase.from('attributes').update({ xp, value, xp_needed: xpNeeded }).eq('id', a.id);
    }
  }

  // Distribute to badges (own 6 categories)
  for (const [cat, names] of Object.entries(BADGE_DEFS)) {
    const share = pools[cat] / names.length;
    const rows = cache.badges.filter(b => b.category === cat);
    for (const b of rows) {
      let xp = b.xp + share, tier = b.tier, xpNeeded = b.xp_needed;
      let tierIdx = TIERS.indexOf(tier);
      while (xp >= xpNeeded && tierIdx < TIERS.length - 1) {
        xp -= xpNeeded; tierIdx++; tier = TIERS[tierIdx]; xpNeeded = TIER_THRESHOLDS[tier];
      }
      await supabase.from('badges').update({ xp, tier, xp_needed: xpNeeded }).eq('id', b.id);
    }
  }

  const newTotalXp = cache.career.total_xp + totalXp;
  const newLevel = levelForTotalXp(newTotalXp);
  const newOvr = await recomputeOverall();

  await supabase.from('game_logs').insert({ career_id: currentCareerId, season: cache.career.season, xp_earned: totalXp, ...s });
  await supabase.from('careers').update({ total_xp: newTotalXp, level: newLevel, overall: newOvr }).eq('id', currentCareerId);

  toast(`Game logged: +${Math.round(totalXp)} XP`);
  refreshCareer();
}

// ===================== CONTRACT =====================
function renderContract() {
  const el = document.getElementById('contract-current');
  const c = cache.contracts[0];
  if (!c) { el.innerHTML = `<div class="empty">No contract on file.</div>`; return; }
  el.innerHTML = `
    <div class="stat-line"><span>Salary</span><span class="v">$${Number(c.salary).toLocaleString()}</span></div>
    <div class="stat-line"><span>Years Remaining</span><span class="v">${c.years_remaining}</span></div>
    <div class="stat-line"><span>Team Option</span><span class="v">${c.team_option ? 'Yes' : 'No'}</span></div>
    <div class="stat-line"><span>Player Option</span><span class="v">${c.player_option ? 'Yes' : 'No'}</span></div>
    <div class="stat-line"><span>No-Trade Clause</span><span class="v">${c.no_trade_clause ? 'Yes' : 'No'}</span></div>
    <div class="stat-line"><span>Signing Bonus</span><span class="v">$${Number(c.bonuses).toLocaleString()}</span></div>
  `;
}

async function signContract() {
  const team = document.getElementById('in-team').value || cache.career.team;
  const salary = Number(document.getElementById('in-salary').value) || 0;
  const years = Number(document.getElementById('in-years').value) || 1;
  const bonus = Number(document.getElementById('in-bonus').value) || 0;
  await supabase.from('contracts').insert({
    career_id: currentCareerId, season: cache.career.season, salary, years_remaining: years, bonuses: bonus,
    team_option: document.getElementById('in-teamopt').checked,
    player_option: document.getElementById('in-playeropt').checked,
    no_trade_clause: document.getElementById('in-notrade').checked
  });
  await supabase.from('careers').update({ team, vc: cache.career.vc + bonus }).eq('id', currentCareerId);
  toast('Contract signed');
  refreshCareer();
}

// ===================== SEASONS / AWARDS =====================
function renderSeasons() {
  const logs = cache.logs;
  const totalsEl = document.getElementById('career-totals');
  if (!logs.length) { totalsEl.innerHTML = `<div class="empty">No games logged yet.</div>`; }
  else {
    const sum = (k) => logs.reduce((a, l) => a + Number(l[k] || 0), 0);
    const g = logs.length;
    totalsEl.innerHTML = `
      <div class="stat-line"><span>Games Played</span><span class="v">${g}</span></div>
      <div class="stat-line"><span>PPG / RPG / APG</span><span class="v">${(sum('pts')/g).toFixed(1)} / ${(sum('reb')/g).toFixed(1)} / ${(sum('ast')/g).toFixed(1)}</span></div>
      <div class="stat-line"><span>SPG / BPG</span><span class="v">${(sum('stl')/g).toFixed(1)} / ${(sum('blk')/g).toFixed(1)}</span></div>
      <div class="stat-line"><span>Career Points</span><span class="v">${sum('pts').toLocaleString()}</span></div>
      <div class="stat-line"><span>Wins</span><span class="v">${logs.filter(l => l.win).length}</span></div>
      <div class="stat-line"><span>Championships</span><span class="v">${logs.filter(l => l.championship).length}</span></div>
    `;
  }

  const bySeason = {};
  logs.forEach(l => { (bySeason[l.season] = bySeason[l.season] || []).push(l); });
  const seasonEl = document.getElementById('season-breakdown');
  const seasonKeys = Object.keys(bySeason).sort((a, b) => b - a);
  if (!seasonKeys.length) { seasonEl.innerHTML = `<div class="empty">No seasons yet.</div>`; }
  else {
    seasonEl.innerHTML = seasonKeys.map(sn => {
      const l = bySeason[sn]; const g = l.length;
      const avg = (k) => (l.reduce((a, x) => a + Number(x[k] || 0), 0) / g).toFixed(1);
      return `<div class="stat-line"><span>Season ${sn} (${g} gm)</span><span class="v">${avg('pts')} / ${avg('reb')} / ${avg('ast')}</span></div>`;
    }).join('');
  }

  const awardsEl = document.getElementById('awards-list');
  awardsEl.innerHTML = cache.awards.map(a => `
    <div class="award-row"><span>${a.award_name}</span><span class="season-tag">Season ${a.season}</span></div>
  `).join('') || '';
}

async function addAward() {
  const name = document.getElementById('in-award').value;
  await supabase.from('awards').insert({ career_id: currentCareerId, season: cache.career.season, award_name: name });
  toast(`Added: ${name}`);
  refreshCareer();
}

async function advanceSeason() {
  if (!confirm('Advance to next season? This adds a year to your pro career.')) return;
  const contract = cache.contracts[0];
  let vcAdd = 0;
  if (contract && contract.years_remaining > 0) {
    vcAdd = Number(contract.salary);
    await supabase.from('contracts').update({ years_remaining: contract.years_remaining - 1 }).eq('id', contract.id);
  }
  await supabase.from('careers').update({
    season: cache.career.season + 1, years_pro: cache.career.years_pro + 1, vc: cache.career.vc + vcAdd
  }).eq('id', currentCareerId);
  toast(`Season advanced. +$${vcAdd.toLocaleString()} VC from salary.`);
  refreshCareer();
}

// ===================== HISTORY =====================
function renderHistory() {
  const el = document.getElementById('history-container');
  if (!cache.logs.length) { el.innerHTML = `<div class="empty">No games logged yet.</div>`; return; }
  el.innerHTML = cache.logs.map(l => `
    <div class="log-row">
      <div>
        <div>${l.opponent || 'Game'} — S${l.season} <span class="stats">${l.played_at}</span></div>
        <div class="stats">${l.pts}p ${l.reb}r ${l.ast}a ${l.stl}s ${l.blk}b ${l.win ? '· W' : '· L'}${l.championship ? ' · 🏆' : ''}</div>
      </div>
      <div class="xp">+${Math.round(l.xp_earned)} XP</div>
    </div>
  `).join('');
}

// ===================== VC =====================
async function addVc() {
  const amt = Number(document.getElementById('in-vc-add').value) || 0;
  if (amt <= 0) return;
  await supabase.from('careers').update({ vc: cache.career.vc + amt }).eq('id', currentCareerId);
  document.getElementById('in-vc-add').value = 0;
  toast(`+$${amt.toLocaleString()} VC added`);
  refreshCareer();
}

// ===================== NAV / EVENTS =====================
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  tab.classList.add('active');
  document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
}));

document.getElementById('btn-back-home').addEventListener('click', () => {
  document.getElementById('screen-career').style.display = 'none';
  document.getElementById('screen-home').style.display = 'block';
  loadCareerSlots();
});

document.getElementById('btn-new-career').addEventListener('click', () => {
  const name = prompt('Player name?', 'My Player');
  if (name !== null) createCareer(name);
});

document.getElementById('file-import').addEventListener('change', (e) => {
  if (e.target.files[0]) importCareerFile(e.target.files[0]);
});

document.getElementById('btn-submit-game').addEventListener('click', submitGame);
document.getElementById('btn-add-vc').addEventListener('click', addVc);
document.getElementById('btn-sign-contract').addEventListener('click', signContract);
document.getElementById('btn-add-award').addEventListener('click', addAward);
document.getElementById('btn-advance-season').addEventListener('click', advanceSeason);

// ===================== INIT =====================
loadCareerSlots();
