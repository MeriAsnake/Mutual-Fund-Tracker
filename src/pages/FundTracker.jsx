import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ── Theme definitions ─────────────────────────────────────────────────────────
const DARK = {
  bg:           "#060A10",
  bgModal:      "#0B111C",
  bgTableHead:  "#080E19",
  surface:      "rgba(255,255,255,0.025)",
  surfaceHover: "rgba(255,255,255,0.045)",
  border:       "#1A2235",
  muted:        "#4A5568",
  mutedLight:   "#64748B",
  text:         "#D8E4F0",
  textDim:      "#8899AA",
  green:        "#05D48A",
  red:          "#F05A5A",
  blue:         "#4B9EFF",
  amber:        "#F5A524",
  gridLine:     "rgba(26,34,53,0.5)",
  tooltipBg:    "#0B111C",
  scrollTrack:  "#060A10",
  scrollThumb:  "#1A2235",
  calIcon:      "invert(0.5)",
  toggleBg:     "#1A2235",
  toggleKnob:   "#4A5568",
  isDark:       true,
};
const LIGHT = {
  bg:           "#F0F4FA",
  bgModal:      "#FFFFFF",
  bgTableHead:  "#F8FAFD",
  surface:      "rgba(255,255,255,0.8)",
  surfaceHover: "rgba(255,255,255,1)",
  border:       "#D8E2EF",
  muted:        "#8A9BB5",
  mutedLight:   "#A0AEC0",
  text:         "#1A2235",
  textDim:      "#4A5568",
  green:        "#0BBF7A",
  red:          "#E04040",
  blue:         "#2B7EE0",
  amber:        "#D48C10",
  gridLine:     "rgba(216,226,239,0.6)",
  tooltipBg:    "#FFFFFF",
  scrollTrack:  "#F0F4FA",
  scrollThumb:  "#D8E2EF",
  calIcon:      "invert(0)",
  toggleBg:     "#D8E2EF",
  toggleKnob:   "#FFFFFF",
  isDark:       false,
};

const ThemeCtx = createContext(DARK);
const useT = () => useContext(ThemeCtx);

// ── Palette ───────────────────────────────────────────────────────────────────
const PALETTE = ["#05D48A","#4B9EFF","#F5A524","#C97EFF","#FF6F91","#00C9E0","#FF9A3C","#A8FF3E"];
const col = i => PALETTE[i % PALETTE.length];

// ── Storage ───────────────────────────────────────────────────────────────────
const KEY        = "mf-tracker-v5";
const KEY_MANUAL = "mf-tracker-manual";   // picks added directly in dashboard
const KEY_THM    = "mf-tracker-theme";

// 🔗 REPLACE THIS URL with your Google Apps Script deployment URL
const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwa3uu1XSRhQrXj9c4lJgHwZMct3rlzoejPUD9xF-4cA0z6RYX8c1xpFVXOtNJQIe0/exec";

// Save/load price cache (applies to ALL picks regardless of source)
async function saveStorage(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}
async function loadPriceCache() {
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : []; }
  catch { return []; }
}

// Save/load manually-added picks (added via "+ Add Pick" button)
async function saveManualPicks(picks) {
  try { localStorage.setItem(KEY_MANUAL, JSON.stringify(picks)); } catch {}
}
async function loadManualPicks() {
  try { const v = localStorage.getItem(KEY_MANUAL); return v ? JSON.parse(v) : []; }
  catch { return []; }
}

