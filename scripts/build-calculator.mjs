#!/usr/bin/env node
// Bakes the default city comparison into cost-of-living-calculator.html so
// crawlers (and the first paint) see real numbers, not a blank shell. Renders
// with the SAME logic the browser uses: site/assets/calc-render.js.
// Run:  npm run calculator
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const PAGE = path.join(SITE, 'cost-of-living-calculator.html');
const RENDER = path.join(SITE, 'assets', 'calc-render.js');
const DATA_FILE = path.join(SITE, 'assets', 'cost-data.json');

const DEFAULT_FROM = 'new-york-ny';
const DEFAULT_TO = 'berlin';
const START = '<!-- CALC:DEFAULT start -->';
const END = '<!-- CALC:DEFAULT end -->';

// Load the shared render module. It assigns globalThis.CalcRender via an IIFE,
// so indirect eval runs it in this module's global scope.
(0, eval)(fs.readFileSync(RENDER, 'utf8'));
const CalcRender = globalThis.CalcRender;
if (!CalcRender) throw new Error('calc-render.js did not expose CalcRender');

const DATA = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const renderer = CalcRender.makeRenderer(DATA);
const resultsHTML = renderer.renderResults(DEFAULT_FROM, DEFAULT_TO, 0);

const block = `${START}\n      <div id="calc-results">\n${resultsHTML}\n      </div>\n      ${END}`;

let html = fs.readFileSync(PAGE, 'utf8');
const startIdx = html.indexOf(START);
const endIdx = html.indexOf(END);
if (startIdx === -1 || endIdx === -1) {
  throw new Error('CALC:DEFAULT markers not found in cost-of-living-calculator.html');
}
html = html.slice(0, startIdx) + block + html.slice(endIdx + END.length);
fs.writeFileSync(PAGE, html);

const emdash = /[–—]/.test(resultsHTML);
console.log(`calculator default baked: ${DATA.usCities[DEFAULT_FROM].name} vs ${DATA.deCities[DEFAULT_TO].name} (${resultsHTML.length} chars)${emdash ? ' [WARN: en/em dash in output]' : ''}`);
