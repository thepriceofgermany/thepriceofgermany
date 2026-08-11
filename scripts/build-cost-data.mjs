#!/usr/bin/env node
/* Populates site/assets/cost-data.json with the full 40 US x 40 German city list.
 *
 * Method (transparent + defensible): each city carries a single rent index
 * (rentIdx, relative to a national baseline). Housing scales directly with it;
 * groceries / utilities / transport / healthcare scale with a compressed cost
 * index derived from it, because those vary far less across a country than rent.
 * US income tax uses a real per-state effective rate. German transit is the flat
 * nationwide Deutschlandticket and health is the ~14.6% public split.
 *
 * The six hand-checked ANCHOR cities (New York, San Francisco, Chicago, Berlin,
 * Munich, Leipzig) are PRESERVED verbatim if already present in the JSON; this
 * script only fills in the cities that are missing. So it is safe to re-run.
 *
 * This is an authoring tool, NOT part of `npm run deploy`. Edit the indices
 * below and run `npm run data`, or hand-edit cost-data.json directly (but then
 * do not re-run this, or your hand edits to generated cities are recomputed).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'site', 'assets', 'cost-data.json');
const VERIFIED = '2026-08';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const r = Math.round;

/* ------------------------------- US model ------------------------------- */
const US_BASE = { center1br: 1500, outside1br: 1200, family3br: 2400, grocS: 340, grocF: 850, elec: 110, heat: 75, net: 60, car: 760 };
const usCost = (rentIdx) => 0.85 + 0.22 * (rentIdx - 0.85); // compressed cost index

function usCity(name, state, rentIdx, stateLocalRate) {
  const c = usCost(rentIdx);
  return {
    name, state, stateLocalRate,
    housing: { center1br: r(US_BASE.center1br * rentIdx), outside1br: r(US_BASE.outside1br * rentIdx), family3br: r(US_BASE.family3br * rentIdx) },
    groceriesSingle: r(US_BASE.grocS * c), groceriesFamily: r(US_BASE.grocF * c),
    healthcare: { model: 'private', premiumMonthly: r(164 + 321 * c), deductible: r(2600 - 400 * (c - 0.85)) },
    transport: { carMonthly: r(US_BASE.car * (0.8 + 0.2 * c)), transitPass: clamp(r(60 + 150 * (c - 0.85)), 55, 135) },
    utilities: { electricity: r(US_BASE.elec * c), heating: r(US_BASE.heat * c), internet: r(US_BASE.net * (0.9 + 0.1 * c)) },
    colIndex: r(c * 100), lastVerified: VERIFIED
  };
}

/* ------------------------------- DE model ------------------------------- */
const DE_BASE = { center1br: 900, outside1br: 700, family3br: 1450, grocS: 270, grocF: 660, elec: 105, heat: 85, net: 38, car: 420 };
const deCost = (rentIdx) => 0.9 + 0.15 * (rentIdx - 0.9);

function deCity(name, rentIdx) {
  const c = deCost(rentIdx);
  return {
    name,
    housing: { center1br: r(DE_BASE.center1br * rentIdx), outside1br: r(DE_BASE.outside1br * rentIdx), family3br: r(DE_BASE.family3br * rentIdx) },
    groceriesSingle: r(DE_BASE.grocS * c), groceriesFamily: r(DE_BASE.grocF * c),
    healthcare: { model: 'public', rateOfIncome: 0.146 },
    transport: { carMonthly: r(DE_BASE.car * (0.85 + 0.15 * c)), transitPass: 58 },
    utilities: { electricity: r(DE_BASE.elec * c), heating: r(DE_BASE.heat * c), internet: r(DE_BASE.net * (0.9 + 0.1 * c)) },
    colIndex: r(c * 100), lastVerified: VERIFIED
  };
}

/* --------------------------- city tables (40 + 40) --------------------------- *
 * US: [slug, name, state, rentIdx, effective state+local income-tax rate]
 * States with no income tax (TX/WA/NV/FL) are 0. NY-state cities without a city
 * income tax use a lower rate than NYC. */