// Fetch picks from Google Sheet
async function fetchSheetPicks() {
  if (!SHEET_API_URL || SHEET_API_URL === "https://script.google.com/macros/s/AKfycbwa3uu1XSRhQrXj9c4lJgHwZMct3rlzoejPUD9xF-4cA0z6RYX8c1xpFVXOtNJQIe0/execE") return [];

  let json;
  try {
    // Try own Vercel proxy first (works on deployed Vercel)
    const proxyUrl = `/api/sheet?url=${encodeURIComponent(SHEET_API_URL)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const data = await res.json();
      if (!data.error) { json = data; }
    }
  } catch {}

  // Fallback: direct fetch (works locally)
  if (!json) {
    try {
      const res = await fetch(SHEET_API_URL, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
    } catch (e) {
      throw new Error(`Cannot reach sheet: ${e.message}`);
    }
  }

  console.log("📊 Full sheet response:", json);

  // Handle any response shape — {picks:[...]}, {data:[...]}, {values:[...]}, or bare array
  let rows = [];
  if (Array.isArray(json))             rows = json;
  else if (Array.isArray(json.picks))  rows = json.picks;
  else if (Array.isArray(json.data))   rows = json.data;
  else if (Array.isArray(json.values)) rows = json.values;
  else {
    // Last resort: find the first array in the response
    const firstArr = Object.values(json).find(v => Array.isArray(v));
    if (firstArr) rows = firstArr;
  }

  console.log(`📋 ${rows.length} rows found. Keys in first row:`, rows[0] ? Object.keys(rows[0]) : "none");

  if (rows.length === 0) {
    throw new Error(`Sheet returned 0 rows. Raw response: ${JSON.stringify(json).slice(0, 200)}`);
  }

  // Flexible column matching — tries many variations of your column names
  const getField = (row, ...names) => {
    for (const name of names) {
      // Try exact, lowercase, trimmed
      for (const key of Object.keys(row)) {
        if (key.trim().toLowerCase() === name.toLowerCase()) {
          const val = row[key];
          if (val !== undefined && val !== null && val !== "") return val;
        }
      }
    }
    return "";
  };

  const toDateStr = (val) => {
    if (!val) return "";
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
    if (typeof val === "string") { const d = new Date(val); if (!isNaN(d)) return d.toISOString().slice(0, 10); }
    if (typeof val === "number") { const d = new Date((val - 25569) * 86400 * 1000); if (!isNaN(d)) return d.toISOString().slice(0, 10); }
    return String(val).slice(0, 10);
  };

  const picks = rows.map((sp, i) => {
    const symbol      = String(getField(sp, "Fund Symbol", "symbol", "Symbol", "ticker", "Ticker", "SYMBOL")).toUpperCase().trim();
    const company     = String(getField(sp, "Company Name", "company", "Company", "Fund Name", "name", "Name")).trim();
    const pickedDate  = toDateStr(getField(sp, "Pick Date", "pickedDate", "Picked Date", "date", "Date", "pick_date"));
    const rawExp = String(getField(sp, "Expected %", "expectedPct", "Expected", "expected", "Target %", "target") || "0").replace("%", "").trim();
    const expNum = parseFloat(rawExp) || 0;
    // Always store as whole number: if sheet sends 0.023 treat as 2.3%, if sends 2.3 keep as 2.3
    const expectedPct = Math.abs(expNum) > 0 && Math.abs(expNum) < 1 ? expNum * 100 : expNum;

    console.log(`  Row ${i+1}: symbol="${symbol}" date="${pickedDate}" exp="${expectedPct}" company="${company}"`);

    // If pick date falls on weekend, go BACK to previous Friday
    // Saturday → Friday (back 1), Sunday → Friday (back 2)
    const pdObj = new Date(pickedDate + "T12:00:00");
    if (pdObj.getDay() === 6) pdObj.setDate(pdObj.getDate() - 1); // Sat → Fri
    if (pdObj.getDay() === 0) pdObj.setDate(pdObj.getDate() - 2); // Sun → Fri
    const adjustedDate = pdObj.getFullYear() + "-" + String(pdObj.getMonth()+1).padStart(2,"0") + "-" + String(pdObj.getDate()).padStart(2,"0");
    return { id: `sheet-${symbol}-${adjustedDate}`, symbol, company, pickedDate: adjustedDate, expectedPct, _source: "sheet" };
  });

  const valid = picks.filter(p => {
    const ok = p.symbol && p.pickedDate && p.pickedDate.length === 10;
    if (!ok) console.warn(`  ✗ Skipped row — missing symbol or valid date:`, p);
    return ok;
  });

  if (valid.length === 0) {
    throw new Error(`Got ${rows.length} rows but 0 valid picks. Check column names match: "Fund Symbol", "Company Name", "Pick Date", "Expected %". Raw first row: ${JSON.stringify(rows[0]).slice(0, 200)}`);
  }

  return valid;
}

// Merge all picks: sheet picks + manual picks, apply cached price data on top
function mergePicks(sheetPicks, manualPicks, priceCache) {
  const all = [...sheetPicks];
  // Add manual picks that don't already exist in sheet
  manualPicks.forEach(mp => {
    const exists = all.some(p => p.symbol === mp.symbol && p.pickedDate === mp.pickedDate);
    if (!exists) all.push({ ...mp, _source: "manual" });
  });
  // Apply cached price data (prices, priceSource, priceNote, lastFetched)
  return all.map(pick => {
    const cached = priceCache.find(c => c.id === pick.id || (c.symbol === pick.symbol && c.pickedDate === pick.pickedDate));
    if (!cached) return pick;
    return { ...pick, prices: cached.prices, priceSource: cached.priceSource, priceNote: cached.priceNote, lastFetched: cached.lastFetched, _fetching: cached._fetching };
  });
}

// Initial load: get everything
async function loadStorage() {
  try {
    const [priceCache, manualPicks, thm] = await Promise.all([
      loadPriceCache(), loadManualPicks(),
      localStorage.getItem(KEY_THM) || "dark",
    ]);
    let sheetPicks = [];
    try { sheetPicks = await fetchSheetPicks(); } catch {}
    return mergePicks(sheetPicks, manualPicks, priceCache);
  } catch {
    try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : []; }
    catch { return []; }
  }
}

async function loadTheme() {
  try { return localStorage.getItem(KEY_THM) || "dark"; }
  catch { return "dark"; }
}
async function saveTheme(val) {
  try { localStorage.setItem(KEY_THM, val); } catch {}
}

// ── Demo data ─────────────────────────────────────────────────────────────────
function makeDemoData() {
  return [];
}

// ── US Market Calendar ────────────────────────────────────────────────────────
// Generates NYSE/NASDAQ holidays for a given year
function getMarketHolidays(year) {
  const holidays = new Set();
  const fmt = d => d.toISOString().slice(0,10);

  // Helper: nth weekday of month (1=Mon..7=Sun)
  const nthWeekday = (y, m, weekday, n) => {
    const jsDay = weekday % 7; // Mon=1->1, Fri=5->5, Sun=7->0
    const d = new Date(y, m - 1, 1);
    let count = 0;
    while (true) {
      if (d.getDay() === jsDay) { count++; if (count === n) return new Date(d); }
      d.setDate(d.getDate() + 1);
    }
  };
  // Helper: last weekday of month
  const lastWeekday = (y, m, weekday) => {
    const jsDay = weekday % 7;
    const d = new Date(y, m, 0); // last day of month
    while (d.getDay() !== jsDay) d.setDate(d.getDate() - 1);
    return new Date(d);
  };
  // Helper: observe holiday (if Sat->Fri, if Sun->Mon)
  const observe = d => {
    const day = d.getDay();
    if (day === 6) { d.setDate(d.getDate() - 1); }
    else if (day === 0) { d.setDate(d.getDate() + 1); }
    return d;
  };

  // New Year's Day: Jan 1 (observed)
  holidays.add(fmt(observe(new Date(year, 0, 1))));
  // MLK Day: 3rd Monday of January
  holidays.add(fmt(nthWeekday(year, 1, 1, 3)));
  // Presidents' Day: 3rd Monday of February
  holidays.add(fmt(nthWeekday(year, 2, 1, 3)));
  // Good Friday: Easter - 2 days
  const easter = getEaster(year);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  holidays.add(fmt(goodFriday));
  // Memorial Day: last Monday of May
  holidays.add(fmt(lastWeekday(year, 5, 1)));
  // Juneteenth: June 19 (observed) — from 2022
  if (year >= 2022) holidays.add(fmt(observe(new Date(year, 5, 19))));
  // Independence Day: July 4 (observed)
  holidays.add(fmt(observe(new Date(year, 6, 4))));
  // Labor Day: 1st Monday of September
  holidays.add(fmt(nthWeekday(year, 9, 1, 1)));
  // Thanksgiving: 4th Thursday of November
  holidays.add(fmt(nthWeekday(year, 11, 4, 4)));
  // Christmas: Dec 25 (observed)
  holidays.add(fmt(observe(new Date(year, 11, 25))));

  return holidays;
}

// Anonymous Gregorian Easter algorithm
function getEaster(year) {
  const a = year % 19, b = Math.floor(year/100), c = year % 100;
  const d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25);
  const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30;
  const i = Math.floor(c/4), k = c % 4;
  const l = (32+2*e+2*i-h-k) % 7;
  const m = Math.floor((a+11*h+22*l)/451);
  const month = Math.floor((h+l-7*m+114)/31);
  const day = ((h+l-7*m+114) % 31) + 1;
  return new Date(year, month-1, day);
}

// Cache holidays by year
const _holidayCache = {};
function isMarketHoliday(dateStr) {
  const year = parseInt(dateStr.slice(0,4));
  if (!_holidayCache[year]) _holidayCache[year] = getMarketHolidays(year);
  return _holidayCache[year].has(dateStr);
}

function isMarketOpen(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false; // weekend
  return !isMarketHoliday(dateStr);
}

// Add N trading days to a date string
function addTradingDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  let count = 0;
  while (count < n) {
    d.setDate(d.getDate() + 1);
    const s = d.toISOString().slice(0,10);
    if (isMarketOpen(s)) count++;
  }
  return d.toISOString().slice(0,10);
}

// Count trading days elapsed from pickedDate up to today (max 5)
function tradingDaysSince(dateStr) {
  const start = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(12,0,0,0);
  if (today <= start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (true) {
    cur.setDate(cur.getDate() + 1);
    if (cur > today) break;
    const s = cur.toISOString().slice(0,10);
    if (isMarketOpen(s)) count++;
    if (count >= 5) break;
  }
  return count;
}

// Get the actual calendar date of trading day N after pickedDate
// Returns array of {tradingDay, date} for days 1-5
function getTradingDayDates(dateStr) {
  const result = [];
  let cur = dateStr;
  for (let i = 1; i <= 5; i++) {
    cur = addTradingDays(cur, 1);
    result.push({ tradingDay: i, date: cur });
  }
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0,10); }
function fmtDate(s) { return new Date(s + "T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }

// Build chart points from real NAV prices stored on pick
// pick.prices = { baseNav, d1, d2, d3, d4, d5 }
function buildDayData(pick) {
  const p = pick.prices || {};
  const base = p.baseNav;
  const pts = [{ day:0, label:"Day 0", cum:0, daily:0 }];
  if (!base) return pts;
  for (let d = 1; d <= 5; d++) {
    const nav = p[`d${d}`];
    if (nav == null) break;
    const cum = +((nav - base) / base * 100).toFixed(3);
    const prev = d === 1 ? base : (p[`d${d-1}`] ?? base);
    const daily = +((nav - prev) / prev * 100).toFixed(3);
    pts.push({ day:d, label:`Day ${d}`, cum, daily });
  }
  return pts;
}

function getCurrentPct(pick) {
  const data = buildDayData(pick);
  return data[data.length - 1]?.cum ?? null;
}

function calcHitTarget(pick) {
  const elapsed = tradingDaysSince(pick.pickedDate);
  if (elapsed < 5) return null;
  if (pick.prices?.d5 == null) return null;   // d5 missing = price not yet known
  const data = buildDayData(pick);
  if (data.length < 6) return null;
  const final = data[5].cum; // final is in % e.g. 2.5 means +2.5%
  const target = pick.expectedPct;  // also in % e.g. 2.3 means +2.3%
  if (target > 0) return final >= target;   // hit if actual return >= expected
  if (target < 0) return final <= target;   // hit if actual return <= expected (negative)
  return Math.abs(final) < 0.5;             // no target → hit if near flat
}

// ── Real Price Fetching ───────────────────────────────────────────────────────
// Uses /api/prices — a Vercel serverless function in your own project.
// This runs server-side so there are zero CORS issues, works on Vercel deployed app.
// Falls back to public proxies if running locally without the API route.

async function fetchPriceHistory(symbol, fromDate, toDate) {
  const errors = [];

  // ── Strategy 1: Own Vercel proxy (/api/prices) ─────────────────────────────
  // Works when deployed on Vercel. No CORS, no rate limits, supports mutual funds.
  try {
    const url = `/api/prices?symbol=${encodeURIComponent(symbol)}&from=${fromDate}&to=${toDate}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        errors.push(`own-proxy: not JSON (got ${ct || "unknown content-type"})`);
      } else {
        const data = await res.json();
        if (data.priceMap && Object.keys(data.priceMap).length > 0) {
          return data.priceMap;
        }
        errors.push(`own-proxy: ${data.error || "empty map"}`);
      }
    } else {
      errors.push(`own-proxy: HTTP ${res.status}`);
    }
  } catch (e) {
    errors.push(`own-proxy: ${e.message}`);
  }

  // ── Strategy 2: corsproxy + Yahoo chart (fallback for local dev) ────────────
  const p1 = Math.floor(new Date(fromDate + "T00:00:00Z").getTime() / 1000);
  const p2 = Math.floor(new Date(toDate   + "T23:59:59Z").getTime() / 1000);
  const fallbacks = [
    { name: "corsproxy+chart",    url: `https://corsproxy.io/?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${p1}&period2=${p2}`)}`, type: "json" },
    { name: "allorigins+download",url: `https://api.allorigins.win/get?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v7/finance/download/${symbol}?period1=${p1}&period2=${p2}&interval=1d&events=history`)}`, type: "csv" },
  ];

  for (const s of fallbacks) {
    try {
      const res = await fetch(s.url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) { errors.push(`${s.name}: HTTP ${res.status}`); continue; }

      if (s.type === "csv") {
        const outer = await res.json();
        const csv   = outer.contents || "";
        if (!csv || csv.includes("<html")) { errors.push(`${s.name}: got HTML`); continue; }
        const lines = csv.trim().split("\n").slice(1);
        const priceMap = {};
        for (const line of lines) {
          const cols  = line.split(",");
          const close = parseFloat(cols[4]);
          if (cols[0] && !isNaN(close)) priceMap[cols[0].trim()] = +close.toFixed(4);
        }
        if (Object.keys(priceMap).length > 0) return priceMap;
        errors.push(`${s.name}: no rows`); continue;
      }

      const raw    = await res.json();
      const json   = raw.contents ? JSON.parse(raw.contents) : raw;
      const result = json?.chart?.result?.[0];
      if (!result) { errors.push(`${s.name}: ${json?.chart?.error?.description || "no result"}`); continue; }
      const timestamps = result.timestamp || [];
      const closes     = result.indicators?.quote?.[0]?.close || [];
      const priceMap   = {};
      timestamps.forEach((ts, i) => {
        if (closes[i] == null) return;
        const d = new Date((ts + 5 * 3600) * 1000);
        priceMap[d.toISOString().slice(0, 10)] = +closes[i].toFixed(4);
      });
      if (Object.keys(priceMap).length > 0) return priceMap;
      errors.push(`${s.name}: empty`);
    } catch (e) { errors.push(`${s.name}: ${e.message}`); }
  }

  throw new Error(`Could not fetch "${symbol}". ${errors.join(" | ")}`);
}

