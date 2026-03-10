// api/prices.js  — Vercel serverless proxy for Yahoo Finance
// Returns { closeMap, highMap, lowMap, source } — all keyed "yyyy-MM-dd"
// Also returns legacy { priceMap } = closeMap for backwards compat

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { symbol, from, to } = req.query;
  if (!symbol || !from || !to) {
    return res.status(400).json({ error: "Missing symbol, from, or to params" });
  }

  const p1 = Math.floor(new Date(from + "T00:00:00Z").getTime() / 1000);
  // Add a 7-day buffer to 'to' so weekends/holidays never cut off the last trading day
  const toDate = new Date(to + "T23:59:59Z");
  toDate.setDate(toDate.getDate() + 7);
  const p2 = Math.floor(toDate.getTime() / 1000);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${p1}&period2=${p2}&events=history`;

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; price-fetcher/1.0)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) {
      return res.status(502).json({ error: `Yahoo returned HTTP ${r.status}` });
    }

    const json = await r.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      return res.status(502).json({ error: "No chart result from Yahoo" });
    }

    const quotes  = result.indicators?.quote?.[0] || {};
    const timestamps = result.timestamp || [];

    const closeMap = {}, highMap = {}, lowMap = {};

    timestamps.forEach((ts, i) => {
      // Yahoo timestamps are UTC midnight — shift by +5h so date matches US market date
      const d = new Date((ts + 5 * 3600) * 1000);
      const dateKey = d.getFullYear() + "-"
        + String(d.getMonth() + 1).padStart(2, "0") + "-"
        + String(d.getDate()).padStart(2, "0");

      if (quotes.close?.[i] != null) closeMap[dateKey] = +quotes.close[i].toFixed(4);
      if (quotes.high?.[i]  != null) highMap[dateKey]  = +quotes.high[i].toFixed(4);
      if (quotes.low?.[i]   != null) lowMap[dateKey]   = +quotes.low[i].toFixed(4);
    });

    if (Object.keys(closeMap).length === 0) {
      return res.status(502).json({ error: "Empty price data from Yahoo" });
    }

    return res.status(200).json({
      // New format — full OHLC
      closeMap,
      highMap,
      lowMap,
      // Legacy compat — priceMap = closeMap so old cached code still works
      priceMap: closeMap,
      source: "Yahoo Finance (server proxy)",
    });

  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
