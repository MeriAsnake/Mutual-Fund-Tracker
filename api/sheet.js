// /api/sheet.js — Vercel serverless function
// Proxies Google Apps Script requests server-side, completely avoiding CORS.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url param" });

  try {
    const response = await fetch(decodeURIComponent(url), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Sheet responded ${response.status}` });
    }

    const text = await response.text();
    let json;
    try { json = JSON.parse(text); } catch {
      return res.status(502).json({ error: "Sheet did not return JSON", raw: text.slice(0, 300) });
    }

    return res.status(200).json(json);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
