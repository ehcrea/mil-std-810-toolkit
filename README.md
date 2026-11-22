# MIL-STD-810 Vibration & Shock Selector

**Live:** https://ehcrea.github.io/mil-std-810-toolkit/

A browser-based tool that turns a product's **life cycle** into a starting **MIL-STD-810H test plan**. Tick the phases the item will see (highway truck, military wheeled vehicle, loose cargo, jet cargo, helicopter, unknown environment, operational shock, crash hazard, transit drop, bench handling), enter distances, take-offs or flight hours, and it gives:

- A **test plan table**: every test with its Method 514.8 / 516.8 reference, level, axes and duration per axis and in total, plus the total shaker time
- A **profile viewer** with a log-log ASD chart (per axis or unknown-orientation envelope), breakpoint table with slopes, Grms, velocity and 3σ displacement, and **CSV export** for a vibration controller
- **Helicopter sine-on-random** (Category 14): tones f1…f4 from the rotor table or a custom rotor, amplitude laws for general, instrument panel, external stores and drive-system locations, and duration scaling from flight hours with the 0.5 h minimum and fatigue-equivalent level reduction
- A **shaker check**: force, stroke and velocity against your shaker's ratings
- **Shock and drop**: default SRS levels and terminal-peak sawtooth alternatives with ΔV, the transit drop height and drop set from mass and size, and bench handling
- A **PSD calculator** for any breakpoint table (Grms, velocity, displacement, dB scaling) and a **test-time compression** calculator (Annex A, m = 7.5 random, m = 6 sine)

Light and dark themes, printable to PDF, installable to a phone's home screen, and every input can be shared as a link.

> These are the standard's **default** levels for use when no measured data exist. MIL-STD-810 is a tailoring standard: measured platform data and the contract's tailoring take precedence. Confirm levels against the current revision before testing.

## Data

| Profile | MIL-STD-810H source | Printed rms |
|---|---|---|
| US highway truck (common carrier), V / T / L and envelope | Method 514.8 Annex C, Category 4, Figure 514.8C-2 / Table 514.8C-I; Table 514.8C-II | 1.08 / 0.21 / 0.76 g; 1.17 g |
| Composite wheeled vehicle, V / T / L and envelope | Annex C, Category 4, Figure 514.8C-6 / Table 514.8C-VII; Table 514.8C-VIII | 2.24 / 1.45 / 1.32 g; 2.24 g |
| Loose cargo | Annex C, Category 5 (Procedure II) | — |
| Jet aircraft cargo (general, C-5, KC-10, KC-135/E-3, C-17, T-43A) | Annex C, Category 7, Table 514.8C-IX | 4.02, 2.11, 2.38, 2.80, 4.43, 3.54 g |
| Helicopter sine-on-random | Annex D, Category 14, Figure 514.8D-4, Tables 514.8D-IIIa/IIIb | — |
| General minimum integrity | Annex E, Category 24, Figure 514.8E-1 | 7.7 g |
| Helicopter minimum integrity (swept sine) | Annex E, Figure 514.8E-2 | — |
| Shock: default SRS, sawtooth pulses, transit drop, bench handling | Method 516.8, Procedures I, IV, V, VI | — |

The 810H transport curves differ from 810G (the composite wheeled vehicle curve was replaced and the common carrier curves start at 5 Hz). The two-wheeled trailer, propeller aircraft, jet operational, store and shipboard categories are not included yet.

## Method

Breakpoints are joined by straight lines on log-log axes and integrated exactly per segment, so Grms, velocity rms (÷(2πf)²) and displacement rms (÷(2πf)⁴) have no discretisation error. The tests check every transcribed curve against the rms value printed in the standard and reproduce the standard's own helicopter duration-scaling example (1.944 g → 1.432 g).

## Run it

Static site, no build step, no dependencies:

```bash
python3 -m http.server 8790
```

Then go to http://localhost:8790. It can be hosted on GitHub Pages as is.

## Tests

```bash
node tests/calc.test.js
```

## Project layout

| File | Purpose |
|---|---|
| `js/data.js` | MIL-STD-810H breakpoints, rotor table, amplitude laws, shock and drop tables |
| `js/calc.js` | PSD integration, helicopter spectrum, time compression, shaker check, shock helpers |
| `js/app.js` | Questionnaire, test plan, charts, CSV export, sharing and dialogs |
| `css/style.css` | Styles (shared design with the other ehcrea calculators) |

## Install as an app and use it offline

The calculator is a Progressive Web App: after the first visit it works without an internet connection, in light and dark mode.

- **Chrome or Edge (macOS, Windows, Linux):** click the install icon at the right of the address bar, or menu › *Cast, save and share* › *Install page as app*.
- **Safari on macOS (Sonoma or later):** *File* › *Add to Dock*.
- **iPhone / iPad:** Share › *Add to Home Screen*. **Android:** menu › *Install app*.

Updates install themselves: when you are online the newest version is always loaded, and the offline copy is refreshed in the background.

**Maintainers:** `sw.js` is generated. After changing, adding or removing any file of the site, run `node tools/build-sw.js` and commit `sw.js` (the cache version is a hash of all files, so this is what makes the update reach installed copies). The tests fail if it is out of date (`node tools/build-sw.js --check`).

## License

[MIT](LICENSE) © 2026 Eren Tozlu · [ehcrea.com](https://ehcrea.com)