async function fetchRealPrices(symbol, pickedDate) {
  const tradingDates = [pickedDate];
  for (let i = 1; i <= 5; i++) tradingDates.push(addTradingDays(pickedDate, i));
  const today = todayStr();
  const neededDates = tradingDates.filter(d => d <= today);

  const priceMap = await fetchPriceHistory(symbol, neededDates[0], neededDates[neededDates.length - 1]);

  // baseNav: exact date ONLY — no lookback
  // If you pick Monday, D0 = Monday's price. Never fall back to Friday.
  // D1-D5: allow lookback for holidays/early closes
  function findPrice(dateStr, exactOnly = false) {
    if (priceMap[dateStr] != null) return priceMap[dateStr];
    if (exactOnly) return null;
    for (let i = 1; i <= 3; i++) {
      const d = new Date(dateStr + "T12:00:00");
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      if (priceMap[k] != null) return priceMap[k];
    }
    return null;
  }

  const prices = {
    baseNav: findPrice(neededDates[0], true), // exact — Monday stays Monday
    d1: neededDates[1] ? findPrice(neededDates[1]) : null,
    d2: neededDates[2] ? findPrice(neededDates[2]) : null,
    d3: neededDates[3] ? findPrice(neededDates[3]) : null,
    d4: neededDates[4] ? findPrice(neededDates[4]) : null,
    d5: neededDates[5] ? findPrice(neededDates[5], true) : null, // exact-only: no lookback for D5 so stale D4 price never fakes a completion
  };

  if (prices.baseNav == null) {
    const available = Object.keys(priceMap).sort().slice(-5).join(", ");
    throw new Error(`No NAV for ${symbol} on ${neededDates[0]} yet — market may not have closed. Try refreshing after 4pm ET. Available: [${available || "none"}]`);
  }

  return { prices, source: "Yahoo Finance", note: "" };
}

// Refresh prices for a pick
async function refreshPickPrices(pick) {
  const result = await fetchRealPrices(pick.symbol, pick.pickedDate);
  if (!result.prices || typeof result.prices.baseNav !== "number") {
    throw new Error(`Bad data: ${JSON.stringify(result)}`);
  }
  return { ...pick, _fetching: false, prices: result.prices, priceSource: result.source, priceNote: result.note, lastFetched: todayStr() };
}

// ── Theme Toggle button ───────────────────────────────────────────────────────
function ThemeToggle({ isDark, onToggle }) {
  const T = useT();
  return (
    <button onClick={onToggle} title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"} style={{
      display: "flex", alignItems: "center", gap: 8, padding: "9px 14px",
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
      color: T.text, fontFamily: "'DM Mono',monospace", fontSize: 11,
    }}
    onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
    onMouseLeave={e => e.currentTarget.style.background = T.surface}
    >
      <span style={{ fontSize: 15 }}>{isDark ? "☀️" : "🌙"}</span>
      <span style={{ color: T.muted }}>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────
