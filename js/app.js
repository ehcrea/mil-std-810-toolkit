/*
 * User interface: life-cycle questionnaire, test plan, profile viewer and
 * chart, shaker check, shock section, PSD calculator, time compression,
 * sharing, CSV export, theme and dialogs.
 */
(function () {
  'use strict';
  const D = window.MIL_DATA, M = window.MIL;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmt = (x, d = 2) => Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const sig = (x, n = 3) => {
    if (!Number.isFinite(x)) return '—';
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a < 1e-3 || a >= 1e5) return x.toExponential(n - 1).replace('e', 'E');
    return Number(x.toPrecision(n)).toString();
  };
  const dur = (min) => {
    if (!Number.isFinite(min)) return '—';
    if (min < 1) return fmt(min * 60, 0) + ' s';
    if (min < 90) return fmt(min, min < 10 ? 1 : 0) + ' min';
    return fmt(min / 60, min < 600 ? 2 : 1) + ' h';
  };
  const AXES = { V: 'Vertical', T: 'Transverse', L: 'Longitudinal', E: 'Envelope (all axes)' };

  // ---------------------------------------------------------------------------
  // Questionnaire definition
  // ---------------------------------------------------------------------------
  const PHASES = [
    { id: 'truck', group: 'Transport', title: 'Commercial truck, paved highways', desc: 'Shipping by road from the factory to a depot or customer.',
      fields: [{ key: 'truckKm', label: 'Distance', unit: 'km', def: 1609, min: 1 }] },
    { id: 'cwv', group: 'Transport', title: 'Military wheeled vehicle (secured cargo)', desc: 'Tactical trucks and trailers on secondary roads and cross-country.',
      fields: [{ key: 'cwvKm', label: 'Distance', unit: 'km', def: 804, min: 1 }] },
    { id: 'loose', group: 'Transport', title: 'Loose cargo on a truck bed', desc: 'Unrestrained, free to bounce (package tester).',
      fields: [{ key: 'looseKm', label: 'Distance', unit: 'km', def: 240, min: 1 }] },
    { id: 'jet', group: 'Transport', title: 'Jet aircraft cargo', desc: 'Air transport as cargo on the cargo floor.',
      fields: [
        { key: 'jetAc', label: 'Aircraft', type: 'select', def: 'general', options: () => Object.entries(D.PROFILES.jetCargo.variants).map(([k, v]) => [k, v.name]) },
        { key: 'jetN', label: 'Take-offs', unit: '', def: 10, min: 1, step: 1 },
      ] },
    { id: 'heli', group: 'Operation', title: 'Installed in or carried on a helicopter', desc: 'Sine tones at rotor frequencies over random (Category 14).',
      fields: [
        { key: 'heliAc', label: 'Helicopter', type: 'select', def: 'uh1', options: () => D.HELI.aircraft.map((a) => [a.id, a.name]) },
        { key: 'heliLoc', label: 'Location', type: 'select', def: 'general', options: () => Object.entries(D.HELI.locations).map(([k, v]) => [k, v.name]) },
        { key: 'heliSrc', label: 'Tone source', type: 'select', def: 'main', options: () => [['main', 'Main rotor'], ['tail', 'Tail rotor (in tail rotor plane)'], ['both', 'Main + tail (overlap zone)']], when: (s) => s.heliLoc !== 'drive' },
        { key: 'heliShaft', label: 'Shaft speed 1S', unit: 'Hz', def: 100, min: 1, when: (s) => s.heliLoc === 'drive' },
        { key: 'heliHours', label: 'Flight hours in life', unit: 'h', def: 2500, min: 1 },
        { key: 'heliP', label: 'Main rotor 1P', unit: 'Hz', def: 4.3, min: 0.5, when: (s) => s.heliAc === 'custom' },
        { key: 'heliN', label: 'Main blades n', unit: '', def: 4, min: 1, step: 1, when: (s) => s.heliAc === 'custom' },
        { key: 'heliT', label: 'Tail rotor 1T', unit: 'Hz', def: 19.8, min: 0.5, when: (s) => s.heliAc === 'custom' },
        { key: 'heliM', label: 'Tail blades m', unit: '', def: 4, min: 1, step: 1, when: (s) => s.heliAc === 'custom' },
      ] },
    { id: 'mit', group: 'Operation', title: 'Environment unknown: minimum integrity', desc: 'Baseline test when the life cycle cannot be defined yet.',
      fields: [{ key: 'mitType', label: 'Test', type: 'select', def: 'general', options: () => [['general', 'General (random, 7.7 Grms)'], ['heli', 'Helicopter (swept sine)']] }] },
    { id: 'func', group: 'Shock & handling', title: 'Operational shock (functional)', desc: 'Shocks the item must survive while working.' },
    { id: 'crash', group: 'Shock & handling', title: 'Crash hazard', desc: 'Mounted where it could injure people if it breaks loose in a crash.' },
    { id: 'drop', group: 'Shock & handling', title: 'Handled and shipped (transit drop)', desc: 'Drops during loading, unloading and carrying, as transported.' },
    { id: 'bench', group: 'Shock & handling', title: 'Serviced on a workbench', desc: 'Bench handling drops during maintenance.' },
  ];
  const FIELD = {};
  PHASES.forEach((p) => (p.fields || []).forEach((f) => (FIELD[f.key] = f)));

  const DEFAULT = {
    on: ['truck', 'cwv', 'func', 'drop', 'bench'],
    mass: 12, dim: 60, orient: 'known', platform: 'ground', truckOnly: false,
    shMass: 8, shForce: 4000, shStroke: 51, shVel: 1.8,
    view: null,
  };
  Object.values(FIELD).forEach((f) => (DEFAULT[f.key] = f.def));

  const PRESETS = [
    { name: 'Rugged laptop / handheld', s: { on: ['truck', 'cwv', 'func', 'drop', 'bench'], mass: 3, dim: 40, orient: 'unknown', platform: 'ground' } },
    { name: 'Vehicle-mounted computer, 30 kg', s: { on: ['truck', 'cwv', 'func', 'crash', 'drop', 'bench'], mass: 30, dim: 55, orient: 'known', platform: 'ground', cwvKm: 1608 } },
    { name: 'Helicopter avionics LRU', s: { on: ['truck', 'jet', 'heli', 'func', 'crash', 'drop', 'bench'], mass: 8, dim: 45, platform: 'flight', heliAc: 'ah64l', heliLoc: 'general', jetAc: 'c17', jetN: 20 } },
    { name: 'Shelter rack equipment, 150 kg', s: { on: ['truck', 'cwv', 'func', 'drop'], mass: 150, dim: 120, orient: 'known', platform: 'ground', truckOnly: true } },
    { name: 'Early prototype, unknown use', s: { on: ['mit', 'drop'], mass: 5, dim: 30 } },
  ];

  let state = JSON.parse(JSON.stringify(DEFAULT));

  // ---------------------------------------------------------------------------
  // URL state
  // ---------------------------------------------------------------------------
  function readUrl() {
    const q = new URLSearchParams(location.search);
    if (!q.toString()) return;
    if (q.has('on')) state.on = q.get('on').split(',').filter((id) => PHASES.some((p) => p.id === id));
    for (const k of Object.keys(DEFAULT)) {
      if (k === 'on' || !q.has(k)) continue;
      const v = q.get(k);
      if (typeof DEFAULT[k] === 'number') { const n = parseFloat(v); if (Number.isFinite(n)) state[k] = n; }
      else if (typeof DEFAULT[k] === 'boolean') state[k] = v === '1';
      else state[k] = v;
    }
  }
  function shareUrl() {
    const q = new URLSearchParams();
    q.set('on', state.on.join(','));
    for (const k of Object.keys(DEFAULT)) {
      if (k === 'on' || state[k] === DEFAULT[k] || state[k] == null) continue;
      q.set(k, typeof state[k] === 'boolean' ? (state[k] ? '1' : '0') : state[k]);
    }
    return location.origin + location.pathname + '?' + q.toString();
  }

  // ---------------------------------------------------------------------------
  // Inputs
  // ---------------------------------------------------------------------------
  function buildPhases() {
    let html = '', group = '';
    for (const p of PHASES) {
      if (p.group !== group) { group = p.group; html += `<div class="phase-group">${esc(group)}</div>`; }
      html += `<div class="phase" data-id="${p.id}">
        <label class="phase-head"><input type="checkbox" data-phase="${p.id}">
          <span><b>${esc(p.title)}</b><small>${esc(p.desc)}</small></span></label>
        <div class="phase-opts"></div></div>`;
    }
    $('#phases').innerHTML = html;
  }

  function renderPhaseOpts() {
    for (const p of PHASES) {
      const box = $(`.phase[data-id="${p.id}"]`);
      const on = state.on.includes(p.id);
      box.classList.toggle('on', on);
      $('input[data-phase]', box).checked = on;
      const opts = $('.phase-opts', box);
      if (!on || !p.fields) { opts.innerHTML = ''; opts.hidden = true; continue; }
      opts.hidden = false;
      const html = p.fields.filter((f) => !f.when || f.when(state)).map((f) => {
        if (f.type === 'select') {
          return `<label>${esc(f.label)}<select data-key="${f.key}">${f.options().map(([v, n]) => `<option value="${esc(v)}"${String(state[f.key]) === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
        }
        return `<label><span class="lt">${esc(f.label)} ${f.unit ? `<span class="u">${esc(f.unit)}</span>` : ''}</span><input type="number" data-key="${f.key}" min="${f.min || 0}" step="${f.step || 'any'}" value="${state[f.key]}"></label>`;
      }).join('');
      // Only rebuild when the set of fields changed, so typing keeps focus.
      const sig = p.fields.filter((f) => !f.when || f.when(state)).map((f) => f.key).join();
      if (opts.dataset.sig !== sig) { opts.innerHTML = html; opts.dataset.sig = sig; }
      else $$('[data-key]', opts).forEach((el) => { if (document.activeElement !== el) el.value = state[el.dataset.key]; });
    }
  }

  function syncInputs() {
    $('#mass').value = state.mass; $('#dim').value = state.dim;
    $('#truckOnly').checked = state.truckOnly;
    $('#sh-mass').value = state.shMass; $('#sh-force').value = state.shForce;
    $('#sh-stroke').value = state.shStroke; $('#sh-vel').value = state.shVel;
    $$('#orient button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === state.orient)));
    $$('#platform button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === state.platform)));
    renderPhaseOpts();
  }

  // ---------------------------------------------------------------------------
  // Build the test plan from the state
  // ---------------------------------------------------------------------------
  function heliAircraft() {
    const ac = D.HELI.aircraft.find((a) => a.id === state.heliAc) || D.HELI.aircraft[0];
    if (ac.id !== 'custom') return ac;
    return { ...ac, p: state.heliP, n: Math.max(1, Math.round(state.heliN)), t: state.heliT, m: Math.max(1, Math.round(state.heliM)) };
  }

  function axisSet(prof) {
    if (state.orient === 'unknown' && prof.envelope) return [{ axis: 'E', curve: prof.envelope }];
    return ['V', 'T', 'L'].map((a) => ({ axis: a, curve: prof.axes[a] }));
  }

  function buildPlan() {
    const vib = [], shock = [];
    const on = (id) => state.on.includes(id);

    for (const id of ['truck', 'cwv']) {
      if (!on(id)) continue;
      const prof = D.PROFILES[id === 'truck' ? 'commonCarrier' : 'cwv'];
      const km = id === 'truck' ? state.truckKm : state.cwvKm;
      const per = M.profileMinutes(prof, km);
      const curves = axisSet(prof).map((c) => ({ ...c, stats: M.psdStats(c.curve.pts) }));
      vib.push({
        id, kind: 'random', name: prof.name, ref: state.orient === 'unknown' ? prof.ref.split(',').slice(0, 2).join(',') + ', ' + prof.envRef : prof.ref,
        prof, curves, perAxis: per, axes: 3, total: per * 3,
        level: Math.max(...curves.map((c) => c.stats.grms)),
        qty: `${fmt(km, 0)} km`, durNote: prof.duration.label,
        notes: prof.notes,
      });
    }
    if (on('loose')) {
      const L = D.LOOSE_CARGO;
      const per = L.minutes * state.looseKm / L.perKm;
      vib.push({ id: 'loose', kind: 'pkg', name: 'Loose cargo (bounce)', ref: L.ref, perAxis: per, axes: 1, total: per, level: null,
        qty: `${fmt(state.looseKm, 0)} km`, levelText: '2.54 cm orbit, 5 Hz', notes: [L.text] });
    }
    if (on('jet')) {
      const prof = D.PROFILES.jetCargo;
      const v = prof.variants[state.jetAc] || prof.variants.general;
      const per = M.profileMinutes(prof, state.jetN);
      const curves = [{ axis: 'E', curve: v, label: v.name, stats: M.psdStats(v.pts) }];
      vib.push({ id: 'jet', kind: 'random', name: prof.name + ' — ' + v.name, ref: prof.ref, prof, curves, perAxis: per, axes: 3, total: per * 3,
        level: curves[0].stats.grms, qty: `${fmt(state.jetN, 0)} take-offs`, durNote: prof.duration.label, notes: prof.notes });
    }
    if (on('heli')) {
      const ac = heliAircraft();
      const src = state.heliSrc === 'both' ? ['main', 'tail'] : [state.heliSrc];
      const h = M.helicopter(D.HELI, { location: state.heliLoc, aircraft: ac, sources: src, flightHours: state.heliHours, shaftHz: state.heliShaft });
      const stats = M.psdStats(h.pts);
      vib.push({ id: 'heli', kind: 'sor', name: `Helicopter ${ac.id === 'custom' ? '(custom rotor)' : ac.name} — ${h.loc.name}`, ref: D.HELI.ref, heli: h, ac,
        curves: [{ axis: 'E', curve: { pts: h.pts }, stats }], perAxis: h.hours * 60, axes: 3, total: h.hours * 180,
        level: h.totalGrms, qty: `${fmt(state.heliHours, 0)} flight h`, durNote: '4 h per axis = 2500 flight hours; minimum 0.5 h', notes: D.HELI.notes });
    }
    if (on('mit')) {
      if (state.mitType === 'heli') {
        vib.push({ id: 'mitHeli', kind: 'sine', name: 'Helicopter minimum integrity (swept sine)', ref: D.HELI_MIT.ref, perAxis: 180, axes: 3, total: 540,
          level: null, levelText: '2–5 g peak', qty: '—', durNote: D.HELI_MIT.sweep + '; ' + D.HELI_MIT.duration,
          notes: ['Swept sine 5–500 Hz: 5.1 mm double amplitude to 14 Hz, 2 g to 33 Hz, 0.91 mm double amplitude to 52.1 Hz, then 5 g to 500 Hz.', ...D.PROFILES.mitGeneral.notes] });
      } else {
        const prof = D.PROFILES.mitGeneral;
        const curves = [{ axis: 'E', curve: prof.single, stats: M.psdStats(prof.single.pts) }];
        vib.push({ id: 'mit', kind: 'random', name: prof.name, ref: prof.ref, prof, curves, perAxis: 60, axes: 3, total: 180,
          level: curves[0].stats.grms, qty: '—', durNote: prof.duration.label, notes: prof.notes });
      }
    }

    // Shock
    const S = D.SHOCK, plat = state.platform === 'flight' ? 'Flight' : 'Ground';
    if (on('func')) {
      const srs = S.srs.find((r) => r.id === 'func' + plat);
      const saw = { ...S.sawtooth.find((r) => r.id === 'func' + plat) };
      if (plat === 'Ground' && state.truckOnly) saw.g = 20;
      shock.push({ id: 'func', name: 'Functional shock', proc: 'Procedure I', srs, saw, count: '18 shocks (3 each direction × 3 axes)' });
    }
    if (on('crash')) {
      const srs = S.srs.find((r) => r.id === 'crash' + plat);
      const saw = S.sawtooth.find((r) => r.id === 'crash' + plat);
      shock.push({ id: 'crash', name: 'Crash hazard shock', proc: 'Procedure V', srs, saw, count: '18 shocks (3 each direction × 3 axes)' });
    }
    if (on('drop')) shock.push({ id: 'drop', name: 'Transit drop', proc: 'Procedure IV', drop: M.transitDrop(S, state.mass, state.dim) });
    if (on('bench')) shock.push({ id: 'bench', name: 'Bench handling', proc: 'Procedure VI' });

    return { vib, shock };
  }

  // ---------------------------------------------------------------------------
  // Chart (log-log)
  // ---------------------------------------------------------------------------
  const COLORS = { V: 'var(--s1)', T: 'var(--s2)', L: 'var(--s3)', E: 'var(--s1)' };
  function logTicks(lo, hi) {
    const t = [];
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) t.push(Math.pow(10, e));
    return t;
  }
  function chart(el, series, opts = {}) {
    const W = 760, H = 330, ml = 62, mr = opts.tones ? 58 : 18, mt = 14, mb = 40;
    const allF = [], allW = [];
    series.forEach((s) => s.pts.forEach((p) => { allF.push(p.f); if (p.w > 0) allW.push(p.w); }));
    if (opts.tones) opts.tones.forEach((t) => allF.push(t.f));
    if (!allF.length) { el.innerHTML = '<p class="hint">No curve to plot.</p>'; return; }
    const fLo = Math.pow(10, Math.floor(Math.log10(Math.min(...allF)))), fHi = Math.pow(10, Math.ceil(Math.log10(Math.max(...allF))));
    let wLo = Math.pow(10, Math.floor(Math.log10(Math.min(...allW)))), wHi = Math.pow(10, Math.ceil(Math.log10(Math.max(...allW))));
    if (wHi / wLo < 100) wLo = wHi / 100;
    const X = (f) => ml + (Math.log10(f) - Math.log10(fLo)) / (Math.log10(fHi) - Math.log10(fLo)) * (W - ml - mr);
    const Y = (w) => mt + (Math.log10(wHi) - Math.log10(w)) / (Math.log10(wHi) - Math.log10(wLo)) * (H - mt - mb);
    let g = '';
    // grid
    for (const d of logTicks(fLo, fHi)) {
      for (let k = 1; k < 10; k++) {
        const f = d * k; if (f < fLo || f > fHi) continue;
        g += `<line class="${k === 1 ? 'grid-major' : 'grid'}" x1="${X(f)}" x2="${X(f)}" y1="${mt}" y2="${H - mb}"/>`;
        if (k === 1) g += `<text class="tick" x="${X(f)}" y="${H - mb + 16}" text-anchor="middle">${f >= 1000 ? f / 1000 + 'k' : f}</text>`;
        if ((k === 2 || k === 5) && fHi / fLo <= 1000) g += `<text class="tick minor" x="${X(f)}" y="${H - mb + 16}" text-anchor="middle">${f >= 1000 ? f / 1000 + 'k' : f}</text>`;
      }
    }
    for (const d of logTicks(wLo, wHi)) {
      if (d < wLo || d > wHi) continue;
      for (let k = 1; k < 10; k++) {
        const w = d * k; if (w > wHi) break;
        g += `<line class="${k === 1 ? 'grid-major' : 'grid'}" x1="${ml}" x2="${W - mr}" y1="${Y(w)}" y2="${Y(w)}"/>`;
      }
      g += `<text class="tick" x="${ml - 6}" y="${Y(d) + 4}" text-anchor="end">${d >= 1 ? d : '10' + '<tspan dy="-5" font-size="9">' + Math.log10(d) + '</tspan>'}</text>`;
    }
    g += `<text class="axis-title" x="${(ml + W - mr) / 2}" y="${H - 6}" text-anchor="middle">Frequency (Hz)</text>`;
    g += `<text class="axis-title" transform="translate(14 ${(mt + H - mb) / 2}) rotate(-90)" text-anchor="middle">${esc(opts.yTitle || 'ASD (g²/Hz)')}</text>`;
    // tones on a right axis (peak g)
    if (opts.tones && opts.tones.length) {
      const aMax = Math.max(...opts.tones.map((t) => t.A), 0.1);
      const aHi = Math.pow(10, Math.ceil(Math.log10(aMax))), aLo = aHi / 1000;
      const YA = (a) => mt + (Math.log10(aHi) - Math.log10(Math.max(a, aLo))) / 3 * (H - mt - mb);
      for (const d of [aLo, aLo * 10, aLo * 100, aHi]) g += `<text class="tick tone-tick" x="${W - mr + 6}" y="${YA(d) + 4}">${sig(d, 1)}</text>`;
      g += `<text class="axis-title tone-tick" transform="translate(${W - 8} ${(mt + H - mb) / 2}) rotate(90)" text-anchor="middle">Sine tone (g peak)</text>`;
      for (const t of opts.tones) {
        const cls = t.inBand ? 'tone' : 'tone out';
        g += `<line class="${cls}" x1="${X(t.f)}" x2="${X(t.f)}" y1="${H - mb}" y2="${YA(t.A)}"/><circle class="${cls}-dot" cx="${X(t.f)}" cy="${YA(t.A)}" r="4"/>`;
        g += `<text class="tone-label" x="${X(t.f) + 5}" y="${YA(t.A) - 6}">${esc(t.label)}</text>`;
      }
    }
    // series
    for (const s of series) {
      const d = s.pts.map((p, i) => (i ? 'L' : 'M') + X(p.f).toFixed(1) + ' ' + Y(Math.max(p.w, wLo)).toFixed(1)).join(' ');
      g += `<path class="curve${s.dash ? ' dash' : ''}" style="stroke:${s.color}" d="${d}"/>`;
    }
    const legend = series.length > 1 || opts.tones ? `<div class="chart-legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}${opts.tones ? '<span><i class="k-tone"></i>Sine tones (right axis)</span>' : ''}</div>` : '';
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Spectrum')}">${g}</svg>${legend}`;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  let plan = null;

  function render() {
    plan = buildPlan();
    renderPhaseOpts();
    renderHero();
    renderIssues();
    renderPlan();
    renderViewer();
    renderShock();
    renderCompression();
  }

  function renderHero() {
    const shakerMin = plan.vib.filter((v) => v.kind !== 'pkg').reduce((s, v) => s + v.total, 0);
    $('#hero-value').textContent = plan.vib.length ? dur(shakerMin) : '—';
    $('#hero-sub').textContent = plan.vib.length ? `${plan.vib.filter((v) => v.kind !== 'pkg').length} vibration test(s), all axes, excluding set-up` : 'Tick a transport or operating phase to add vibration tests';
    const maxG = Math.max(0, ...plan.vib.filter((v) => v.level).map((v) => v.level));
    const maxShock = Math.max(0, ...plan.shock.filter((s) => s.saw).map((s) => s.saw.g));
    $('#hero-side').innerHTML = `
      <div><dt>Tests in plan</dt><dd>${plan.vib.length + plan.shock.length}</dd></div>
      <div><dt>Highest vibration</dt><dd>${maxG ? fmt(maxG, 2) + ' Grms' : '—'}</dd></div>
      <div><dt>Highest shock</dt><dd>${maxShock ? maxShock + ' g' : '—'}</dd></div>`;
  }

  function renderIssues() {
    const out = [];
    const on = (id) => state.on.includes(id);
    if (!state.on.length) out.push(['info', 'Tick at least one life-cycle phase to build a test plan.']);
    if (on('mit') && state.on.some((id) => ['truck', 'cwv', 'jet', 'heli'].includes(id))) out.push(['warn', 'Minimum integrity is meant for unknown environments. With tailored transport or operating profiles selected it is usually redundant.']);
    if (on('mit') && state.mass > 36) out.push(['warn', 'Minimum integrity tests are limited to about 36 kg (80 lb). Test larger materiel as subassemblies.']);
    if (on('crash') && state.platform === 'flight' && state.mass >= 136) out.push(['info', 'The 40 g / 11 ms crash hazard pulse is recommended for materiel under 136 kg (300 lb) that is not shock-mounted.']);
    if (on('heli') && state.heliHours * D.HELI.baseHours / D.HELI.lifeHours < D.HELI.minHours) out.push(['info', 'Short helicopter life: the 0.5 h per axis minimum governs, so the levels are reduced by the fatigue relation (sine m = 6, random m = 7.5).']);
    if (state.orient === 'unknown' && (on('truck') || on('cwv'))) out.push(['info', 'Unknown orientation: the envelope curve is applied in all three axes.']);
    const box = $('#issues');
    box.hidden = !out.length;
    box.innerHTML = out.map(([c, m]) => `<div class="issue ${c}"><span class="tag">${c === 'warn' ? 'Note' : 'Info'}</span><span>${esc(m)}</span></div>`).join('');
  }

  function renderPlan() {
    const rows = [];
    for (const v of plan.vib) {
      const lvl = v.level ? fmt(v.level, 2) + ' Grms' + (v.kind === 'sor' ? ' <small>(incl. tones)</small>' : '') : esc(v.levelText || '');
      const axes = v.kind === 'pkg' ? 'Package tester' : v.curves && v.curves[0].axis !== 'E' ? 'V · T · L curves' : '3 axes, one curve';
      rows.push(`<tr class="click${state.view === v.id ? ' hl' : ''}" data-view="${v.id}"><td class="left"><b>${esc(v.name)}</b><small class="ref">${esc(v.ref)}</small></td>
        <td class="left">${v.kind === 'sor' ? 'Sine on random' : v.kind === 'sine' ? 'Swept sine' : v.kind === 'pkg' ? 'Bounce' : 'Random'}</td>
        <td>${lvl}</td><td class="left">${axes}</td><td>${esc(v.qty)}</td><td>${v.kind === 'pkg' ? '—' : dur(v.perAxis)}</td><td class="strong">${dur(v.total)}</td></tr>`);
    }
    for (const s of plan.shock) {
      let lvl = '', count = '';
      if (s.saw) { lvl = `${s.srs.peak} g SRS · or ${s.saw.g} g / ${s.saw.ms} ms sawtooth`; count = '18 shocks'; }
      else if (s.drop) { lvl = `${s.drop.cm} cm (${fmt(s.drop.cm / 2.54, 0)} in) drop`; count = s.drop.desc.split('—')[1] ? s.drop.desc.split('—')[1].trim().split(' (')[0] : ''; }
      else { lvl = '100 mm / 45° edge drops'; count = '4 per edge'; }
      rows.push(`<tr class="shock-row" data-shock="${s.id}"><td class="left"><b>${esc(s.name)}</b><small class="ref">Method 516.8, ${esc(s.proc)}</small></td>
        <td class="left">Shock</td><td>${esc(lvl)}</td><td class="left">${s.saw ? '± each axis' : s.drop ? 'Faces / edges / corners' : 'Bench edges'}</td><td>—</td><td>—</td><td>${esc(count)}</td></tr>`);
    }
    $('#plan').innerHTML = rows.length ? `<table class="data plan">
      <thead><tr><th class="left">Test</th><th class="left">Type</th><th>Level</th><th class="left">Axes</th><th>Input</th><th>Per axis</th><th>Total</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table>` : '<p class="hint">No tests yet.</p>';
  }

  function currentView() {
    if (!plan.vib.length) return null;
    return plan.vib.find((v) => v.id === state.view) || plan.vib.find((v) => v.kind !== 'pkg') || plan.vib[0];
  }

  let viewAxis = null;
  function renderViewer() {
    const v = currentView();
    const card = $('#viewer');
    card.hidden = !v;
    if (!v) return;
    $('#viewer-select').innerHTML = plan.vib.map((x) => `<option value="${x.id}"${x.id === v.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
    $('#viewer-title').textContent = v.name;
    $('#viewer-ref').textContent = `MIL-STD-810H ${v.ref}. ${v.durNote || ''}`;
    $('#csv').hidden = !v.curves;
    $('#viewer-notes').innerHTML = v.notes.map((n) => `<li>${esc(n)}</li>`).join('');

    if (v.kind === 'pkg') {
      $('#viewer-opts').innerHTML = '';
      $('#chart').innerHTML = '';
      $('#viewer-metrics').innerHTML = metric('Motion', '2.54 cm circular orbit') + metric('Frequency', '5 Hz (300 rpm)') + metric('Duration', dur(v.total), `for ${v.qty}`);
      $('#viewer-table').innerHTML = '<p class="hint">Loose cargo uses a package tester with a circular synchronous table, not a breakpoint spectrum. Restrain the item only with fences, not fixed to the table.</p>';
      $('#shaker-box').innerHTML = '';
      return;
    }
    if (v.kind === 'sine') return renderHeliMit(v);

    // Axis selector for table
    const axes = v.curves.map((c) => c.axis);
    if (!axes.includes(viewAxis)) viewAxis = axes[0];
    $('#viewer-opts').innerHTML = axes.length > 1 ? `<div class="seg" role="radiogroup" id="axis-pick">${axes.map((a) => `<button type="button" role="radio" data-axis="${a}" aria-checked="${a === viewAxis}">${AXES[a]}</button>`).join('')}</div>` : '';

    const series = v.curves.map((c) => ({ name: c.axis === 'E' ? (c.label || 'All axes') : AXES[c.axis], pts: c.curve.pts, color: COLORS[c.axis] }));
    chart($('#chart'), series, { tones: v.kind === 'sor' ? v.heli.tones : null, label: v.name });

    const cur = v.curves.find((c) => c.axis === viewAxis);
    const st = cur.stats;
    let m = metric('Acceleration', fmt(st.grms, 2) + ' Grms', cur.curve.rms ? `standard prints ${cur.curve.rms} g` : 'random part')
      + metric('Velocity', fmt(st.vrms * 1000, 1) + ' mm/s rms')
      + metric('Displacement', fmt(st.dpp3 * 1000, 2) + ' mm p-p', '3σ, from 6 × rms')
      + metric('Band', `${sig(st.fmin)}–${sig(st.fmax)} Hz`)
      + metric('Duration', dur(v.perAxis) + ' / axis', `${dur(v.total)} total`);
    if (v.kind === 'sor') m = metric('Total', fmt(v.heli.totalGrms, 2) + ' Grms', 'random + tones') + metric('Peak tone', fmt(v.heli.peakSine, 2) + ' g', 'largest in-band A') + m;
    $('#viewer-metrics').innerHTML = m;

    // Breakpoint table
    const rows = M.withSlopes(cur.curve.pts).map((p) => `<tr><td>${sig(p.f, 5)}</td><td>${sig(p.w, 4)}</td><td>${p.slope == null ? '' : Number.isFinite(p.slope) ? fmt(p.slope, 2) : 'step'}</td></tr>`).join('');
    let table = `<table class="data"><thead><tr><th>Frequency (Hz)</th><th>ASD (g²/Hz)</th><th>Slope (dB/oct)</th></tr></thead><tbody>${rows}</tbody></table>`;
    if (v.kind === 'sor') {
      table += `<h3 class="sub-h">Sine tones</h3><table class="data"><thead><tr><th class="left">Tone</th><th>Frequency (Hz)</th><th>Peak (g)</th><th>Displ. (mm p-p)</th><th class="left">Applied</th></tr></thead><tbody>${v.heli.tones.map((t) => `<tr${t.inBand ? '' : ' class="muted"'}><td class="left">${esc(t.name)} = ${esc(t.label)}${t.source !== 'main' && t.source !== 'drive' ? ' (tail)' : ''}</td><td>${fmt(t.f, 2)}</td><td>${fmt(t.A, 3)}</td><td>${fmt(t.dpp * 1000, 2)}</td><td class="left">${t.inBand ? 'yes' : 'no (outside band)'}</td></tr>`).join('')}</tbody></table>
        <p class="hint">Amplitude law for this location: ${v.heli.loc.ampText.map(esc).join('; ')}.${v.heli.sineFactor < 1 ? ` Levels reduced to ${fmt(v.heli.sineFactor * 100, 1)} % (sine) and ${fmt(v.heli.randFactor * 100, 1)} % (random PSD) because the 0.5 h minimum governs.` : ''}</p>`;
    }
    $('#viewer-table').innerHTML = table;
    renderShaker(v);
  }

  function renderHeliMit(v) {
    $('#viewer-opts').innerHTML = '';
    const pts = [];
    for (const seg of D.HELI_MIT.segments) {
      for (let i = 0; i <= 20; i++) {
        const f = seg.f1 * Math.pow(seg.f2 / seg.f1, i / 20);
        pts.push({ f, w: M.heliMitAmp(seg, f) });
      }
    }
    chart($('#chart'), [{ name: 'Peak acceleration', pts, color: 'var(--s2)' }], { yTitle: 'Peak acceleration (g)', label: v.name });
    $('#viewer-metrics').innerHTML = metric('Sweep', '5 → 500 Hz', '30 min, logarithmic') + metric('Max displacement', '5.1 mm DA', '5–14 Hz') + metric('Max acceleration', '5 g peak', '52.1–500 Hz') + metric('Duration', 'up to 3 h / axis');
    $('#viewer-table').innerHTML = `<table class="data"><thead><tr><th>From (Hz)</th><th>To (Hz)</th><th class="left">Level</th></tr></thead><tbody>${D.HELI_MIT.segments.map((s) => `<tr><td>${s.f1}</td><td>${s.f2}</td><td class="left">${s.type === 'disp' ? s.da_mm + ' mm double amplitude' : s.g + ' g peak'}</td></tr>`).join('')}</tbody></table>`;
    const mass = state.mass + state.shMass;
    const F = mass * 5 * M.G0;
    $('#shaker-box').innerHTML = `<h3 class="sub-h">Shaker check</h3><table class="data"><tbody>
      ${checkRow('Sine force (5 g peak)', fmt(F, 0) + ' N pk', state.shForce ? F <= state.shForce * 1.4 : null, 'vs ~1.4 × random rating')}
      ${checkRow('Stroke', '5.1 mm p-p', state.shStroke ? 5.1 <= state.shStroke : null)}
    </tbody></table>`;
  }

  const metric = (k, v, s) => `<div class="metric"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>${s ? `<div class="s">${esc(s)}</div>` : ''}</div>`;
  const checkRow = (k, v, ok, note) => `<tr><td class="left">${esc(k)}</td><td>${esc(v)}</td><td class="left"><span class="status ${ok == null ? '' : ok ? 'ok' : 'over'}">${ok == null ? '—' : ok ? 'OK' : 'Exceeds'}</span>${note ? ` <small>${esc(note)}</small>` : ''}</td></tr>`;

  function renderShaker(v) {
    // Worst axis governs.
    const worst = v.curves.reduce((a, c) => (c.stats.grms > a.stats.grms ? c : a));
    const mass = state.mass + state.shMass;
    let force = mass * worst.stats.grms * M.G0, stroke = worst.stats.dpp3 * 1000, vel = 3 * worst.stats.vrms;
    let extra = '';
    if (v.kind === 'sor') {
      const tones = v.heli.tones.filter((t) => t.inBand);
      const sinePk = tones.reduce((s, t) => s + t.A, 0);
      force = mass * M.G0 * (worst.stats.grms + sinePk / Math.SQRT2);
      stroke += tones.reduce((s, t) => s + t.dpp * 1000, 0);
      vel += tones.reduce((s, t) => s + t.v, 0);
      extra = '<p class="hint">Sine-on-random: random 3σ values plus the sum of the tone peaks (conservative).</p>';
    }
    $('#shaker-box').innerHTML = `<h3 class="sub-h">Shaker check <small>(worst axis, moving mass ${fmt(mass, 1)} kg)</small></h3>
      <div class="table-wrap"><table class="data"><tbody>
      ${checkRow('Force', fmt(force, 0) + ' N rms', state.shForce ? force <= state.shForce : null, state.shForce ? fmt(force / state.shForce * 100, 0) + ' % of rating' : '')}
      ${checkRow('Stroke', fmt(stroke, 2) + ' mm p-p', state.shStroke ? stroke <= state.shStroke : null, state.shStroke ? fmt(stroke / state.shStroke * 100, 0) + ' % of stroke' : '')}
      ${checkRow('Velocity', fmt(vel, 2) + ' m/s pk', state.shVel ? vel <= state.shVel : null, '3σ')}
      </tbody></table></div>${extra}
      ${v.curves.some((c) => c.stats.fmin < 10) ? '<p class="hint">Content below 10 Hz drives the stroke. Many electrodynamic shakers need a long-stroke model or a slip table for these transport curves.</p>' : ''}`;
  }

  function renderShock() {
    const card = $('#shock-card');
    card.hidden = !plan.shock.length;
    if (!plan.shock.length) return;
    $('#shock-badge').textContent = state.platform === 'flight' ? 'Flight vehicle materiel' : 'Ground materiel';
    let html = '';
    const pulses = plan.shock.filter((s) => s.saw);
    if (pulses.length) {
      html += `<div class="table-wrap"><table class="data"><thead><tr><th class="left">Test</th><th>SRS peak</th><th>T<sub>e</sub> (ms)</th><th>Crossover (Hz)</th><th>Sawtooth</th><th>ΔV (m/s)</th><th>Equiv. drop</th></tr></thead><tbody>`;
      for (const s of pulses) {
        const p = M.pulse({ shape: 'sawtooth', g: s.saw.g, ms: s.saw.ms });
        html += `<tr><td class="left"><b>${esc(s.name)}</b><small class="ref">${esc(s.proc)} · ${esc(s.srs.who)}</small></td><td>${s.srs.peak} g</td><td>${esc(s.srs.te)}</td><td>${s.srs.fx}</td><td>${s.saw.g} g / ${s.saw.ms} ms</td><td>${fmt(p.dv, 2)}</td><td>${fmt(p.dropEq * 100, 1)} cm</td></tr>`;
      }
      html += `</tbody></table></div><div class="pulse-wrap">${pulseSvg(pulses.map((s) => s.saw))}</div>
        <p class="hint">Prefer the SRS (from measured data or the default levels above). Use the terminal-peak sawtooth when the equipment cannot reproduce an SRS. ${esc(D.SHOCK.shocksPerAxis)} ${pulses.some((s) => s.saw.note) ? esc(pulses.filter((s) => s.saw.note).map((s) => s.saw.note).join(' ')) : ''}${state.platform === 'ground' && state.truckOnly ? ' Functional level set to 20 g for truck / semi-trailer mounting.' : ''}</p>`;
    }
    const drop = plan.shock.find((s) => s.drop);
    if (drop) {
      const r = drop.drop;
      html += `<h3 class="sub-h">Transit drop — ${fmt(state.mass, 1)} kg, ${fmt(state.dim, 0)} cm</h3>
        <div class="metrics">${metric('Drop height', `${r.cm} cm (${fmt(r.cm / 2.54, 0)} in)`, 'onto the impact surface specified in 516.8') + metric('Mass class', r.mass) + metric('Size class', r.dim)}</div>
        <p class="drop-desc">${esc(r.desc)}. Test in the transport configuration (packaged or as carried), and check function after the drops.</p>
        <details class="sub"><summary>Full transit drop table</summary><div class="table-wrap"><table class="data"><thead><tr><th class="left">Mass (with case)</th><th class="left">Largest dimension</th><th>Height</th><th class="left">Drops</th></tr></thead><tbody>
        ${D.SHOCK.drop.map((d) => `<tr${d === r ? ' class="hl"' : ''}><td class="left">${esc(d.mass)}</td><td class="left">${esc(d.dim)}</td><td>${d.cm} cm</td><td class="wrap">${esc(d.desc)}</td></tr>`).join('')}</tbody></table></div></details>`;
    }
    if (plan.shock.some((s) => s.id === 'bench')) html += `<h3 class="sub-h">Bench handling</h3><p class="drop-desc">${esc(D.SHOCK.bench)}</p>`;
    $('#shock').innerHTML = html;
  }

  function pulseSvg(saws) {
    const W = 760, H = 150, ml = 46, mr = 16, mt = 12, mb = 28;
    const tMax = Math.max(...saws.map((s) => s.ms)) * 1.6, gMax = Math.max(...saws.map((s) => s.g)) * 1.15;
    const X = (t) => ml + t / tMax * (W - ml - mr), Y = (g) => mt + (1 - g / gMax) * (H - mt - mb);
    let s = '';
    for (let t = 0; t <= tMax; t += 2) s += `<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="${mt}" y2="${H - mb}"/><text class="tick" x="${X(t)}" y="${H - mb + 14}" text-anchor="middle">${t}</text>`;
    for (const g of [0, Math.round(gMax / 2), Math.round(gMax)]) s += `<line class="grid" x1="${ml}" x2="${W - mr}" y1="${Y(g)}" y2="${Y(g)}"/><text class="tick" x="${ml - 6}" y="${Y(g) + 4}" text-anchor="end">${g} g</text>`;
    const cols = ['var(--s1)', 'var(--s2)'];
    saws.forEach((p, i) => {
      const t0 = 1;
      s += `<path class="curve" style="stroke:${cols[i % 2]}" d="M${X(0)} ${Y(0)} L${X(t0)} ${Y(0)} L${X(t0 + p.ms)} ${Y(p.g)} L${X(t0 + p.ms * 1.1)} ${Y(0)} L${X(tMax)} ${Y(0)}"/>`;
      s += `<text class="tone-label" style="fill:${cols[i % 2]}" x="${X(t0 + p.ms) + 6}" y="${Y(p.g) + 4}">${p.g} g, ${p.ms} ms</text>`;
    });
    s += `<text class="axis-title" x="${(W) / 2}" y="${H - 2}" text-anchor="middle">Time (ms) — terminal-peak sawtooth</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sawtooth pulses">${s}</svg>`;
  }

  // ---------------------------------------------------------------------------
  // PSD calculator
  // ---------------------------------------------------------------------------
  function parsePsd(text) {
    const pts = [], bad = [];
    text.split(/\n/).forEach((line, i) => {
      const s = line.trim(); if (!s || s.startsWith('#')) return;
      const m = s.split(/[\s,;\t]+/).map(Number);
      if (m.length >= 2 && m[0] > 0 && m[1] > 0) pts.push({ f: m[0], w: m[1] });
      else bad.push(i + 1);
    });
    return { pts, bad };
  }
  function renderPsdTool() {
    const { pts: raw, bad } = parsePsd($('#psd-in').value);
    const db = parseFloat($('#psd-db').value) || 0;
    const pts = M.scalePsd(raw, Math.pow(10, db / 10));
    let ordered = true;
    for (let i = 1; i < pts.length; i++) if (pts[i].f < pts[i - 1].f) ordered = false;
    if (pts.length < 2 || !ordered) {
      $('#psd-metrics').innerHTML = `<div class="issue warn"><span class="tag">Input</span><span>${pts.length < 2 ? 'Enter at least two breakpoints.' : 'Frequencies must increase from line to line.'}</span></div>`;
      $('#psd-table').innerHTML = ''; $('#psd-chart').innerHTML = '';
      return;
    }
    const st = M.psdStats(pts);
    const mass = state.mass + state.shMass;
    $('#psd-metrics').innerHTML = metric('Acceleration', fmt(st.grms, 3) + ' Grms', db ? `scaled ${db > 0 ? '+' : ''}${db} dB` : '')
      + metric('Velocity', fmt(st.vrms * 1000, 1) + ' mm/s rms') + metric('Displacement', fmt(st.dpp3 * 1000, 3) + ' mm p-p', '3σ')
      + metric('Shaker force', fmt(mass * st.grms * M.G0, 0) + ' N rms', `moving mass ${fmt(mass, 1)} kg`)
      + (bad.length ? metric('Skipped lines', bad.join(', ')) : '');
    $('#psd-table').innerHTML = `<table class="data"><thead><tr><th>Hz</th><th>g²/Hz</th><th>dB/oct</th></tr></thead><tbody>${M.withSlopes(pts).map((p) => `<tr><td>${sig(p.f, 5)}</td><td>${sig(p.w, 4)}</td><td>${p.slope == null ? '' : Number.isFinite(p.slope) ? fmt(p.slope, 2) : 'step'}</td></tr>`).join('')}</tbody></table>`;
    chart($('#psd-chart'), [{ name: 'Custom', pts, color: 'var(--s4)' }], { label: 'Custom PSD' });
  }
  function loadViewedIntoPsd() {
    const v = currentView();
    if (!v || !v.curves) return toast('No breakpoint profile to load.');
    const c = v.curves.find((x) => x.axis === viewAxis) || v.curves[0];
    $('#psd-in').value = `# ${v.name} — ${AXES[c.axis]}\n` + c.curve.pts.map((p) => `${p.f}, ${p.w}`).join('\n');
    $('#psd-db').value = 0;
    $('#tool-psd').open = true;
    renderPsdTool();
    $('#tool-psd').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------------------------------------------------------------------------
  // Compression
  // ---------------------------------------------------------------------------
  function renderCompression() {
    const t1 = parseFloat($('#cp-t1').value), t2 = parseFloat($('#cp-t2').value), m = parseFloat($('#cp-m').value), type = $('#cp-type').value;
    if (!(t1 > 0 && t2 > 0 && m > 0)) { $('#cp-out').innerHTML = metric('Result', 'Enter positive values'); return; }
    const r = M.compress({ t1, t2, m, type });
    const v = currentView();
    let applied = '';
    if (type === 'random' && v && v.curves) {
      const c = v.curves.find((x) => x.axis === viewAxis) || v.curves[0];
      applied = metric('Viewed profile', `${fmt(c.stats.grms, 2)} → ${fmt(c.stats.grms * r.grmsRatio, 2)} Grms`, AXES[c.axis]);
    }
    $('#cp-out').innerHTML = type === 'sine'
      ? metric('Amplitude factor', '× ' + fmt(r.levelRatio, 3)) + metric('Level change', (r.db >= 0 ? '+' : '') + fmt(r.db, 2) + ' dB') + metric('Time ratio', fmt(t1 / t2, 2) + ' : 1')
      : metric('PSD factor', '× ' + fmt(r.levelRatio, 3)) + metric('Grms factor', '× ' + fmt(r.grmsRatio, 3)) + metric('Level change', (r.db >= 0 ? '+' : '') + fmt(r.db, 2) + ' dB') + applied;
  }

  // ---------------------------------------------------------------------------
  // CSV, share, print, theme, dialogs
  // ---------------------------------------------------------------------------
  function exportCsv() {
    const v = currentView();
    if (!v || !v.curves) return;
    const lines = [`# ${v.name}`, `# MIL-STD-810H ${v.ref}`, `# Duration: ${dur(v.perAxis)} per axis (${v.durNote || ''})`, 'axis,frequency_Hz,asd_g2_per_Hz'];
    for (const c of v.curves) for (const p of c.curve.pts) lines.push(`${c.axis === 'E' ? 'all' : AXES[c.axis].toLowerCase()},${p.f},${p.w}`);
    if (v.kind === 'sor') {
      lines.push('', 'tone,frequency_Hz,peak_g,applied');
      for (const t of v.heli.tones) lines.push(`${t.name} ${t.label},${t.f.toFixed(3)},${t.A.toFixed(4)},${t.inBand ? 'yes' : 'no'}`);
    }
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mil-std-810h-' + v.id + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2400);
  }

  function update() { history.replaceState(null, '', shareUrl()); render(); }

  function bind() {
    $('#phases').addEventListener('change', (e) => {
      const ph = e.target.dataset.phase;
      if (ph) {
        state.on = e.target.checked ? [...state.on, ph] : state.on.filter((x) => x !== ph);
        state.on = PHASES.map((p) => p.id).filter((id) => state.on.includes(id));
        if (e.target.checked && plan && ['truck', 'cwv', 'loose', 'jet', 'heli', 'mit'].includes(ph)) state.view = ph === 'mit' && state.mitType === 'heli' ? 'mitHeli' : ph;
        return update();
      }
      const k = e.target.dataset.key;
      if (k) {
        const f = FIELD[k];
        state[k] = f.type === 'select' ? e.target.value : (parseFloat(e.target.value) || f.def);
        if (k === 'mitType') state.view = e.target.value === 'heli' ? 'mitHeli' : 'mit';
        update();
      }
    });
    $('#phases').addEventListener('input', (e) => {
      const k = e.target.dataset.key;
      if (k && FIELD[k].type !== 'select') { const n = parseFloat(e.target.value); if (n > 0) { state[k] = n; update(); } }
    });
    const num = (id, key) => $(id).addEventListener('input', (e) => { const n = parseFloat(e.target.value); if (n >= 0) { state[key] = n; update(); } });
    num('#mass', 'mass'); num('#dim', 'dim'); num('#sh-mass', 'shMass'); num('#sh-force', 'shForce'); num('#sh-stroke', 'shStroke'); num('#sh-vel', 'shVel');
    $('#truckOnly').addEventListener('change', (e) => { state.truckOnly = e.target.checked; update(); });
    for (const [id, key] of [['#orient', 'orient'], ['#platform', 'platform']]) {
      $(id).addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        state[key] = b.dataset.v; syncInputs(); update();
      });
    }
    $('#plan').addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-view]');
      if (tr) { state.view = tr.dataset.view; update(); $('#viewer').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      const sh = e.target.closest('tr[data-shock]');
      if (sh) $('#shock-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('#viewer-select').addEventListener('change', (e) => { state.view = e.target.value; update(); });
    $('#viewer-opts').addEventListener('click', (e) => { const b = e.target.closest('[data-axis]'); if (b) { viewAxis = b.dataset.axis; render(); } });
    $('#csv').addEventListener('click', exportCsv);
    $('#psd-load').addEventListener('click', loadViewedIntoPsd);
    $('#psd-in').addEventListener('input', renderPsdTool);
    $('#psd-db').addEventListener('input', renderPsdTool);
    ['#cp-t1', '#cp-t2', '#cp-m'].forEach((id) => $(id).addEventListener('input', renderCompression));
    $('#cp-type').addEventListener('change', (e) => { $('#cp-m').value = e.target.value === 'sine' ? D.FATIGUE.mSine : D.FATIGUE.mRandom; renderCompression(); });

    const pre = $('#preset');
    pre.innerHTML += PRESETS.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('');
    pre.addEventListener('change', () => {
      const p = PRESETS[+pre.value]; if (!p) return;
      state = { ...JSON.parse(JSON.stringify(DEFAULT)), ...p.s, view: null };
      syncInputs(); update(); pre.value = '';
      toast('Loaded: ' + p.name);
    });

    $('#share').addEventListener('click', async () => {
      const url = shareUrl();
      try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch (e) { prompt('Copy this link:', url); }
    });
    $('#print').addEventListener('click', () => { $$('details.card').forEach((d) => (d.dataset.wasOpen = d.open)); window.print(); });
    $('#theme').addEventListener('click', () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
      const t = dark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('ehcrea.theme', t); } catch (e) { /* ignore */ }
    });
    $('#about-open').addEventListener('click', () => $('#about').showModal());
    $('#help-open').addEventListener('click', () => $('#help').showModal());
    $$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
  }

  // ---------------------------------------------------------------------------
  buildPhases();
  readUrl();
  syncInputs();
  bind();
  render();
  // Seed the PSD calculator with the first viewed profile.
  (function seed() {
    const v = currentView();
    if (v && v.curves) {
      const c = v.curves[0];
      $('#psd-in').value = `# ${v.name} — ${AXES[c.axis]}\n` + c.curve.pts.map((p) => `${p.f}, ${p.w}`).join('\n');
    } else $('#psd-in').value = '20, 0.04\n1000, 0.04\n2000, 0.01';
    renderPsdTool();
  })();
})();

// Offline support: register the service worker (sw.js, next to the web manifest) so the
// calculator keeps working without a connection and can be installed as an app.
(function () {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (location.protocol !== 'https:' && !local) return;
  var link = document.querySelector('link[rel="manifest"]');
  var sw = new URL('sw.js', link ? link.href : location.href).href;
  function register() { navigator.serviceWorker.register(sw).catch(function () {}); }
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
})();

// "Install app": a toolbar button (where the browser can install directly, e.g. Chrome/Edge)
// and an "Install as an app" section on the About page with an install button or, where the
// browser has no install prompt (Safari, Firefox), short instructions. Texts in EN/DE/NL/TR/ES.
(function () {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  var TEXT = {
    en: { title: 'Install as an app', body: 'This calculator also works offline. Install it as an app to open it in its own window from the Dock, Start menu or home screen, with or without an internet connection. Updates arrive automatically when you are online.', button: 'Install app', installed: 'You are using the installed app.', done: 'Installed. You can now open it from your apps.', mac: 'In Safari on a Mac: choose File › Add to Dock.', ios: 'On iPhone or iPad: tap Share, then Add to Home Screen.', other: 'In Chrome or Edge: click the install icon in the address bar, or open the browser menu and choose Install. In Safari on a Mac: File › Add to Dock. On iPhone or iPad: Share › Add to Home Screen.' },
    de: { title: 'Als App installieren', body: 'Dieser Rechner funktioniert auch offline. Installieren Sie ihn als App, um ihn in einem eigenen Fenster aus dem Dock, dem Startmenü oder vom Startbildschirm zu öffnen, mit oder ohne Internetverbindung. Updates kommen automatisch, sobald Sie online sind.', button: 'App installieren', installed: 'Sie verwenden die installierte App.', done: 'Installiert. Sie können sie jetzt aus Ihren Apps öffnen.', mac: 'In Safari auf dem Mac: Ablage › Zum Dock hinzufügen.', ios: 'Auf iPhone oder iPad: Teilen tippen, dann Zum Home-Bildschirm.', other: 'In Chrome oder Edge: auf das Installationssymbol in der Adressleiste klicken oder im Browsermenü Installieren wählen. In Safari auf dem Mac: Ablage › Zum Dock hinzufügen. Auf iPhone oder iPad: Teilen › Zum Home-Bildschirm.' },
    nl: { title: 'Installeren als app', body: 'Deze calculator werkt ook offline. Installeer hem als app om hem in een eigen venster te openen vanuit het Dock, het Startmenu of het beginscherm, met of zonder internetverbinding. Updates komen automatisch binnen zodra je online bent.', button: 'App installeren', installed: 'Je gebruikt de geïnstalleerde app.', done: 'Geïnstalleerd. Je kunt hem nu openen vanuit je apps.', mac: 'In Safari op een Mac: kies Archief › Voeg toe aan Dock.', ios: 'Op iPhone of iPad: tik op Deel en daarna op Zet op beginscherm.', other: 'In Chrome of Edge: klik op het installatiepictogram in de adresbalk of kies Installeren in het browsermenu. In Safari op een Mac: Archief › Voeg toe aan Dock. Op iPhone of iPad: Deel › Zet op beginscherm.' },
    tr: { title: 'Uygulama olarak yükle', body: 'Bu hesaplayıcı çevrimdışı da çalışır. Dock, Başlat menüsü veya ana ekrandan kendi penceresinde, internet bağlantısı olsun ya da olmasın açmak için uygulama olarak yükleyin. Çevrimiçi olduğunuzda güncellemeler otomatik olarak gelir.', button: 'Uygulamayı yükle', installed: 'Yüklü uygulamayı kullanıyorsunuz.', done: 'Yüklendi. Artık uygulamalarınızdan açabilirsiniz.', mac: 'Mac’te Safari’de: Dosya › Dock’a Ekle.', ios: 'iPhone veya iPad’de: Paylaş’a, ardından Ana Ekrana Ekle’ye dokunun.', other: 'Chrome veya Edge’de: adres çubuğundaki yükleme simgesine tıklayın ya da tarayıcı menüsünden Yükle’yi seçin. Mac’te Safari’de: Dosya › Dock’a Ekle. iPhone veya iPad’de: Paylaş › Ana Ekrana Ekle.' },
    es: { title: 'Instalar como aplicación', body: 'Esta calculadora también funciona sin conexión. Instálala como aplicación para abrirla en su propia ventana desde el Dock, el menú Inicio o la pantalla de inicio, con o sin conexión a internet. Las actualizaciones llegan solas cuando estás en línea.', button: 'Instalar aplicación', installed: 'Estás usando la aplicación instalada.', done: 'Instalada. Ya puedes abrirla desde tus aplicaciones.', mac: 'En Safari en un Mac: Archivo › Añadir al Dock.', ios: 'En iPhone o iPad: toca Compartir y luego Añadir a pantalla de inicio.', other: 'En Chrome o Edge: haz clic en el icono de instalación de la barra de direcciones o elige Instalar en el menú del navegador. En Safari en un Mac: Archivo › Añadir al Dock. En iPhone o iPad: Compartir › Añadir a pantalla de inicio.' }
  };
  // Toolbar order in every ehcrea calculator: … Install app, Help, About, theme.
  var ABOUT_BUTTONS = '#btnAbout, #about-open, #aboutOpen, [data-dialog="about"]';
  var HELP_BUTTONS = '#btnHelp, #help-open, #helpOpen, [data-dialog="help"]';
  var ICON = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 2v8M4.5 6.8 8 10.3l3.5-3.5M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var prompt = null, justInstalled = false;

  function lang() { var l = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase(); return TEXT[l] ? l : 'en'; }
  function tx(k) { return TEXT[lang()][k]; }
  function installed() {
    return justInstalled || window.navigator.standalone === true ||
      (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches));
  }
  function platform() {
    var ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|OPR/.test(ua)) return 'mac';
    return 'other';
  }
  function install() {
    if (!prompt) return;
    var p = prompt; prompt = null;
    p.prompt();
    (p.userChoice || Promise.resolve({})).then(function (c) { if (c && c.outcome !== 'accepted') prompt = p; render(); });
    render();
  }

  function addStyle() {
    if (document.getElementById('pwa-install-style')) return;
    var s = document.createElement('style');
    s.id = 'pwa-install-style';
    s.textContent =
      '.pwa-install{margin:1rem 0;padding:.85rem 1rem;border:1px solid var(--border, var(--line, #c9ced6));border-radius:var(--radius, 10px)}' +
      '.pwa-install h3{margin:0 0 .4rem;font-size:1rem}.pwa-install p{margin:.35rem 0}' +
      '.pwa-install .pwa-install-cta{display:inline-flex;align-items:center;gap:.45rem;margin-top:.35rem;padding:.5rem .95rem;border:0;border-radius:999px;font:inherit;font-weight:600;cursor:pointer;background:var(--accent);color:var(--accent-ink, var(--bg, #fff))}' +
      '.pwa-install .pwa-install-cta:hover{filter:brightness(1.08)}.pwa-install .pwa-install-cta:focus-visible{outline:2px solid var(--accent);outline-offset:2px}' +
      '.pwa-install-btn{display:inline-flex;align-items:center;gap:.35rem}.pwa-install-btn svg{flex:none}' +
      '@media (max-width:760px){.pwa-install-btn .pwa-label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}';
    document.head.appendChild(s);
  }

  function renderToolbar() {
    var btn = document.querySelector('.pwa-install-btn');
    if (!prompt || installed()) { if (btn) btn.remove(); return; }
    var about = document.querySelector(HELP_BUTTONS) || document.querySelector(ABOUT_BUTTONS);
    if (!about) return;
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = (about.className + ' pwa-install-btn').trim();
      btn.addEventListener('click', install);
      about.parentNode.insertBefore(btn, about);
    }
    if (btn.dataset.lang !== lang()) {
      btn.dataset.lang = lang();
      btn.innerHTML = ICON + '<span class="pwa-label">' + tx('button') + '</span>';
      btn.title = tx('button');
      btn.setAttribute('aria-label', tx('button'));
    }
  }

  function renderAbout() {
    var anchor = document.querySelector('.about-support');
    if (!anchor) return;
    var state = lang() + '|' + (installed() ? 'installed' : prompt ? 'prompt' : platform());
    var box = anchor.parentNode.querySelector(':scope > .pwa-install');
    if (box && box.dataset.state === state) return;
    if (!box) { box = document.createElement('section'); box.className = 'pwa-install'; anchor.parentNode.insertBefore(box, anchor); }
    box.dataset.state = state;
    var html = '<h3>' + tx('title') + '</h3><p>' + tx('body') + '</p>';
    if (installed()) html += '<p><strong>' + tx(justInstalled ? 'done' : 'installed') + '</strong></p>';
    else if (prompt) html += '<button type="button" class="pwa-install-cta">' + ICON + '<span>' + tx('button') + '</span></button>';
    else html += '<p>' + tx(platform()) + '</p>';
    box.innerHTML = html;
    var cta = box.querySelector('.pwa-install-cta');
    if (cta) cta.addEventListener('click', install);
  }

  var busy = false;
  function render() {
    if (busy) return;
    busy = true;
    try { addStyle(); renderToolbar(); renderAbout(); } finally { busy = false; }
  }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); prompt = e; render(); });
  window.addEventListener('appinstalled', function () { prompt = null; justInstalled = true; render(); });
  function start() {
    render();
    // The About content and the page language are re-rendered by the app: keep up with it.
    new MutationObserver(function () { if (!busy) render(); })
      .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['lang'] });
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