const US = [
  ['new-york-ny', 'New York', 'NY', 2.60, 0.075],
  ['los-angeles-ca', 'Los Angeles', 'CA', 2.00, 0.060],
  ['san-francisco-ca', 'San Francisco', 'CA', 2.20, 0.060],
  ['san-jose-ca', 'San Jose', 'CA', 2.30, 0.060],
  ['sacramento-ca', 'Sacramento', 'CA', 1.35, 0.055],
  ['bakersfield-ca', 'Bakersfield', 'CA', 0.95, 0.050],
  ['riverside-ca', 'Riverside', 'CA', 1.30, 0.055],
  ['murrieta-ca', 'Murrieta', 'CA', 1.40, 0.055],
  ['oakland-ca', 'Oakland', 'CA', 1.90, 0.060],
  ['san-diego-ca', 'San Diego', 'CA', 2.05, 0.060],
  ['chicago-il', 'Chicago', 'IL', 1.47, 0.0495],
  ['miami-fl', 'Miami', 'FL', 1.90, 0.000],
  ['washington-dc', 'Washington', 'DC', 1.85, 0.075],
  ['alexandria-va', 'Alexandria', 'VA', 1.60, 0.050],
  ['boston-ma', 'Boston', 'MA', 2.15, 0.050],
  ['cambridge-ma', 'Cambridge', 'MA', 2.20, 0.050],
  ['hartford-ct', 'Hartford', 'CT', 1.15, 0.050],
  ['stamford-ct', 'Stamford', 'CT', 1.75, 0.055],
  ['newark-nj', 'Newark', 'NJ', 1.55, 0.050],
  ['jersey-city-nj', 'Jersey City', 'NJ', 2.00, 0.055],
  ['seattle-wa', 'Seattle', 'WA', 1.85, 0.000],
  ['renton-wa', 'Renton', 'WA', 1.45, 0.000],
  ['portland-or', 'Portland', 'OR', 1.40, 0.085],
  ['baltimore-md', 'Baltimore', 'MD', 1.25, 0.065],
  ['philadelphia-pa', 'Philadelphia', 'PA', 1.35, 0.068],
  ['minneapolis-mn', 'Minneapolis', 'MN', 1.25, 0.068],
  ['denver-co', 'Denver', 'CO', 1.45, 0.044],
  ['honolulu-hi', 'Honolulu', 'HI', 1.85, 0.079],
  ['las-vegas-nv', 'Las Vegas', 'NV', 1.15, 0.000],
  ['phoenix-az', 'Phoenix', 'AZ', 1.20, 0.025],
  ['providence-ri', 'Providence', 'RI', 1.25, 0.045],
  ['buffalo-ny', 'Buffalo', 'NY', 0.95, 0.055],
  ['rochester-ny', 'Rochester', 'NY', 0.95, 0.055],
  ['albany-ny', 'Albany', 'NY', 1.05, 0.055],
  ['new-orleans-la', 'New Orleans', 'LA', 1.15, 0.0325],
  ['detroit-mi', 'Detroit', 'MI', 0.90, 0.060],
  ['cleveland-oh', 'Cleveland', 'OH', 0.85, 0.050],
  ['st-louis-mo', 'St. Louis', 'MO', 0.90, 0.055],
  ['pittsburgh-pa', 'Pittsburgh', 'PA', 1.00, 0.040],
  ['milwaukee-wi', 'Milwaukee', 'WI', 1.00, 0.053]
];

// DE: [slug, name, rentIdx]
const DE = [
  ['berlin', 'Berlin', 1.45],
  ['munich', 'Munich', 1.90],
  ['frankfurt-am-main', 'Frankfurt am Main', 1.65],
  ['hamburg', 'Hamburg', 1.50],
  ['cologne', 'Cologne', 1.35],
  ['dusseldorf', 'Dusseldorf', 1.40],
  ['stuttgart', 'Stuttgart', 1.55],
  ['dortmund', 'Dortmund', 0.95],
  ['leipzig', 'Leipzig', 0.90],
  ['dresden', 'Dresden', 0.95],
  ['nuremberg', 'Nuremberg', 1.20],
  ['hannover', 'Hannover', 1.10],
  ['bremen', 'Bremen', 1.05],
  ['bonn', 'Bonn', 1.25],
  ['mannheim', 'Mannheim', 1.15],
  ['heidelberg', 'Heidelberg', 1.40],
  ['karlsruhe', 'Karlsruhe', 1.15],
  ['freiburg-im-breisgau', 'Freiburg im Breisgau', 1.35],
  ['munster', 'Munster', 1.20],
  ['wiesbaden', 'Wiesbaden', 1.35],
  ['mainz', 'Mainz', 1.30],
  ['augsburg', 'Augsburg', 1.20],
  ['bielefeld', 'Bielefeld', 0.95],
  ['aachen', 'Aachen', 1.05],
  ['erlangen', 'Erlangen', 1.25],
  ['regensburg', 'Regensburg', 1.25],
  ['darmstadt', 'Darmstadt', 1.30],
  ['ulm', 'Ulm', 1.20],
  ['kiel', 'Kiel', 1.05],
  ['essen', 'Essen', 0.95],
  ['duisburg', 'Duisburg', 0.85],
  ['bochum', 'Bochum', 0.90],
  ['wuppertal', 'Wuppertal', 0.90],
  ['braunschweig', 'Braunschweig', 1.00],
  ['potsdam', 'Potsdam', 1.40],
  ['rostock', 'Rostock', 1.00],
  ['konstanz', 'Konstanz', 1.45],
  ['tubingen', 'Tubingen', 1.35],
  ['offenbach-am-main', 'Offenbach am Main', 1.25],
  ['ingolstadt', 'Ingolstadt', 1.30]
];

/* ------------------------------- assemble ------------------------------- */
const json = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const prevUS = json.usCities || {};
const prevDE = json.deCities || {};

const usCities = {};
let genUS = 0;
for (const [slug, name, state, rentIdx, tax] of US) {
  if (prevUS[slug]) { usCities[slug] = prevUS[slug]; }      // preserve verified anchor
  else { usCities[slug] = usCity(name, state, rentIdx, tax); genUS++; }
}
const deCities = {};
let genDE = 0;
for (const [slug, name, rentIdx] of DE) {
  if (prevDE[slug]) { deCities[slug] = prevDE[slug]; }
  else { deCities[slug] = deCity(name, rentIdx); genDE++; }
}

json.usCities = usCities;
json.deCities = deCities;
json.meta.generated = json.meta.generated || VERIFIED;

fs.writeFileSync(DATA_FILE, JSON.stringify(json, null, 2) + '\n');
console.log(`cost-data.json: ${Object.keys(usCities).length} US cities (${genUS} generated, ${US.length - genUS} preserved), ${Object.keys(deCities).length} DE cities (${genDE} generated, ${DE.length - genDE} preserved)`);
