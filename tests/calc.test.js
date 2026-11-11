/*
 * Run with: node tests/calc.test.js
 * Checks every transcribed profile against the overall rms printed in
 * MIL-STD-810H, the helicopter worked example in Annex D, and the
 * calculation helpers.
 */
'use strict';
require('../js/data.js');
require('../js/calc.js');
const D = globalThis.MIL_DATA, M = globalThis.MIL;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.abs(b);

// 1. Every curve: increasing frequencies, positive PSD, rms within 1 % (or the
//    print rounding of ±0.005 g) of the printed value.
function checkCurve(name, c) {
  ok(c.pts.length >= 2, name + ' has breakpoints');
  for (let i = 1; i < c.pts.length; i++) ok(c.pts[i].f > c.pts[i - 1].f, `${name} frequency increases at ${c.pts[i].f} Hz`);
  ok(c.pts.every((p) => p.w > 0), name + ' PSD positive');
  const g = M.grms(c.pts);
  ok(near(g, c.rms, 0.01) || Math.abs(g - c.rms) <= 0.005, `${name}: computed ${g.toFixed(3)} g vs printed ${c.rms} g`);
}
for (const p of Object.values(D.PROFILES)) {
  if (p.axes) for (const [a, c] of Object.entries(p.axes)) checkCurve(`${p.id} ${a}`, c);
  if (p.envelope) checkCurve(`${p.id} envelope`, p.envelope);
  if (p.variants) for (const [a, c] of Object.entries(p.variants)) checkCurve(`${p.id} ${a}`, c);
  if (p.single) checkCurve(p.id, p.single);
}

// Envelope must cover every axis at every frequency.
for (const id of ['commonCarrier', 'cwv']) {
  const p = D.PROFILES[id];
  for (const [a, c] of Object.entries(p.axes)) {
    for (let f = 5; f <= 500; f *= 1.01) {
      ok(M.psdAt(p.envelope.pts, f) >= M.psdAt(c.pts, f) * 0.999, `${id} envelope covers ${a} at ${f.toFixed(1)} Hz`);
    }
  }
}

// 2. Helicopter: Annex D worked example. AH-64 blade-passage tone 19.44 Hz = 1.944 g;
//    50 flight hours -> 0.08 h, raised to the 0.5 h minimum -> 1.432 g.
const ah64 = D.HELI.aircraft.find((a) => a.id === 'ah64l');
let h = M.helicopter(D.HELI, { location: 'general', aircraft: ah64, sources: ['main'], flightHours: 2500 });
ok(near(h.tones[1].f, 19.44, 1e-6) && near(h.tones[1].A, 1.944, 1e-6), 'AH-64 f2 = 19.44 Hz at 1.944 g');
ok(h.hours === 4, 'full life = 4 h per axis');
h = M.helicopter(D.HELI, { location: 'general', aircraft: ah64, sources: ['main'], flightHours: 50 });
ok(h.hours === 0.5, '50 flight hours -> 0.5 h minimum');
ok(near(h.tones[1].A, 1.432, 0.001), `scaled f2 amplitude ${h.tones[1].A.toFixed(3)} g = 1.432 g`);
h = M.helicopter(D.HELI, { location: 'general', aircraft: ah64, sources: ['main'], flightHours: 1250 });
ok(h.hours === 2 && h.sineFactor === 1, '1250 flight hours -> 2 h, unscaled levels');
// Amplitude laws are continuous at the band edges. (The drive-system law steps
// from 5.0 g to 5.5 g at 50 Hz exactly as tabulated, so it is not checked.)
for (const [k, loc] of Object.entries(D.HELI.locations)) {
  if (k === 'drive') continue;
  for (const f of [25, 40, 50]) {
    ok(Math.abs(loc.amp(f - 1e-9) - loc.amp(f + 1e-9)) < 1e-6, `${k} amplitude continuous at ${f} Hz`);
  }
}
const drive = M.helicopter(D.HELI, { location: 'drive', aircraft: ah64, sources: ['main'], shaftHz: 100 });
ok(drive.tones.map((t) => t.f).join() === '100,200,300,400', 'drive tones 1S..4S');
ok(near(drive.tones[0].A, 6.0, 1e-9), 'drive amplitude at 100 Hz = 5 + 0.01·100 = 6 g');

