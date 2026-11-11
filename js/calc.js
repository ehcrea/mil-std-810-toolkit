/*
 * Calculations: PSD integration (acceleration, velocity, displacement),
 * helicopter sine-on-random, test-time compression, shaker checks, shock
 * pulses and transit drop selection. No DOM access, so it runs in Node too.
 */
(function (root) {
  'use strict';
  const G0 = 9.80665; // m/s² per g

  // ---- PSD basics (straight lines on log-log axes between breakpoints) ----

  // Slope of a segment in dB/octave.
  function slopeDb(a, b) {
    return 10 * Math.log10(b.w / a.w) / Math.log2(b.f / a.f);
  }

  // Exact area under one log-log segment: ∫ w1 (f/f1)^n df.
  function segArea(a, b) {
    if (a.w <= 0 || b.w <= 0 || b.f <= a.f) return 0;
    const n = Math.log(b.w / a.w) / Math.log(b.f / a.f);
    if (Math.abs(n + 1) < 1e-9) return a.w * a.f * Math.log(b.f / a.f);
    return a.w * a.f / (n + 1) * (Math.pow(b.f / a.f, n + 1) - 1);
  }

  // Overall acceleration rms in g.
  function grms(pts) {
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += segArea(pts[i - 1], pts[i]);
    return Math.sqrt(s);
  }

  // PSD value at f (log-log interpolation), 0 outside the curve.
  function psdAt(pts, f) {
    if (!pts.length || f < pts[0].f || f > pts[pts.length - 1].f) return 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (f <= b.f) {
        if (b.f === a.f) return b.w;
        const n = Math.log(b.w / a.w) / Math.log(b.f / a.f);
        return a.w * Math.pow(f / a.f, n);
      }
    }
    return pts[pts.length - 1].w;
  }

  // Area of w(f)·(2πf)^-k over one segment (k = 2 velocity, 4 displacement).
  function segAreaWeighted(a, b, k) {
    if (b.f <= a.f) return 0;
    // w(f)·(2πf)^-k = base·(f/a.f)^n with n = (log-log slope) − k.
    const n = Math.log(b.w / a.w) / Math.log(b.f / a.f) - k;
    const base = a.w / Math.pow(2 * Math.PI * a.f, k);
    if (Math.abs(n + 1) < 1e-9) return base * a.f * Math.log(b.f / a.f);
    return base * a.f / (n + 1) * (Math.pow(b.f / a.f, n + 1) - 1);
  }

  // rms velocity (m/s) and displacement (m) of a random acceleration PSD in g²/Hz.
  function psdStats(pts) {
    let a = 0, v = 0, d = 0;
    for (let i = 1; i < pts.length; i++) {
      a += segArea(pts[i - 1], pts[i]);
      v += segAreaWeighted(pts[i - 1], pts[i], 2);
      d += segAreaWeighted(pts[i - 1], pts[i], 4);
    }
    const g = Math.sqrt(a);
    const vel = Math.sqrt(v) * G0;
    const disp = Math.sqrt(d) * G0;
    return {
      grms: g,
      vrms: vel, // m/s
      drms: disp, // m
      dpp3: 6 * disp, // 3σ peak-to-peak displacement, m
      fmin: pts[0].f,
      fmax: pts[pts.length - 1].f,
    };
  }

  // Slopes (dB/oct) for display.
  function withSlopes(pts) {
    return pts.map((p, i) => ({ ...p, slope: i ? slopeDb(pts[i - 1], p) : null }));
  }

  // Envelope (maximum) of several curves on a common log grid, for plotting.
  function scalePsd(pts, factor) {
    return pts.map((p) => ({ f: p.f, w: p.w * factor }));
  }

  // ---- Sine helpers ----
  // Peak displacement (m) and velocity (m/s) of a sine of A g peak at f Hz.
  function sineMotion(f, Ag) {
    const w = 2 * Math.PI * f;
    const a = Ag * G0;
    return { v: a / w, d: a / (w * w), dpp: 2 * a / (w * w) };
  }

  // Helicopter minimum integrity sine: peak acceleration (g) at f.
  function heliMitAmp(seg, f) {
    if (seg.type === 'acc') return seg.g;
    const w = 2 * Math.PI * f;
    return (seg.da_mm / 2000) * w * w / G0;
  }

  // ---- Category 14 helicopter ----
  function heliTones(ac, source, shaftHz) {
    if (source === 'drive') {
      const s = shaftHz;
      return [1, 2, 3, 4].map((k, i) => ({ name: 'f' + (i + 1), label: k + 'S', f: k * s }));
    }
    if (source === 'tail') {
      return [
        { name: 'f1', label: '1T', f: ac.t },
        { name: 'f2', label: ac.m + '·1T', f: ac.m * ac.t },
        { name: 'f3', label: 2 * ac.m + '·1T', f: 2 * ac.m * ac.t },
        { name: 'f4', label: 3 * ac.m + '·1T', f: 3 * ac.m * ac.t },
      ];
    }
    return [
      { name: 'f1', label: '1P', f: ac.p },
      { name: 'f2', label: ac.n + '·1P', f: ac.n * ac.p },
      { name: 'f3', label: 2 * ac.n + '·1P', f: 2 * ac.n * ac.p },
      { name: 'f4', label: 3 * ac.n + '·1P', f: 3 * ac.n * ac.p },
    ];
  }

  // Build the sine-on-random spectrum. flightHours scales the duration using
  // the 2500 h = 4 h relation, with the 0.5 h minimum and level increase.
  function helicopter(H, opts) {
    const loc = H.locations[opts.location];
    const sources = opts.location === 'drive' ? ['drive'] : opts.sources;
    let tones = [];
    for (const src of sources) {
      for (const t of heliTones(opts.aircraft, src, opts.shaftHz)) tones.push({ ...t, source: src });
    }
    const fMin = loc.fLow;
    tones = tones.map((t) => ({ ...t, inBand: t.f >= fMin && t.f <= loc.ft, A: loc.amp(t.f) }));

    // Duration scaling.
    const life = opts.flightHours > 0 ? opts.flightHours : H.lifeHours;
    const raw = H.baseHours * life / H.lifeHours;
    const hours = Math.max(raw, H.minHours);
    // If the minimum duration governs, reduce levels so damage stays equal.
    const sineFactor = hours > raw ? Math.pow(raw / hours, 1 / H.mSine) : 1;
    const randFactor = hours > raw ? Math.pow(raw / hours, 2 / H.mRandom) : 1;
    const w0 = loc.w0 * randFactor, w1 = loc.w1 * randFactor;
    const pts = [
      { f: loc.fLow, w: w0 }, { f: loc.fSplit, w: w0 },
      { f: loc.fSplit, w: w1 }, { f: loc.ft, w: w1 },
    ];
    tones = tones.map((t) => ({ ...t, A: t.A * sineFactor, ...sineMotion(t.f, t.A * sineFactor) }));
    const rand = grms(pts);
    const sineRms2 = tones.filter((t) => t.inBand).reduce((s, t) => s + t.A * t.A / 2, 0);
    return {
      loc, pts, tones, hours, rawHours: raw, sineFactor, randFactor,
      randomGrms: rand, totalGrms: Math.sqrt(rand * rand + sineRms2),
      peakSine: Math.max(0, ...tones.filter((t) => t.inBand).map((t) => t.A)),
    };
  }

  // ---- Test-time compression (Annex A fatigue relation) ----
  // Random: W2/W1 = (T1/T2)^(2/m); sine: A2/A1 = (T1/T2)^(1/m).
  function compress({ t1, t2, m, type }) {
    const r = t1 / t2;
    if (type === 'sine') return { levelRatio: Math.pow(r, 1 / m), db: 20 * Math.log10(Math.pow(r, 1 / m)) };
    const wr = Math.pow(r, 2 / m);
    return { levelRatio: wr, grmsRatio: Math.sqrt(wr), db: 10 * Math.log10(wr) };
  }
  // Inverse: time ratio for a given PSD (random) or amplitude (sine) ratio.
  function timeForLevel({ t1, ratio, m, type }) {
    const r = type === 'sine' ? Math.pow(ratio, m) : Math.pow(ratio, m / 2);
    return t1 / r;
  }

  // ---- Shaker check ----
  // Random: required force rms = total moving mass · Grms · g.
  function shakerCheck({ stats, massKg, shaker }) {
    const force = massKg * stats.grms * G0;
    const res = {
      force,
      forceOk: shaker.forceN ? force <= shaker.forceN : null,
      forceUse: shaker.forceN ? force / shaker.forceN : null,
      stroke: stats.dpp3,
      strokeOk: shaker.strokeMm ? stats.dpp3 * 1000 <= shaker.strokeMm : null,
      strokeUse: shaker.strokeMm ? stats.dpp3 * 1000 / shaker.strokeMm : null,
      vel: 3 * stats.vrms,
      velOk: shaker.velMs ? 3 * stats.vrms <= shaker.velMs : null,
      velUse: shaker.velMs ? 3 * stats.vrms / shaker.velMs : null,
    };
    return res;
  }

  // ---- Shock ----
  // Terminal-peak sawtooth: ΔV = ½·A·T; half-sine: 2AT/π; trapezoid (rise/fall
  // each 10 % of T): 0.9·A·T.
  function pulse({ shape, g, ms }) {
    const A = g * G0, T = ms / 1000;
    const dv = shape === 'halfsine' ? 2 * A * T / Math.PI : shape === 'trapezoid' ? 0.9 * A * T : 0.5 * A * T;
    return { dv, dropEq: dv * dv / (2 * G0) };
  }

  function transitDrop(SHOCK, massKg, dimCm) {
    return SHOCK.drop.find((r) => massKg < r.maxKg && dimCm < r.dimMax) ||
      SHOCK.drop.find((r) => massKg < r.maxKg) || SHOCK.drop[SHOCK.drop.length - 1];
  }

  // ---- Duration for distance-based profiles ----
  function profileMinutes(prof, qty) {
    const d = prof.duration;
    if (d.fixed) return d.minutes;
    if (d.perEvent) return d.minutes * Math.max(1, qty || 1);
    return d.minutes * (qty || d.perKm) / d.perKm;
  }

  root.MIL = {
    G0, slopeDb, segArea, grms, psdAt, psdStats, withSlopes, scalePsd,
    sineMotion, heliMitAmp, heliTones, helicopter, compress, timeForLevel,
    shakerCheck, pulse, transitDrop, profileMinutes,
  };
})(typeof window !== 'undefined' ? window : globalThis);
