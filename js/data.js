/*
 * MIL-STD-810H default test data (Method 514.8 Vibration, Method 516.8 Shock).
 *
 * Every number below is transcribed from MIL-STD-810H (31 January 2019),
 * Method 514.8 Annexes C, D and E and Method 516.8. Breakpoints are joined
 * with straight lines on log-log axes, as the standard's figures are drawn.
 * The printed overall rms value of each curve is kept in `rms` so the tests
 * can check every transcription against the standard.
 *
 * These are DEFAULT levels for use when no measured data exist. The standard
 * expects them to be tailored to the materiel's life cycle (Part One).
 */
(function (root) {
  'use strict';

  const bp = (pairs) => pairs.map(([f, w]) => ({ f, w }));

  // ---------------------------------------------------------------------------
  // Random vibration profiles. Each profile has one curve per axis (V, T, L)
  // and, where the standard gives one, an envelope for unknown orientation.
  // ---------------------------------------------------------------------------
  const PROFILES = {
    commonCarrier: {
      id: 'commonCarrier',
      category: 4,
      name: 'US highway truck (common carrier)',
      short: 'Highway truck',
      ref: 'Method 514.8, Annex C, Category 4, Figure 514.8C-2 / Table 514.8C-I',
      envRef: 'Figure 514.8C-3 / Table 514.8C-II (unknown or variable orientation)',
      phase: 'transport',
      procedure: 'I — General vibration (secured cargo)',
      // 60 minutes per axis represents 1609 km (1000 mi) of highway transport.
      duration: { minutes: 60, perKm: 1609, label: '60 min per axis per 1609 km (1000 mi)' },
      axes: {
        V: { rms: 1.08, pts: bp([[5, 0.015], [40, 0.015], [500, 0.00015]]) },
        T: { rms: 0.21, pts: bp([[5, 0.00013], [10, 0.00013], [20, 0.00065], [30, 0.00065], [78, 0.00002], [79, 0.00019], [120, 0.00019], [500, 0.00001]]) },
        L: { rms: 0.76, pts: bp([[5, 0.0065], [20, 0.0065], [120, 0.0002], [121, 0.003], [200, 0.003], [240, 0.0015], [340, 0.00003], [500, 0.00015]]) },
      },
      envelope: { rms: 1.17, pts: bp([[5, 0.015], [40, 0.015], [120, 0.002025], [121, 0.003], [200, 0.003], [240, 0.0015], [266, 0.000475], [500, 0.00015]]) },
      notes: [
        'Represents commercial transport over improved US highways, from the manufacturer to a storage or user location.',
        'The standard states that the time-compression algorithm and exaggeration factor for this profile are unknown, so scale duration linearly with distance.',
        'Use the unknown-orientation envelope when the item may be loaded in any orientation, applying it in all three axes.',
      ],
    },

    cwv: {
      id: 'cwv',
      category: 4,
      name: 'Military wheeled vehicle (composite wheeled vehicle)',
      short: 'Wheeled vehicle',
      ref: 'Method 514.8, Annex C, Category 4, Figure 514.8C-6 / Table 514.8C-VII',
      envRef: 'Figure 514.8C-7 / Table 514.8C-VIII (unknown orientation)',
      phase: 'transport',
      procedure: 'I — General vibration (secured cargo)',
      duration: { minutes: 40, perKm: 804, label: '40 min per axis per 804 km (500 mi)' },
      axes: {
        V: { rms: 2.24, pts: bp([[5, 0.12765], [6, 0.12926], [7, 0.3], [8, 0.3], [9, 0.1], [12, 0.1], [14, 0.15], [16, 0.15], [19, 0.04], [90, 0.006], [125, 0.004], [190, 0.004], [211, 0.006], [440, 0.006], [500, 0.00204]]) },
        T: { rms: 1.45, pts: bp([[5, 0.0407], [6, 0.04415], [7, 0.11], [8, 0.11], [9, 0.0425], [12, 0.0425], [14, 0.074], [16, 0.074], [19, 0.02], [100, 0.00074], [189, 0.0013], [350, 0.004], [425, 0.004], [482, 0.0021], [500, 0.00142]]) },
        L: { rms: 1.32, pts: bp([[5, 0.01848], [6, 0.02373], [7, 0.05], [8, 0.05], [9, 0.02016], [12, 0.02016], [14, 0.05], [16, 0.05], [19, 0.0103], [23, 0.0103], [25, 0.00833], [66, 0.00114], [84, 0.00107], [90, 0.00167], [165, 0.00151], [221, 0.00333], [455, 0.00296], [500, 0.00204]]) },
      },
      envelope: { rms: 2.24, pts: bp([[5, 0.12765], [6, 0.12926], [7, 0.3], [8, 0.3], [9, 0.1], [12, 0.1], [14, 0.15], [16, 0.15], [19, 0.04], [90, 0.006], [125, 0.004], [190, 0.004], [211, 0.006], [440, 0.006], [500, 0.00204]]) },
      notes: [
        'Envelope of measured cargo-bed data from US Army tactical wheeled vehicles on paved, secondary and cross-country roads (mission/field transport).',
        'Time-compressed with the fatigue relation of Annex A (m = 7.5 for random). Practitioners regularly describe this curve as conservative; measured data from the actual vehicle are preferred.',
        'MIL-STD-810H replaced the 810G composite wheeled vehicle curve. Do not mix 810G and 810H breakpoints.',
      ],
    },

    jetCargo: {
      id: 'jetCargo',
      category: 7,
      name: 'Jet aircraft cargo',
      short: 'Jet cargo',
      ref: 'Method 514.8, Annex C, Category 7, Figure 514.8C-9 / Table 514.8C-IX',
      phase: 'transport',
      procedure: 'I — General vibration (secured cargo)',
      duration: { minutes: 1, perEvent: true, label: '1 min per take-off, per axis' },
      // One curve applies to all three axes; the variant is the aircraft.
      variants: {
        general: { name: 'General exposure (aircraft unknown)', rms: 4.02, pts: bp([[15, 0.01], [105.94, 0.01], [150, 0.02], [500, 0.02], [2000, 0.00125]]) },
        c5: { name: 'C-5', rms: 2.11, pts: bp([[15, 0.003], [1000, 0.003], [2000, 0.00075]]) },
        kc10: { name: 'KC-10', rms: 2.38, pts: bp([[15, 0.0038], [1000, 0.0038], [2000, 0.00095]]) },
        kc135: { name: 'KC-135 / E-3', rms: 2.80, pts: bp([[10, 0.002], [66.897, 0.002], [150, 0.01], [500, 0.01], [2000, 0.000625]]) },
        c17: { name: 'C-17 (primary cargo floor)', rms: 4.43, pts: bp([[5, 0.005], [66.897, 0.005], [150, 0.025], [500, 0.025], [2000, 0.0015625]]) },
        t43: { name: 'T-43A (Boeing 737)', rms: 3.54, pts: bp([[10, 0.015], [20, 0.015], [34.263, 0.003], [46.698, 0.003], [80, 0.015], [500, 0.015], [2000, 0.0009375]]) },
      },
      notes: [
        'Take-off is the most severe event for cargo; the default exposure is one minute per take-off.',
        'Levels apply to cargo on the primary floor. Items on the C-17 aft ramp see higher levels.',
        'The 2000 Hz values follow from the −6 dB/octave slopes printed in the table.',
      ],
    },

    mitGeneral: {
      id: 'mitGeneral',
      category: 24,
      name: 'General minimum integrity test (MIT)',
      short: 'Minimum integrity',
      ref: 'Method 514.8, Annex E, Category 24, Figure 514.8E-1',
      phase: 'any',
      procedure: 'I — General vibration',
      duration: { minutes: 60, fixed: true, label: '60 min per axis' },
      axes: null,
      single: { rms: 7.7, pts: bp([[20, 0.04], [1000, 0.04], [2000, 0.01]]) },
      notes: [
        'Use only when the service environment is unknown, e.g. early development or materiel whose life cycle cannot be defined. It is not a substitute for a tailored test.',
        'Maximum test item mass about 36 kg (80 lb); test larger materiel as subassemblies.',
        'Passing an MIT does not prove the materiel will survive its real environment, and failing one does not prove it will fail.',
      ],
    },
  };

  // Helicopter minimum integrity: swept sine, Figure 514.8E-2.
  // Segments: constant displacement (double amplitude) or constant acceleration.
  const HELI_MIT = {
    ref: 'Method 514.8, Annex E, Category 24, Figure 514.8E-2',
    segments: [
      { f1: 5, f2: 14, type: 'disp', da_mm: 5.1 },   // 0.20 in double amplitude
      { f1: 14, f2: 33, type: 'acc', g: 2 },
      { f1: 33, f2: 52.1, type: 'disp', da_mm: 0.91 }, // 0.036 in double amplitude
      { f1: 52.1, f2: 500, type: 'acc', g: 5 },
    ],
    sweep: '30 min logarithmic sweep 5 → 500 Hz',
    duration: 'Up to 3 h per axis',
  };

  // ---------------------------------------------------------------------------
  // Category 14 helicopter (Annex D, Tables 514.8D-IIIa and 514.8D-IIIb).
  // ---------------------------------------------------------------------------
  const HELI = {
    ref: 'Method 514.8, Annex D, Category 14, Figure 514.8D-4, Tables 514.8D-IIIa/IIIb',
    // 4 h per axis represents a 2500 flight-hour life; minimum 0.5 h per axis.
    lifeHours: 2500, baseHours: 4, minHours: 0.5, mSine: 6, mRandom: 7.5,
    aircraft: [
      { id: 'ah1', name: 'AH-1', p: 5.40, n: 2, t: 27.7, m: 2 },
      { id: 'ah6j', name: 'AH-6J', p: 7.95, n: 5, t: 47.3, m: 2 },
      { id: 'ah6m', name: 'AH-6M', p: 7.92, n: 6, t: 44.4, m: 4 },
      { id: 'ah64e', name: 'AH-64 (early)', p: 4.82, n: 4, t: 23.4, m: 4 },
      { id: 'ah64l', name: 'AH-64 (late)', p: 4.86, n: 4, t: 23.6, m: 4 },
      { id: 'mh6h', name: 'MH-6H', p: 7.80, n: 5, t: 47.5, m: 2 },
      { id: 'oh6a', name: 'OH-6A', p: 8.10, n: 4, t: 51.8, m: 2 },
      { id: 'oh58ac', name: 'OH-58A/C', p: 5.90, n: 2, t: 43.8, m: 2 },
      { id: 'oh58d', name: 'OH-58D', p: 6.60, n: 4, t: 39.7, m: 2 },
      { id: 'uh1', name: 'UH-1', p: 5.40, n: 2, t: 27.7, m: 2 },
      { id: 'custom', name: 'Custom rotor…', p: 4.3, n: 4, t: 19.8, m: 4 },
    ],
    // Locations: random W0 / W1, frequency split, upper limit ft and peak sine
    // acceleration A(f) in g.
    locations: {
      general: {
        name: 'General (fuselage, cabin)', w0: 0.001, w1: 0.01, fLow: 3, fSplit: 10, ft: 500,
        amp: (f) => f <= 10 ? 0.70 / (10.70 - f) : f <= 25 ? 0.10 * f : f <= 40 ? 2.50 : f <= 50 ? 6.50 - 0.10 * f : 1.50,
        ampText: ['3–10 Hz: 0.70 / (10.70 − f)', '10–25 Hz: 0.10·f', '25–40 Hz: 2.50', '40–50 Hz: 6.50 − 0.10·f', '50–500 Hz: 1.50'],
      },
      panel: {
        name: 'Instrument panel', w0: 0.001, w1: 0.01, fLow: 3, fSplit: 10, ft: 500,
        amp: (f) => f <= 10 ? 0.70 / (10.70 - f) : f <= 25 ? 0.070 * f : f <= 40 ? 1.750 : f <= 50 ? 4.550 - 0.070 * f : 1.050,
        ampText: ['3–10 Hz: 0.70 / (10.70 − f)', '10–25 Hz: 0.070·f', '25–40 Hz: 1.750', '40–50 Hz: 4.550 − 0.070·f', '50–500 Hz: 1.050'],
      },
      stores: {
        name: 'External stores', w0: 0.002, w1: 0.02, fLow: 3, fSplit: 10, ft: 500,
        amp: (f) => f <= 10 ? 0.70 / (10.70 - f) : f <= 25 ? 0.150 * f : f <= 40 ? 3.750 : f <= 50 ? 9.750 - 0.150 * f : 2.250,
        ampText: ['3–10 Hz: 0.70 / (10.70 − f)', '10–25 Hz: 0.150·f', '25–40 Hz: 3.750', '40–50 Hz: 9.750 − 0.150·f', '50–500 Hz: 2.250'],
      },
      drive: {
        name: 'On / near drive system (gearbox, shafts)', w0: 0.002, w1: 0.02, fLow: 5, fSplit: 50, ft: 2000,
        amp: (f) => f <= 50 ? 0.10 * f : 5.0 + 0.010 * f,
        ampText: ['5–50 Hz: 0.10·f', '50–2000 Hz: 5.0 + 0.010·f'],
      },
    },
    notes: [
      'Tones f1…f4 for the main rotor are 1P, n·1P, 2n·1P and 3n·1P (n = blades). For materiel in the plane of the tail rotor disc use the tail rotor (1T, m blades); where zones overlap include both sets.',
      'For drive-system locations, use the shaft speed 1S and its harmonics (1S, 2S, 3S, 4S) of the nearest gearbox or shaft.',
      'CH-47D and UH-60 parameters are not tabulated in 810H; the standard refers to TOP 01-2-603. Enter their rotor data with “Custom rotor”.',
      'Tones above ft are not applied. Rotor speed is nearly constant in flight; if your aircraft’s rotor speed range is wider, sweep each tone over it.',
    ],
  };

  // ---------------------------------------------------------------------------
  // Category 5 loose cargo (Procedure II).
  // ---------------------------------------------------------------------------
  const LOOSE_CARGO = {
    ref: 'Method 514.8, Annex C, Category 5 (Procedure II, loose cargo)',
    text: 'Package-tester motion: 2.54 cm (1 in) diameter circular orbit at 5 Hz (300 rpm, circular synchronous mode). 20 minutes represent 240 km (150 mi) of transport on a truck bed with the cargo unrestrained.',
    minutes: 20, perKm: 240,
  };

  // ---------------------------------------------------------------------------
  // Method 516.8 shock defaults.
  // ---------------------------------------------------------------------------
  const SHOCK = {
    // SRS for use if measured data are not available (Procedures I and V).
    srs: [
      { id: 'funcFlight', test: 'Functional shock', who: 'Flight vehicle materiel', peak: 20, te: '15–23', fx: 45 },
      { id: 'funcGround', test: 'Functional shock', who: 'Ground materiel', peak: 40, te: '15–23', fx: 45 },
      { id: 'crashFlight', test: 'Crash hazard', who: 'Flight vehicle materiel', peak: 40, te: '15–23', fx: 45 },
      { id: 'crashGround', test: 'Crash hazard', who: 'Ground materiel', peak: 75, te: '8–13', fx: 80 },
    ],
    // Terminal-peak sawtooth alternatives when SRS testing is not possible.
    sawtooth: [
      { id: 'funcFlight', proc: 'I', test: 'Functional shock', who: 'Flight vehicle materiel', g: 20, ms: 11, note: '' },
      { id: 'funcGround', proc: 'I', test: 'Functional shock', who: 'Ground materiel', g: 40, ms: 11, note: 'For materiel mounted only in trucks and semi-trailers use 20 g.' },
      { id: 'crashFlight', proc: 'V', test: 'Crash hazard', who: 'Flight vehicle materiel', g: 40, ms: 11, note: 'Recommended for materiel not shock-mounted and under 136 kg (300 lb).' },
      { id: 'crashGround', proc: 'V', test: 'Crash hazard', who: 'Ground materiel', g: 75, ms: 6, note: '' },
    ],
    shocksPerAxis: 'SRS: 3 shocks in each direction of each axis (18 total). Classical pulse: 3 positive + 3 negative per axis (18 total).',
    // Procedure IV transit drop (packaged or as transported).
    drop: [
      { maxKg: 45.4, dimMax: 91, cm: 122, desc: 'Each face, edge and corner — 26 drops (may be split over up to 5 test items)', mass: 'Under 45.4 kg (100 lb), manpacked or man-portable', dim: 'Under 91 cm (36 in)' },
      { maxKg: 45.4, dimMax: Infinity, cm: 76, desc: 'Each face, edge and corner — 26 drops (may be split over up to 5 test items)', mass: 'Under 45.4 kg (100 lb), manpacked or man-portable', dim: '91 cm (36 in) and over' },
      { maxKg: 90.8, dimMax: 91, cm: 76, desc: 'Each corner — 8 drops', mass: '45.4–90.8 kg (100–200 lb)', dim: 'Under 91 cm (36 in)' },
      { maxKg: 90.8, dimMax: Infinity, cm: 61, desc: 'Each corner — 8 drops', mass: '45.4–90.8 kg (100–200 lb)', dim: '91 cm (36 in) and over' },
      { maxKg: 454, dimMax: Infinity, cm: 61, desc: 'Each bottom edge and the bottom face or skids — 5 drops (rotational drops for items over 91 cm: one end on a 13 cm block, the other on a 30 cm block, then raised)', mass: '90.8–454 kg (200–1000 lb)', dim: 'Any' },
      { maxKg: Infinity, dimMax: Infinity, cm: 46, desc: 'Edgewise drop: one drop per bottom edge — 4 drops (one base edge on a 13–15 cm sill)', mass: 'Over 454 kg (1000 lb)', dim: 'No limit' },
    ],
    bench: 'Raise one edge 100 mm (4 in) above a solid wooden bench top (≥ 4.25 cm thick), or until the chassis is at 45°, or to the point of balance, whichever is less, and let it fall. Four drops per practical edge on each face the item could be placed on during servicing.',
  };

  // Test-time compression exponents (Method 514.8 Annex A).
  const FATIGUE = { mRandom: 7.5, mSine: 6 };

  root.MIL_DATA = { PROFILES, HELI, HELI_MIT, LOOSE_CARGO, SHOCK, FATIGUE };
})(typeof window !== 'undefined' ? window : globalThis);