// 3. Helicopter MIT crossovers: 5.1 mm DA at 14 Hz ≈ 2 g, 0.91 mm DA at 33 Hz ≈ 2 g and at 52.1 Hz ≈ 5 g.
const [s1, , s3] = D.HELI_MIT.segments;
ok(near(M.heliMitAmp(s1, 14), 2, 0.02), 'helicopter MIT: 5.1 mm DA at 14 Hz = 2 g');
ok(near(M.heliMitAmp(s3, 33), 2, 0.03), 'helicopter MIT: 0.91 mm DA at 33 Hz = 2 g');
ok(near(M.heliMitAmp(s3, 52.1), 5, 0.03), 'helicopter MIT: 0.91 mm DA at 52.1 Hz = 5 g');

// 4. PSD statistics against closed-form results for a flat spectrum.
const flat = [{ f: 10, w: 0.01 }, { f: 100, w: 0.01 }];
const st = M.psdStats(flat);
ok(near(st.grms, Math.sqrt(0.9), 1e-9), 'flat PSD Grms');
const vExact = Math.sqrt(0.01 / (4 * Math.PI ** 2) * (1 / 10 - 1 / 100)) * M.G0;
ok(near(st.vrms, vExact, 1e-9), 'flat PSD velocity rms');
const dExact = Math.sqrt(0.01 / (16 * Math.PI ** 4) * (1 / (3 * 1000) - 1 / (3 * 1e6))) * M.G0;
ok(near(st.drms, dExact, 1e-9), 'flat PSD displacement rms');
ok(near(M.slopeDb({ f: 1000, w: 0.04 }, { f: 2000, w: 0.01 }), -6.02, 0.001), '−6 dB/oct slope');

// 5. Time compression: random and sine, and the inverse.
const c = M.compress({ t1: 4, t2: 1, m: 7.5, type: 'random' });
ok(near(c.levelRatio, Math.pow(4, 2 / 7.5), 1e-12), 'random compression ratio');
ok(near(M.timeForLevel({ t1: 4, ratio: c.levelRatio, m: 7.5, type: 'random' }), 1, 1e-9), 'random inverse');
const cs = M.compress({ t1: 0.08, t2: 0.5, m: 6, type: 'sine' });
ok(near(1.944 * cs.levelRatio, 1.432, 0.001), 'sine compression reproduces Annex D example');

// 6. Shock helpers.
ok(near(M.pulse({ shape: 'sawtooth', g: 20, ms: 11 }).dv, 0.5 * 20 * M.G0 * 0.011, 1e-12), 'sawtooth ΔV');
const td = (kg, cm) => M.transitDrop(D.SHOCK, kg, cm).cm;
ok(td(10, 50) === 122 && td(10, 100) === 76 && td(60, 50) === 76 && td(60, 100) === 61 && td(200, 50) === 61 && td(800, 200) === 46, 'transit drop heights');

// 7. Durations scale with distance and events.
ok(M.profileMinutes(D.PROFILES.commonCarrier, 3218) === 120, 'truck 3218 km -> 120 min/axis');
ok(M.profileMinutes(D.PROFILES.cwv, 804) === 40, 'CWV 804 km -> 40 min/axis');
ok(M.profileMinutes(D.PROFILES.jetCargo, 10) === 10, 'jet 10 take-offs -> 10 min/axis');
ok(M.profileMinutes(D.PROFILES.mitGeneral, 999) === 60, 'MIT fixed 60 min/axis');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
