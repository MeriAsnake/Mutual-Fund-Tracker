// /api/prices.js — Vercel serverless function
// Proxies Yahoo Finance requests server-side, completely avoiding CORS.
// Deploy this in your project's /api/ folder alongside your React app.

export default async function handler(req, res) {
  // Allow requests from your Vercel app
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { symbol, from, to } = req.query;

  if (!symbol || !from || !to) {
    return res.status(400).json({ error: "Missing symbol, from, or to params" });
  }

  const p1 = Math.floor(new Date(from + "T00:00:00Z").getTime() / 1000);
  const p2 = Math.floor(new Date(to   + "T23:59:59Z").getTime() / 1000);

  // Try chart endpoint first (ETFs/stocks), then CSV download (mutual funds)
  const endpoints = [
    {
      name: "chart",
      url:  `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${p1}&period2=${p2}&events=history`,
      type: "json",
    },
    {
      name: "chart-q2",
      url:  `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${p1}&period2=${p2}&events=history`,
      type: "json",
    },
    {
      name: "download",
      url:  `https://query1.finance.yahoo.com/v7/finance/download/${symbol}?period1=${p1}&period2=${p2}&interval=1d&events=history`,
      type: "csv",
    },
  ];

  const errors = [];

  for (const ep of endpoints) {
    try {
      const response = await fetch(ep.url, {
        headers: {
          // Mimic a real browser request — Yahoo Finance checks User-Agent
          "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          "Accept":          "text/html,application/json,text/csv,*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control":   "no-cache",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        errors.push(`${ep.name}: HTTP ${response.status}`);
        continue;
      }

      if (ep.type === "csv") {
        const text = await response.text();
        if (!text || text.includes("<html")) {
          errors.push(`${ep.name}: got HTML not CSV`);
          continue;
        }

        // Parse CSV: Date,Open,High,Low,Close,Adj Close,Volume
        const lines = text.trim().split("\n").slice(1);
        const priceMap = {};
        for (const line of lines) {
          const cols = line.split(",");
          if (cols.length < 5 || cols[4] === "null") continue;
          const date  = cols[0].trim();
          const close = parseFloat(cols[4]);
          if (date && !isNaN(close)) priceMap[date] = +close.toFixed(4);
        }

        if (Object.keys(priceMap).length === 0) {
          errors.push(`${ep.name}: CSV had no valid rows`);
          continue;
        }

        return res.status(200).json({ priceMap, source: ep.name });
      }

      // JSON chart endpoint
      const data   = await response.json();
      const result = data?.chart?.result?.[0];
      if (!result) {
        const msg = data?.chart?.error?.description || "no result block";
        errors.push(`${ep.name}: ${msg}`);
        continue;
      }

      const timestamps = result.timestamp || [];
      const closes     = result.indicators?.quote?.[0]?.close || [];
      const priceMap   = {};
      timestamps.forEach((ts, i) => {
        if (closes[i] == null) return;
        const d = new Date((ts + 5 * 3600) * 1000); // ET timezone
        priceMap[d.toISOString().slice(0, 10)] = +closes[i].toFixed(4);
      });

      if (Object.keys(priceMap).length === 0) {
        errors.push(`${ep.name}: empty price map`);
        continue;
      }

      return res.status(200).json({ priceMap, source: ep.name });

    } catch (e) {
      errors.push(`${ep.name}: ${e.message}`);
    }
  }

  return res.status(502).json({
    error: `All endpoints failed for "${symbol}"`,
    details: errors,
  });
}