// Google Analytics 4 (one property and stream for all ehcrea calculators on ehcrea.github.io)
// plus a short "Privacy" section on the About page with an off switch. Texts in EN/DE/NL/TR/ES.
// - Loads only on ehcrea.github.io, and never when the browser sends Do Not Track / Global
//   Privacy Control or the visitor turned analytics off (localStorage "ehcrea.analytics" = "off").
// - Only origin + path is reported: ?query and #hash can hold saved inputs and share links.
// - Offline the gtag request simply fails; the service worker does not handle it.
(function () {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  var ID = 'G-0SRRQJ1BBN', KEY = 'ehcrea.analytics';
  var TEXT = {
    en: { title: 'Privacy', body: 'This site uses Google Analytics to count visits and see which calculators are used. Only the page address is sent, without your inputs or results, which stay on your device. Advertising features are off, and Google Analytics does not store IP addresses. Analytics is skipped when your browser sends Do Not Track or Global Privacy Control.', off: 'Turn off analytics on this device', on: 'Turn analytics back on', isOff: 'Analytics is off on this device.', browser: 'Your browser asks not to be tracked, so analytics is off.' },
    de: { title: 'Datenschutz', body: 'Diese Seite verwendet Google Analytics, um Besuche zu zählen und zu sehen, welche Rechner genutzt werden. Gesendet wird nur die Seitenadresse, ohne Ihre Eingaben oder Ergebnisse; diese bleiben auf Ihrem Gerät. Werbefunktionen sind ausgeschaltet, und Google Analytics speichert keine IP-Adressen. Sendet Ihr Browser „Do Not Track“ oder „Global Privacy Control“, wird Analytics nicht geladen.', off: 'Analytics auf diesem Gerät ausschalten', on: 'Analytics wieder einschalten', isOff: 'Analytics ist auf diesem Gerät ausgeschaltet.', browser: 'Ihr Browser bittet darum, nicht verfolgt zu werden, daher ist Analytics ausgeschaltet.' },
    nl: { title: 'Privacy', body: 'Deze site gebruikt Google Analytics om bezoeken te tellen en te zien welke calculators worden gebruikt. Alleen het paginaadres wordt verstuurd, zonder je invoer of resultaten; die blijven op je apparaat. Advertentiefuncties staan uit en Google Analytics slaat geen IP-adressen op. Als je browser Do Not Track of Global Privacy Control meestuurt, wordt Analytics niet geladen.', off: 'Analytics uitzetten op dit apparaat', on: 'Analytics weer aanzetten', isOff: 'Analytics staat uit op dit apparaat.', browser: 'Je browser vraagt om niet gevolgd te worden, dus Analytics staat uit.' },
    tr: { title: 'Gizlilik', body: 'Bu site, ziyaretleri saymak ve hangi hesaplayıcıların kullanıldığını görmek için Google Analytics kullanır. Yalnızca sayfa adresi gönderilir; girdileriniz ve sonuçlarınız gönderilmez, cihazınızda kalır. Reklam özellikleri kapalıdır ve Google Analytics IP adreslerini saklamaz. Tarayıcınız Do Not Track veya Global Privacy Control gönderirse Analytics yüklenmez.', off: 'Bu cihazda analitiği kapat', on: 'Analitiği yeniden aç', isOff: 'Bu cihazda analitik kapalı.', browser: 'Tarayıcınız izlenmemeyi istediği için analitik kapalı.' },
    es: { title: 'Privacidad', body: 'Este sitio usa Google Analytics para contar visitas y ver qué calculadoras se usan. Solo se envía la dirección de la página, sin tus datos ni resultados, que se quedan en tu dispositivo. Las funciones publicitarias están desactivadas y Google Analytics no almacena direcciones IP. Si tu navegador envía Do Not Track o Global Privacy Control, Analytics no se carga.', off: 'Desactivar la analítica en este dispositivo', on: 'Volver a activar la analítica', isOff: 'La analítica está desactivada en este dispositivo.', browser: 'Tu navegador pide no ser rastreado, así que la analítica está desactivada.' }
  };
  function lang() { var l = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase(); return TEXT[l] ? l : 'en'; }
  function tx(k) { return TEXT[lang()][k]; }
  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function store(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) { /* private mode */ } }
  function browserOptOut() { return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1'; }
  function url() { return location.origin + location.pathname; }

  var loaded = false, lastPath = null;
  function pageView() {
    if (!loaded || window['ga-disable-' + ID] || location.pathname === lastPath) return;
    lastPath = location.pathname;
    window.gtag('set', { page_location: url() });
    window.gtag('event', 'page_view', { page_location: url(), page_title: document.title });
  }
  function load() {
    if (loaded || location.hostname !== 'ehcrea.github.io' || stored() === 'off' || browserOptOut()) return;
    loaded = true;
    window['ga-disable-' + ID] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ID, { send_page_view: false, page_location: url(), allow_google_signals: false, allow_ad_personalization_signals: false });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
    // The apps move between calculator pages with history.pushState/replaceState.
    ['pushState', 'replaceState'].forEach(function (m) {
      var orig = history[m];
      if (typeof orig !== 'function') return;
      history[m] = function () { var r = orig.apply(this, arguments); setTimeout(pageView, 0); return r; };
    });
    window.addEventListener('popstate', pageView);
    pageView();
  }
  function setOff(off) {
    store(off ? 'off' : null);
    window['ga-disable-' + ID] = off;
    if (!off) { if (loaded) { lastPath = null; pageView(); } else load(); }
    render();
  }

  function addStyle() {
    if (document.getElementById('privacy-note-style')) return;
    var s = document.createElement('style');
    s.id = 'privacy-note-style';
    s.textContent =
      '.privacy-note{margin:1rem 0;padding:.85rem 1rem;border:1px solid var(--border, var(--line, #c9ced6));border-radius:var(--radius, 10px)}' +
      '.privacy-note h3{margin:0 0 .4rem;font-size:1rem}.privacy-note p{margin:.35rem 0}' +
      '.privacy-note .privacy-toggle{margin-top:.25rem;padding:.4rem .85rem;border:1px solid var(--border-strong, var(--border, var(--line, #8a929e)));border-radius:999px;font:inherit;cursor:pointer;background:transparent;color:inherit}' +
      '.privacy-note .privacy-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}';
    document.head.appendChild(s);
  }
  function render() {
    var anchor = document.querySelector('.about-support');
    if (!anchor) return;
    var off = stored() === 'off', browser = browserOptOut();
    var state = lang() + '|' + (browser ? 'browser' : off ? 'off' : 'on');
    var box = anchor.parentNode.querySelector(':scope > .privacy-note');
    if (box && box.dataset.state === state) return;
    addStyle();
    if (!box) { box = document.createElement('section'); box.className = 'privacy-note'; anchor.parentNode.insertBefore(box, anchor.nextSibling); }
    box.dataset.state = state;
    var html = '<h3>' + tx('title') + '</h3><p>' + tx('body') + '</p>';
    if (browser) html += '<p>' + tx('browser') + '</p>';
    else html += (off ? '<p>' + tx('isOff') + '</p>' : '') + '<button type="button" class="privacy-toggle">' + tx(off ? 'on' : 'off') + '</button>';
    box.innerHTML = html;
    var btn = box.querySelector('.privacy-toggle');
    if (btn) btn.addEventListener('click', function () { setOff(!off); var b = box.querySelector('.privacy-toggle'); if (b) b.focus(); });
  }
  function start() {
    load();
    render();
    new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