function Pill({ children, color, filled, size = 10 }) {
  const T = useT();
  const c = color || T.muted;
  return (
    <span style={{ background: filled ? c+"20" : "transparent", color: filled ? c : T.muted, border:`1px solid ${c}35`, borderRadius:5, padding:"2px 8px", fontSize:size, fontFamily:"'DM Mono',monospace", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}
function Pct({ v, size = 13 }) {
  const T = useT();
  const pos = v >= 0;
  return <span style={{ color:pos?T.green:T.red, background:pos?T.green+"18":T.red+"18", border:`1px solid ${pos?T.green:T.red}30`, borderRadius:6, padding:"3px 9px", fontSize:size, fontFamily:"'DM Mono',monospace", fontWeight:600, whiteSpace:"nowrap" }}>{pos?"+":""}{v.toFixed(2)}%</span>;
}
function HitBadge({ hit, size = 10 }) {
  const T = useT();
  if (hit === null) return <Pill color={T.amber} filled size={size}>⏳ Pending</Pill>;
  return hit ? <Pill color={T.green} filled size={size}>✓ Hit</Pill> : <Pill color={T.red} filled size={size}>✗ Missed</Pill>;
}
function ProgressBar({ value, color, max = 5 }) {
  const T = useT();
  return (
    <div style={{ height:3, background:T.border, borderRadius:2, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${Math.min((value/max)*100,100)}%`, background:color, borderRadius:2, transition:"width 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
    </div>
  );
}
function TTip({ active, payload, label }) {
  const T = useT();
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:T.tooltipBg, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 14px", fontFamily:"'DM Mono',monospace", fontSize:12, boxShadow:"0 12px 40px #00000030" }}>
      <p style={{ color:T.muted, margin:"0 0 6px", fontSize:10 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color:p.color, margin:"2px 0" }}>{p.name}: <b>{(+p.value)>=0?"+":""}{(+p.value).toFixed(2)}%</b></p>)}
    </div>
  );
}

// ── Excel export ──────────────────────────────────────────────────────────────
function loadXLSX() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX); s.onerror = reject;
    document.head.appendChild(s);
  });
}
async function exportToExcel(picks) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  const rows = [["Symbol","Company","Picked Date","End Date (T+5)","Expected %","Base NAV","D1 %","D2 %","D3 %","D4 %","D5 %","Hit Target?","Source"]];
  const sorted = [...picks].sort((a,b) => b.pickedDate.localeCompare(a.pickedDate));
  sorted.forEach(pick => {
    const data = buildDayData(pick);
    const hit = calcHitTarget(pick);
    const p = pick.prices || {};
    rows.push([
      pick.symbol, pick.company, pick.pickedDate, addTradingDays(pick.pickedDate,5),
      pick.expectedPct/100,
      p.baseNav||"",
      data[1]?data[1].cum/100:"", data[2]?data[2].cum/100:"",
      data[3]?data[3].cum/100:"", data[4]?data[4].cum/100:"",
      data[5]?data[5].cum/100:"",
      hit===null?"Pending":hit?"YES":"NO",
      pick.priceSource||"",
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{wch:10},{wch:32},{wch:13},{wch:13},{wch:13},{wch:9},{wch:9},{wch:9},{wch:9},{wch:9},{wch:13}];
  picks.forEach((_,i) => {
    const r = i+2;
    ["E","F","G","H","I","J"].forEach(c => { const cell = ws[c+r]; if (cell && cell.v!=="") cell.z="0.00%"; });
  });
  XLSX.utils.book_append_sheet(wb, ws, "MF Picks");
  XLSX.writeFile(wb, `MF_Picks_${todayStr()}.xlsx`);
}

// ── Add Modal ─────────────────────────────────────────────────────────────────
function AddModal({ onAdd, onClose, taken }) {
  const T = useT();
  const [symbol, setSymbol]     = useState("");
  const [company, setCompany]   = useState("");
  const [expected, setExpected] = useState("");
  const [pickedDate, setDate]   = useState(todayStr());
  const [err, setErr]           = useState("");

  const submit = () => {
    const s = symbol.trim().toUpperCase();
    const c = company.trim();
    const e = parseFloat(expected);
    if (!s) return setErr("Symbol is required");
    if (!c) return setErr("Company name is required");
    if (isNaN(e)) return setErr("Enter a valid expected % (e.g. 4.5 or -2)");
    if (!pickedDate) return setErr("Pick a date");
    if (!isMarketOpen(pickedDate)) return setErr(`${pickedDate} is not a trading day (weekend or US market holiday). Please pick a market day.`);
    if (taken.some(t => t.symbol === s && t.pickedDate === pickedDate)) return setErr(`${s} is already tracked for ${pickedDate}`);
    onAdd({ id:Date.now(), symbol:s, company:c, expectedPct:e, pickedDate });
  };

  const inp = { width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:9, color:T.text, padding:"11px 14px", fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:"none", boxSizing:"border-box", transition:"border-color 0.15s", colorScheme: T.isDark ? "dark" : "light" };
  const F = ({ label, children }) => (
    <div>
      <label style={{ display:"block", fontSize:10, color:T.muted, fontFamily:"'DM Mono',monospace", letterSpacing:"0.12em", marginBottom:7 }}>{label}</label>
      {children}
    </div>
  );
  const expVal = parseFloat(expected);
  const hasExp = !isNaN(expVal);

  return (
    <div onClick={e => e.target===e.currentTarget&&onClose()} style={{ position:"fixed", inset:0, background:"#00000090", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:T.bgModal, border:`1px solid ${T.border}`, borderRadius:18, padding:"32px 28px", width:"min(440px,100%)", boxShadow:"0 32px 80px #00000040", animation:"up 0.28s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:26 }}>
          <div>
            <h3 style={{ margin:0, fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:T.text }}>New Pick</h3>
            <p style={{ margin:"4px 0 0", fontSize:12, color:T.muted }}>Tracked for 5 days from picked date</p>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:22 }}>×</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <F label="SYMBOL *">
              <input value={symbol} onChange={e=>{setSymbol(e.target.value);setErr("");}} placeholder="e.g. VWELX" style={inp}
                onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border} onKeyDown={e=>e.key==="Enter"&&submit()} />
            </F>
            <F label="PICKED DATE *">
              <input type="date" value={pickedDate} onChange={e=>{setDate(e.target.value);setErr("");}} style={inp}
                onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border} />
              {pickedDate && !isMarketOpen(pickedDate) && (
                <div style={{ marginTop:5, fontSize:10, color:T.amber, fontFamily:"'DM Mono',monospace" }}>⚠ Not a trading day</div>
              )}
              {pickedDate && isMarketOpen(pickedDate) && (
                <div style={{ marginTop:5, fontSize:10, color:T.green, fontFamily:"'DM Mono',monospace" }}>✓ Market open</div>
              )}
            </F>
          </div>
          <F label="COMPANY / FUND NAME *">
            <input value={company} onChange={e=>{setCompany(e.target.value);setErr("");}} placeholder="e.g. Vanguard Wellington Fund" style={inp}
              onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border} onKeyDown={e=>e.key==="Enter"&&submit()} />
          </F>
          <F label="EXPECTED % CHANGE (5 DAYS) *">
            <input type="number" value={expected} onChange={e=>{setExpected(e.target.value);setErr("");}} placeholder="e.g. 4.5 or -2" style={inp}
              onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border} onKeyDown={e=>e.key==="Enter"&&submit()} />
          </F>
        </div>
        {err && <p style={{ color:T.red, fontSize:12, margin:"12px 0 0", fontFamily:"'DM Mono',monospace" }}>⚠ {err}</p>}
        {hasExp && (
          <div style={{ marginTop:14, padding:"10px 14px", borderRadius:9, background:expVal>=0?T.green+"15":T.red+"15", border:`1px solid ${expVal>=0?T.green:T.red}30`, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:18 }}>{expVal>=0?"📈":"📉"}</span>
            <span style={{ fontSize:12, color:T.muted }}>Expecting <span style={{ color:expVal>=0?T.green:T.red, fontWeight:600 }}>{expVal>=0?"+":""}{expVal}%</span> · End: <b style={{ color:T.text }}>{pickedDate?addTradingDays(pickedDate,5):"—"}</b></span>
          </div>
        )}
        <div style={{ display:"flex", gap:10, marginTop:22 }}>
          <button onClick={onClose} style={{ flex:1, padding:12, background:"none", border:`1px solid ${T.border}`, borderRadius:9, color:T.muted, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:13 }}>Cancel</button>
          <button onClick={submit} style={{ flex:2, padding:12, background:T.green, border:"none", borderRadius:9, color:T.isDark?"#060A10":"#fff", cursor:"pointer", fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:800, boxShadow:`0 0 20px ${T.green}40` }}>Add to Tracker →</button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ pick, colorIdx, onClose, onRemove }) {
  const T = useT();
  const color   = col(colorIdx);
  const elapsed = Math.min(tradingDaysSince(pick.pickedDate), 5);
  const allData = buildDayData(pick);
  const visible = allData.slice(0, elapsed+1);
  const current = visible[visible.length-1]?.cum ?? 0;
  const d5Known = pick.prices?.d5 != null;
  const isComplete = elapsed >= 5 && d5Known;
  const hit     = calcHitTarget(pick);
  const endDate = addTradingDays(pick.pickedDate, 5);
  const hasRealPrices = !!(pick.prices?.baseNav);

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed", inset:0, background:"#00000090", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:T.bgModal, border:`1px solid ${T.border}`, borderRadius:20, padding:"30px 28px", width:"min(580px,100%)", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 32px 80px #00000040", animation:"up 0.28s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div style={{ display:"flex", gap:14, alignItems:"center" }}>
            <div style={{ width:4, height:52, background:color, borderRadius:2 }} />
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, flexWrap:"wrap" }}>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:18, fontWeight:600, color }}>{pick.symbol}</span>
                <HitBadge hit={hit} />
                {!isComplete && <Pill color={T.blue} filled>Day {elapsed}/5</Pill>}
              </div>
              <div style={{ fontSize:13, color:T.muted }}>{pick.company}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:22 }}>×</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
          {[
            { label:"Picked",   v:<span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:T.text }}>{pick.pickedDate}</span> },
            { label:"End Date", v:<span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:isComplete?T.mutedLight:T.amber }}>{endDate}</span> },
            { label:"Expected", v:<Pct v={pick.expectedPct} /> },
            { label:"Current",  v:<Pct v={current} /> },
          ].map(s => (
            <div key={s.label} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 12px" }}>
              <div style={{ fontSize:9, color:T.muted, fontFamily:"'DM Mono',monospace", letterSpacing:"0.12em", marginBottom:8 }}>{s.label.toUpperCase()}</div>
              {s.v}
            </div>
          ))}
        </div>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 12px 8px", marginBottom:16 }}>
          <p style={{ margin:"0 0 12px 6px", fontSize:10, color:T.muted, fontFamily:"'DM Mono',monospace", letterSpacing:"0.1em" }}>CUMULATIVE RETURN · ACTUAL vs TARGET</p>
          <ResponsiveContainer width="100%" height={165}>
            <LineChart data={allData} margin={{ top:4, right:24, left:0, bottom:0 }}>
              <XAxis dataKey="label" tick={{ fill:T.muted, fontSize:10, fontFamily:"'DM Mono',monospace" }} axisLine={{ stroke:T.border }} tickLine={false} />
              <YAxis tickFormatter={v=>`${v>=0?"+":""}${v.toFixed(1)}%`} tick={{ fill:T.muted, fontSize:10, fontFamily:"'DM Mono',monospace" }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<TTip />} />
              <ReferenceLine y={0} stroke={T.border} strokeDasharray="4 4" />
              <ReferenceLine y={pick.expectedPct} stroke={color} strokeDasharray="6 4" strokeOpacity={0.35}
                label={{ value:`Target ${pick.expectedPct>0?"+":""}${parseFloat(pick.expectedPct.toFixed(2))}%`, position:"insideTopRight", fill:color, fontSize:9, fontFamily:"'DM Mono',monospace" }} />
              <Line type="monotone" dataKey="cum" data={visible} name={pick.symbol} stroke={color} strokeWidth={2.5} dot={{ r:3, fill:color, strokeWidth:0 }} activeDot={{ r:5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:6, marginBottom:18 }}>
          {allData.map((d,i) => {
            const reached = i <= elapsed;
            const pos = d.cum >= 0;
            const tradingDate = i === 0 ? pick.pickedDate : getTradingDayDates(pick.pickedDate)[i-1]?.date;
            return (
              <div key={i} style={{ background:reached?(pos?T.green+"12":T.red+"12"):T.surface, border:`1px solid ${reached?(pos?T.green+"35":T.red+"35"):T.border}`, borderRadius:8, padding:"10px 6px", textAlign:"center", opacity:reached?1:0.4 }}>
                <div style={{ fontSize:9, color:T.muted, fontFamily:"'DM Mono',monospace", marginBottom:2 }}>{d.label}</div>
                {tradingDate && <div style={{ fontSize:8, color:T.muted, fontFamily:"'DM Mono',monospace", marginBottom:4, opacity:0.7 }}>{tradingDate.slice(5)}</div>}
                {i>0&&reached&&<div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", fontWeight:700, color:d.daily>=0?T.green:T.red, marginTop:4 }}>{d.daily>=0?"▲":"▼"}{Math.abs(d.daily).toFixed(2)}%</div>}
              </div>
            );
          })}
        </div>
        {(pick.priceSource || pick.priceNote) && (
          <div style={{ marginBottom:14, padding:"8px 12px", borderRadius:8, background:T.surface, border:`1px solid ${T.border}`, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            {pick.priceSource && <span style={{ fontSize:10, color:T.green, fontFamily:"'DM Mono',monospace" }}>📡 {pick.priceSource}</span>}
            {pick.priceNote && <span style={{ fontSize:10, color:T.muted, fontFamily:"'DM Mono',monospace" }}>{pick.priceNote}</span>}
            {pick.lastFetched && <span style={{ fontSize:10, color:T.muted, fontFamily:"'DM Mono',monospace", marginLeft:"auto" }}>Updated {pick.lastFetched}</span>}
          </div>
        )}
        {!hasRealPrices && (
          <div style={{ marginBottom:14, padding:"10px 14px", borderRadius:8, background:T.amber+"12", border:`1px solid ${T.amber}30` }}>
            <span style={{ fontSize:11, color:T.amber, fontFamily:"'DM Mono',monospace" }}>⚠ No real price data yet. Use ⟳ Refresh Prices to fetch live NAV data.</span>
          </div>
        )}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:11, color:T.muted, fontFamily:"'DM Mono',monospace" }}>Picked {pick.pickedDate} · Ends {endDate}</span>
          <button onClick={()=>{onRemove(pick.id);onClose();}} style={{ background:T.red+"15", border:`1px solid ${T.red}30`, color:T.red, borderRadius:8, padding:"7px 16px", cursor:"pointer", fontSize:11, fontFamily:"'DM Mono',monospace" }}>Remove Pick</button>
        </div>
      </div>
    </div>
  );
}

// ── Fund Card ─────────────────────────────────────────────────────────────────
function FundCard({ pick, colorIdx, onClick, onFetch }) {
  const T = useT();
  const color   = col(colorIdx);
  const elapsed = Math.min(tradingDaysSince(pick.pickedDate), 5);
  const data    = buildDayData(pick);
  const visible = data.slice(0, elapsed+1);
  const current = visible[visible.length-1]?.cum ?? null;
  const d5Known = pick.prices?.d5 != null;
  const isComplete = elapsed >= 5 && d5Known;
  const hit     = calcHitTarget(pick);
  const onTrack = current !== null && (pick.expectedPct > 0 ? current > 0 : pick.expectedPct < 0 ? current < 0 : true);
  const endDate = addTradingDays(pick.pickedDate, 5);
  const hasRealPrices = !!(pick.prices?.baseNav);
  const isFetching = pick._fetching;
  const fetchError = !hasRealPrices && !isFetching && pick.priceNote;

  return (
    <div onClick={onClick}
      style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"18px", cursor:"pointer", position:"relative", overflow:"hidden", transition:"all 0.2s", boxShadow: T.isDark ? "none" : "0 2px 12px rgba(0,0,0,0.06)" }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor=color+"60"; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow=`0 10px 36px ${color}22`; e.currentTarget.style.background=T.surfaceHover; }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow=T.isDark?"none":"0 2px 12px rgba(0,0,0,0.06)"; e.currentTarget.style.background=T.surface; }}
    >
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:color, borderRadius:"14px 14px 0 0" }} />
      {isFetching && <div style={{ position:"absolute", top:6, right:8, fontSize:9, color:T.amber, fontFamily:"'DM Mono',monospace", animation:"blink 1s infinite" }}>⟳ fetching…</div>}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div style={{ flex:1, minWidth:0, marginRight:8 }}>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:14, fontWeight:600, color, marginBottom:3, display:"flex", alignItems:"center", gap:6 }}>
            {pick.symbol}
            <span style={{ fontSize:8, padding:"1px 6px", borderRadius:3, border:`1px solid ${pick._source==="sheet"?T.blue+"50":T.muted+"40"}`, color:pick._source==="sheet"?T.blue:T.muted, fontWeight:400 }}>{pick._source==="sheet"?"SHEET":"MANUAL"}</span>
          </div>
          <div style={{ fontSize:11, color:T.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{pick.company}</div>
        </div>
        {current !== null ? <Pct v={current} size={12} /> : <span style={{ fontSize:11, color:T.muted, fontFamily:"'DM Mono',monospace" }}>—</span>}
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
        <span style={{ fontSize:10, color:T.muted, fontFamily:"'DM Mono',monospace" }}>📅 {pick.pickedDate}</span>
        <span style={{ fontSize:10, color:T.textDim }}>→</span>
        <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:isComplete?T.mutedLight:T.amber }}>{endDate}</span>
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:11, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:10, color:T.muted, fontFamily:"'DM Mono',monospace" }}>Target:</span>
        <Pct v={pick.expectedPct} size={10} />
        <HitBadge hit={hit} />
        {!isComplete&&elapsed>0&&current!==null&&<Pill color={onTrack?T.green:T.red} filled>{onTrack?"On Track":"Off Track"}</Pill>}
      </div>
      {/* Show fetch error with retry button, or no-data prompt */}
      {!hasRealPrices && !isFetching && (
        <div onClick={e=>{ e.stopPropagation(); onFetch(pick); }}
          style={{ marginBottom:10, padding:"8px 10px", borderRadius:8, background:fetchError?T.red+"12":T.amber+"12", border:`1px solid ${fetchError?T.red+"40":T.amber+"30"}`, cursor:"pointer", display:"flex", alignItems:"flex-start", gap:8 }}
          title="Click to retry fetch"
        >
          <span style={{ fontSize:13, flexShrink:0 }}>{fetchError ? "⚠️" : "📡"}</span>
          <div>
            <div style={{ fontSize:10, color:fetchError?T.red:T.amber, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>
              {fetchError ? "Fetch failed — click to retry" : "No price data — click to fetch"}
            </div>
            {fetchError && <div style={{ fontSize:9, color:T.muted, fontFamily:"'DM Mono',monospace", marginTop:3, wordBreak:"break-word" }}>{String(fetchError).slice(0,120)}</div>}
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height={48}>
        <AreaChart data={visible} margin={{ top:2, right:0, left:0, bottom:0 }}>
          <defs>
            <linearGradient id={`g${colorIdx}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <ReferenceLine y={0} stroke={T.border} strokeDasharray="3 3" />
          <Area type="monotone" dataKey="cum" stroke={color} strokeWidth={1.5} fill={`url(#g${colorIdx})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ marginTop:10, marginBottom:8 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
          <span style={{ fontSize:9, color:T.muted, fontFamily:"'DM Mono',monospace" }}>{isComplete?"COMPLETED":elapsed>=5?"AWAITING NAV":`DAY ${elapsed} OF 5`}</span>
          <span style={{ fontSize:9, color:T.muted, fontFamily:"'DM Mono',monospace" }}>{elapsed>=5&&!d5Known?"?":elapsed}/5</span>
        </div>
        <ProgressBar value={elapsed} color={isComplete?(hit===true?T.green:hit===false?T.red:T.muted):elapsed>=5?T.amber:color} />
      </div>
      <div style={{ display:"flex", gap:3 }}>
        {[1,2,3,4,5].map(d => {
          const reached = d <= elapsed;
          const pos = (data[d]?.cum??0) >= 0;
          return (
            <div key={d} style={{ flex:1, height:18, borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", background:reached?(pos?T.green+"18":T.red+"18"):T.border, border:`1px solid ${reached?(pos?T.green+"40":T.red+"40"):"transparent"}` }}>
              <span style={{ fontSize:8, fontFamily:"'DM Mono',monospace", color:reached?(pos?T.green:T.red):T.muted }}>D{d}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop:8, textAlign:"right" }}>
        <span style={{ fontSize:9, color:color, fontFamily:"'DM Mono',monospace", opacity:0.7 }}>View details →</span>
      </div>
    </div>
  );
}

// ── Tracking Table ────────────────────────────────────────────────────────────
function TrackingTable({ picks, onRowClick }) {
  const T = useT();
  const [sort, setSort] = useState({ key:"pickedDate", dir:-1 });

  const cols = [
    { key:"symbol",     label:"Symbol",      w:"90px"  },
    { key:"company",    label:"Fund Name",   w:"auto"  },
    { key:"pickedDate", label:"Picked",      w:"110px" },
    { key:"endDate",    label:"End Date",    w:"110px" },
    { key:"expected",   label:"Expected",    w:"95px"  },
    { key:"current",    label:"Current",     w:"95px"  },
    { key:"d1",         label:"D1",          w:"66px"  },
    { key:"d2",         label:"D2",          w:"66px"  },
    { key:"d3",         label:"D3",          w:"66px"  },
    { key:"d4",         label:"D4",          w:"66px"  },
    { key:"d5",         label:"D5 Final",    w:"80px"  },
    { key:"hit",        label:"Hit Target?", w:"105px" },
    { key:"status",     label:"Status",      w:"85px"  },
  ];

  const rows = picks.map(pick => {
    const data = buildDayData(pick);
    const elapsed = tradingDaysSince(pick.pickedDate);
    const current = data[Math.min(elapsed, data.length-1)]?.cum ?? null;
    const hit = calcHitTarget(pick);
    const d5Known = pick.prices?.d5 != null;
    const isComplete = elapsed >= 5 && d5Known;
    const tradingLeft = Math.max(0, 5 - elapsed);
    return {
      pick, symbol:pick.symbol, company:pick.company,
      pickedDate:pick.pickedDate, endDate:addTradingDays(pick.pickedDate,5),
      expected:pick.expectedPct, current,
      d1:data[1]?.cum??null, d2:data[2]?.cum??null,
      d3:data[3]?.cum??null, d4:data[4]?.cum??null,
      d5:data[5]?.daily??null,
      hit, status:isComplete?"Done":elapsed>=5?"Awaiting NAV":`Day ${Math.min(elapsed,5)}`, isComplete, elapsed, tradingLeft,
      hasRealPrices: !!(pick.prices?.baseNav),
    };
  });

  const sorted = [...rows].sort((a,b) => {
    let av=a[sort.key], bv=b[sort.key];
    if (av===null) av=-Infinity; if (bv===null) bv=-Infinity;
    if (sort.key==="hit") { av=av===null?0:av?1:-1; bv=bv===null?0:bv?1:-1; }
    return av<bv?-sort.dir:av>bv?sort.dir:0;
  });

  const toggleSort = key => setSort(s => ({ key, dir:s.key===key?-s.dir:-1 }));
  const arrow = key => sort.key===key?(sort.dir===-1?" ↓":" ↑"):"";

  const PctCell = ({ v }) => {
    if (v===null) return <span style={{ color:T.border, fontFamily:"'DM Mono',monospace", fontSize:11 }}>—</span>;
    const pos = v >= 0;
    return <span style={{ color:pos?T.green:T.red, fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:500 }}>{pos?"+":""}{v.toFixed(2)}%</span>;
  };

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden", boxShadow:T.isDark?"none":"0 2px 16px rgba(0,0,0,0.07)" }}>
      <div style={{ padding:"18px 20px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <h3 style={{ margin:0, fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, color:T.text }}>All Tracked Funds</h3>
          <p style={{ margin:"3px 0 0", fontSize:11, color:T.muted }}>{picks.length} funds · click any row to view details · click column headers to sort</p>
        </div>
        <span style={{ fontSize:10, color:T.muted, fontFamily:"'DM Mono',monospace" }}>{picks.filter(p=>tradingDaysSince(p.pickedDate)>=5 && p.prices?.d5 != null).length} completed · {picks.filter(p=>tradingDaysSince(p.pickedDate)<5 || p.prices?.d5 == null).length} active</span>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:960 }}>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key} onClick={()=>toggleSort(c.key)} style={{ padding:"11px 12px", textAlign:"left", fontSize:9, fontFamily:"'DM Mono',monospace", color:sort.key===c.key?T.blue:T.muted, letterSpacing:"0.1em", whiteSpace:"nowrap", cursor:"pointer", userSelect:"none", borderBottom:`1px solid ${T.border}`, background:T.bgTableHead, position:"sticky", top:0, zIndex:2, width:c.w, transition:"color 0.15s" }}>
                  {c.label}{arrow(c.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const color = col(picks.indexOf(row.pick));
              return (
                <tr key={row.pick.id} onClick={()=>onRowClick(row.pick)}
                  style={{ borderBottom:`1px solid ${T.border}`, cursor:"pointer", transition:"background 0.12s" }}
                  onMouseEnter={e=>e.currentTarget.style.background=T.surfaceHover}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                >
                  <td style={{ padding:"13px 12px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:3, height:28, background:color, borderRadius:2, flexShrink:0 }} />
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:600, color }}>{row.symbol}</span>
                    </div>
                  </td>
                  <td style={{ padding:"13px 12px" }}><span style={{ fontSize:12, color:T.textDim, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:220, display:"block" }}>{row.company}</span></td>
                  <td style={{ padding:"13px 12px" }}><span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:T.text }}>{fmtDate(row.pickedDate)}</span></td>
                  <td style={{ padding:"13px 12px" }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:row.isComplete?T.muted:T.amber }}>{fmtDate(row.endDate)}</span>
                      <span style={{ fontSize:9, color:row.isComplete?T.muted:T.amber, fontFamily:"'DM Mono',monospace" }}>{row.isComplete?"Closed":row.elapsed>=5?"Awaiting NAV":`${row.tradingLeft} trading day${row.tradingLeft!==1?"s":""} left`}</span>
                    </div>
                  </td>
                  <td style={{ padding:"13px 12px" }}><Pct v={row.expected} size={11} /></td>
                  <td style={{ padding:"13px 12px" }}>{row.current !== null ? <Pct v={row.current} size={11} /> : <PctCell v={null} />}</td>
                  {[row.d1,row.d2,row.d3,row.d4,row.d5].map((v,di) => (
                    <td key={di} style={{ padding:"13px 8px" }}><PctCell v={v} /></td>
                  ))}
                  <td style={{ padding:"13px 12px" }}><HitBadge hit={row.hit} /></td>
                  <td style={{ padding:"13px 12px" }}><Pill color={row.isComplete?T.muted:row.elapsed>=5?T.amber:T.blue} filled>{row.status}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function FundTracker({ isDark: isDarkProp, onToggleTheme }) {
  const [picks, setPicks]         = useState(null);
  const [manualPicks, setManual]  = useState([]);
  const [showAdd, setShowAdd]     = useState(false);
  const [detail, setDetail]       = useState(null);
  const [cardFilter, setFilter]   = useState("all");
  const [view, setView]            = useState("cards");
  const [ready, setReady]         = useState(false);
  const [saved, setSaved]         = useState(false);
  const [exporting, setExp]       = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [syncMsg, setSyncMsg]     = useState("");

  // Use prop if provided, otherwise fall back to local state
  const [localDark, setLocalDark] = useState(true);
  const isDark = isDarkProp !== undefined ? isDarkProp : localDark;
  const T = isDark ? DARK : LIGHT;

  useEffect(() => {
    Promise.all([loadStorage(), loadTheme(), loadManualPicks()]).then(([stored, thm, manual]) => {
      const loadedPicks = stored ?? [];
      setPicks(loadedPicks);
      setManual(manual ?? []);
      if (isDarkProp === undefined) setLocalDark(thm !== "light");
      setTimeout(() => setReady(true), 60);

      // Auto-fetch prices for any pick that has no price data yet
      const missing = loadedPicks.filter(p => !p.prices?.baseNav && !p._fetching);
      if (missing.length > 0) {
        setTimeout(() => autoFetchMissing(missing, loadedPicks), 800);
      }
    });
  }, []);

  // Auto-fetch prices for picks missing data — runs on load, no user action needed
  const autoFetchMissing = async (missing, allPicks) => {
    // Mark them as fetching
    setPicks(prev => prev.map(p =>
      missing.find(m => m.id === p.id) ? { ...p, _fetching: true } : p
    ));
    // Fetch in parallel
    const results = await Promise.allSettled(missing.map(p => refreshPickPrices(p)));
    setPicks(prev => {
      const next = prev.map(p => {
        const idx = missing.findIndex(m => m.id === p.id);
        if (idx === -1) return p;
        return results[idx].status === "fulfilled"
          ? results[idx].value
          : { ...p, _fetching: false, priceNote: results[idx].reason?.message || "Auto-fetch failed" };
      });
      saveStorage(next);
      return next;
    });
  };

  const toggleTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      const next = !localDark;
      setLocalDark(next);
      saveTheme(next ? "dark" : "light");
    }
  };

  // Persist price cache (all picks with their price data)
  const persist = useCallback(async (updatedPicks) => {
    await saveStorage(updatedPicks);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  // Sync from Google Sheet — merges sheet picks with existing manual picks & price cache
  const syncFromSheet = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      if (!SHEET_API_URL || SHEET_API_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") {
        setSyncMsg("⚠ No Sheet URL configured");
        return;
      }
      const [sheetPicks, priceCache, manual] = await Promise.all([
        fetchSheetPicks(), loadPriceCache(), loadManualPicks(),
      ]);
      const merged = mergePicks(sheetPicks, manual, priceCache);
      setPicks(merged);
      // Auto-fetch prices for new sheet picks missing price data
      const missing = merged.filter(p => !p.prices?.baseNav && !p._fetching);
      if (missing.length > 0) setTimeout(() => autoFetchMissing(missing, merged), 500);
      setSyncMsg(`✓ Synced ${sheetPicks.length} picks from Sheet`);
      setTimeout(() => setSyncMsg(""), 4000);
    } catch(e) {
      // Show full error so user can diagnose — stays visible 12 seconds
      setSyncMsg(`✗ ${e.message}`);
      setTimeout(() => setSyncMsg(""), 12000);
    } finally {
      setSyncing(false);
    }
  };

  // Add pick manually via dashboard — saved to localStorage manual picks
  const addPick = async (p) => {
    const withFlag = { ...p, _fetching: true };
    const newManual = [withFlag, ...manualPicks];
    setManual(newManual);
    await saveManualPicks(newManual);
    setPicks(prev => [withFlag, ...prev]);
    setShowAdd(false);
    try {
      const updated = await refreshPickPrices(withFlag);
      const updatedManual = newManual.map(x => x.id === withFlag.id ? updated : x);
      setManual(updatedManual);
      await saveManualPicks(updatedManual);
      setPicks(prev => {
        const next = prev.map(x => x.id === withFlag.id ? updated : x);
        persist(next);
        return next;
      });
    } catch(e) {
      const fallback = { ...p, _fetching: false, priceNote: "Fetch failed: " + e.message };
      const updatedManual = newManual.map(x => x.id === p.id ? fallback : x);
      setManual(updatedManual);
      await saveManualPicks(updatedManual);
      setPicks(prev => {
        const next = prev.map(x => x.id === p.id ? fallback : x);
        persist(next);
        return next;
      });
    }
  };

  // Remove pick — only removes from manual picks (sheet picks stay in sheet)
  const removePick = async (id) => {
    const updatedManual = manualPicks.filter(p => p.id !== id);
    setManual(updatedManual);
    await saveManualPicks(updatedManual);
    const next = picks.filter(p => p.id !== id);
    setPicks(next);
    persist(next);
  };

  const refreshAllPrices = async () => {
    if (!picks.length) return;
    // Mark all as fetching
    setPicks(prev => prev.map(p => ({ ...p, _fetching: true })));
    // Fetch ALL in parallel
    const results = await Promise.allSettled(picks.map(p => refreshPickPrices(p)));
    setPicks(prev => {
      const next = prev.map((p, i) =>
        results[i].status === "fulfilled"
          ? results[i].value
          : { ...p, _fetching: false, priceNote: results[i].reason?.message || "Refresh failed" }
      );
      persist(next);
      return next;
    });
  };

  const handleExport = async () => {
    setExp(true);
    try { await exportToExcel(picks); } catch(e) { alert("Export failed: "+e.message); }
    finally { setExp(false); }
  };

  const fetchSinglePick = async (pick) => {
    setPicks(prev => prev.map(p => p.id === pick.id ? { ...p, _fetching: true, priceNote: "" } : p));
    try {
      const updated = await refreshPickPrices(pick);
      setPicks(prev => { const next = prev.map(p => p.id === pick.id ? updated : p); persist(next); return next; });
    } catch(e) {
      setPicks(prev => { const next = prev.map(p => p.id === pick.id ? { ...p, _fetching: false, priceNote: e.message } : p); persist(next); return next; });
    }
  };

  if (!picks) return (
    <ThemeCtx.Provider value={T}>
      <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
        <span style={{ color:T.muted, fontFamily:"'DM Mono',monospace", fontSize:12 }}>Loading…</span>
      </div>
    </ThemeCtx.Provider>
  );

  const active    = picks.filter(p => tradingDaysSince(p.pickedDate) < 5 || p.prices?.d5 == null);
  const completed = picks.filter(p => tradingDaysSince(p.pickedDate) >= 5 && p.prices?.d5 != null);
  const hitCount  = completed.filter(p => calcHitTarget(p)===true).length;
  const hitRate   = completed.length > 0 ? Math.round((hitCount/completed.length)*100) : null;
  const sortNewest = arr => [...arr].sort((a,b) => b.pickedDate.localeCompare(a.pickedDate));
  const shownCards = sortNewest(cardFilter==="active" ? active : cardFilter==="completed" ? completed : picks);

  const overlayData = active.length > 0
    ? [0,1,2,3,4,5].map(d => {
        const pt = { label: d===0?"D0":`D${d}` };
        active.forEach(p => { const dd = buildDayData(p); pt[`${p.symbol}_${p.id}`] = dd[d]?.cum ?? null; });
        return pt;
      })
    : [];

  return (
    <ThemeCtx.Provider value={T}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
      <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'DM Sans',sans-serif", transition:"background 0.3s, color 0.3s" }}>
        <div style={{ position:"fixed", inset:0, pointerEvents:"none", backgroundImage:`linear-gradient(${T.gridLine} 1px,transparent 1px),linear-gradient(90deg,${T.gridLine} 1px,transparent 1px)`, backgroundSize:"44px 44px", transition:"background-image 0.3s" }} />

        {/* ── Sticky Header ── */}
        <div style={{ position:"sticky", top:0, zIndex:100, background:T.isDark?"rgba(6,10,16,0.92)":"rgba(240,244,250,0.92)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", borderBottom:`1px solid ${T.border}`, transition:"background 0.3s, border-color 0.3s" }}>
          <div style={{ maxWidth:1220, margin:"0 auto", padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between", height:58, gap:12, flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:T.green, boxShadow:`0 0 10px ${T.green}`, animation:"blink 2s infinite" }} />
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:T.green, letterSpacing:"0.18em" }}>MF PICK TRACKER</span>
                {saved && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:T.muted }}>· ✓ saved</span>}
              </div>
              {syncMsg && (
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:syncMsg.startsWith("✓")?T.green:syncMsg.startsWith("⚠")?T.amber:T.red, maxWidth:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {syncMsg}
                </span>
              )}
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
              <button onClick={syncFromSheet} disabled={syncing}
                style={{ padding:"8px 16px", background:"transparent", border:`1px solid ${T.green}50`, borderRadius:9, color:T.green, cursor:syncing?"wait":"pointer", fontFamily:"'DM Mono',monospace", fontWeight:600, fontSize:11, display:"flex", alignItems:"center", gap:6, opacity:syncing?0.6:1, transition:"all 0.2s" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.green+"18"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              >{syncing?"⟳ Syncing…":"⬆ Sync Sheet"}</button>
              {picks.length > 0 && (
                <button onClick={refreshAllPrices}
                  style={{ padding:"8px 16px", background:"transparent", border:`1px solid ${T.blue}50`, borderRadius:9, color:T.blue, cursor:"pointer", fontFamily:"'DM Mono',monospace", fontWeight:600, fontSize:11, display:"flex", alignItems:"center", gap:6, transition:"all 0.2s" }}
                  onMouseEnter={e=>e.currentTarget.style.background=T.blue+"18"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                >⟳ Refresh Prices</button>
              )}
              {picks.length > 0 && (
                <button onClick={handleExport} disabled={exporting}
                  style={{ padding:"8px 16px", background:"transparent", border:`1px solid ${T.amber}50`, borderRadius:9, color:T.amber, cursor:exporting?"wait":"pointer", fontFamily:"'DM Mono',monospace", fontWeight:600, fontSize:11, display:"flex", alignItems:"center", gap:6, opacity:exporting?0.6:1, transition:"all 0.2s" }}
                  onMouseEnter={e=>e.currentTarget.style.background=T.amber+"18"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                >⬇ Export Excel</button>
              )}
              <button onClick={()=>setShowAdd(true)} style={{ background:T.green, border:"none", borderRadius:9, color:T.isDark?"#060A10":"#fff", padding:"9px 18px", cursor:"pointer", fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:12, display:"flex", alignItems:"center", gap:7, boxShadow:`0 0 22px ${T.green}35` }}>
                + Add Pick
              </button>
            </div>
          </div>
        </div>

        <div style={{ maxWidth:1220, margin:"0 auto", padding:"32px 20px", position:"relative" }}>

          {/* ── Page title ── */}
          <div style={{ marginBottom:24, opacity:ready?1:0, transform:ready?"none":"translateY(-10px)", transition:"all 0.5s cubic-bezier(0.16,1,0.3,1)" }}>
            <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(22px,3vw,34px)", fontWeight:800, margin:0, letterSpacing:"-0.025em", color:T.text }}>
              Fund <span style={{ color:T.green }}>Performance</span>
            </h1>
            <p style={{ color:T.muted, fontSize:13, margin:"5px 0 0", fontWeight:300 }}>
              {picks.length} picks · {active.length} active · {completed.length} completed{hitRate!==null?` · ${hitRate}% hit rate`:""}
            </p>
          </div>

          {/* ── Stats ── */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(138px,1fr))", gap:12, marginBottom:24, opacity:ready?1:0, transform:ready?"none":"translateY(12px)", transition:"all 0.5s cubic-bezier(0.16,1,0.3,1) 0.07s" }}>
            {[
              { label:"Total Picks",  v:picks.length,     color:T.text },
              { label:"Active",       v:active.length,    color:T.blue },
              { label:"Completed",    v:completed.length, color:T.mutedLight },
              { label:"Hit Rate",     v:hitRate!==null?`${hitRate}%`:"–", color:hitRate!==null?(hitRate>=60?T.green:T.red):T.muted },
              { label:"Hits",         v:hitCount,          color:T.green },
              { label:"Avg Return",   v:(() => { const withPrices = completed.filter(p=>p.prices?.d5!=null); if(!withPrices.length) return <span style={{ color:T.muted, fontFamily:"'DM Mono',monospace" }}>–</span>; const avg=withPrices.reduce((s,p)=>{ const d=buildDayData(p); return s+(d[5]?.cum??0); },0)/withPrices.length; return <Pct v={avg} size={14} />; })() },
            ].map((s,i) => (
              <div key={i} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"15px 17px", boxShadow:T.isDark?"none":"0 1px 8px rgba(0,0,0,0.05)", transition:"background 0.3s, border-color 0.3s" }}>
                <div style={{ fontSize:9, color:T.muted, fontFamily:"'DM Mono',monospace", letterSpacing:"0.12em", marginBottom:10 }}>{s.label.toUpperCase()}</div>
                <div style={{ fontSize:21, fontFamily:"'Syne',sans-serif", fontWeight:700, color:s.color||T.text }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* ── Overlay chart ── */}
          {active.length > 0 && (
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"20px 18px 14px", marginBottom:24, opacity:ready?1:0, transition:"opacity 0.5s ease 0.12s, background 0.3s", boxShadow:T.isDark?"none":"0 2px 16px rgba(0,0,0,0.06)" }}>
              <p style={{ margin:"0 0 14px 4px", fontSize:10, color:T.muted, fontFamily:"'DM Mono',monospace", letterSpacing:"0.12em" }}>ACTIVE PICKS · CUMULATIVE RETURN</p>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={overlayData} margin={{ top:4, right:16, left:0, bottom:0 }}>
                  <XAxis dataKey="label" tick={{ fill:T.muted, fontSize:10, fontFamily:"'DM Mono',monospace" }} axisLine={{ stroke:T.border }} tickLine={false} />
                  <YAxis tickFormatter={v=>`${v>=0?"+":""}${v.toFixed(1)}%`} tick={{ fill:T.muted, fontSize:10, fontFamily:"'DM Mono',monospace" }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip content={<TTip />} />
                  <ReferenceLine y={0} stroke={T.border} strokeDasharray="4 4" />
                  {active.map(p => (
                    <Line key={p.id} type="monotone" dataKey={`${p.symbol}_${p.id}`} name={`${p.symbol} (${p.pickedDate})`}
                      stroke={col(picks.indexOf(p))} strokeWidth={2}
                      dot={{ r:3, fill:col(picks.indexOf(p)), strokeWidth:0 }} connectNulls={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginTop:8 }}>
                {active.map(p => (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }} onClick={()=>setDetail(p)}>
                    <div style={{ width:12, height:3, borderRadius:2, background:col(picks.indexOf(p)) }} />
                    <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:col(picks.indexOf(p)) }}>{p.symbol}</span>
                    <span style={{ fontSize:10, color:T.muted }}>{p.pickedDate} · D{tradingDaysSince(p.pickedDate)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Filter tabs + view toggle ── */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
            <div style={{ display:"flex", gap:6 }}>
              {[["all","All Cards"],["active","Active"],["completed","Completed"]].map(([v,l]) => (
                <button key={v} onClick={()=>setFilter(v)} style={{
                  padding:"7px 16px", borderRadius:8, cursor:"pointer",
                  border:cardFilter===v?`1px solid ${T.green}50`:`1px solid ${T.border}`,
                  background:cardFilter===v?T.green+"14":"transparent",
                  color:cardFilter===v?T.green:T.muted,
                  fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:"0.08em", transition:"all 0.15s",
                }}>{l.toUpperCase()}</button>
              ))}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {[["cards","⊞ Cards"],["table","≡ Table"]].map(([v,l]) => (
                <button key={v} onClick={()=>setView(v)} style={{
                  padding:"7px 14px", borderRadius:8, cursor:"pointer",
                  border:`1px solid ${view===v?T.green+"50":T.border}`,
                  background:view===v?T.green+"14":"transparent",
                  color:view===v?T.green:T.muted,
                  fontFamily:"'DM Mono',monospace", fontSize:10, transition:"all 0.15s",
                }}>{l}</button>
              ))}
            </div>
          </div>

          {/* ── Cards ── */}
          {view==="cards" && (shownCards.length===0 ? (
            <div style={{ border:`2px dashed ${T.border}`, borderRadius:16, padding:"48px 20px", textAlign:"center", color:T.muted, marginBottom:36 }}>
              <div style={{ fontSize:32, marginBottom:10 }}>📊</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:6, color:T.text }}>No picks here</div>
              <div style={{ fontSize:13 }}>Hit <b style={{ color:T.green }}>+ Add Pick</b> to start tracking</div>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))", gap:14, marginBottom:36 }}>
              {shownCards.map(pick => (
                <FundCard key={pick.id} pick={pick} colorIdx={picks.indexOf(pick)} onClick={()=>setDetail(pick)} onFetch={fetchSinglePick} />
              ))}
            </div>
          ))}

          {/* ── Table ── */}
          {view==="table" && picks.length > 0 && (
            <div style={{ opacity:ready?1:0, transition:"opacity 0.5s ease 0.2s" }}>
              <TrackingTable picks={shownCards} onRowClick={p=>setDetail(p)} />
            </div>
          )}
        </div>

        {showAdd && <AddModal onAdd={addPick} onClose={()=>setShowAdd(false)} taken={picks} />}
        {detail && <DetailModal pick={detail} colorIdx={picks.indexOf(detail)} onClose={()=>setDetail(null)} onRemove={removePick} />}

        <style>{`
          @keyframes up { from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;} }
          @keyframes blink { 0%,100%{opacity:1;}50%{opacity:0.25;} }
          * { box-sizing:border-box; }
          ::-webkit-scrollbar { width:5px; height:5px; }
          ::-webkit-scrollbar-track { background:${T.scrollTrack}; }
          ::-webkit-scrollbar-thumb { background:${T.scrollThumb}; border-radius:3px; }
          input[type=date]::-webkit-calendar-picker-indicator { filter:${T.calIcon}; }
        `}</style>
      </div>
    </ThemeCtx.Provider>
  );
}