# Uponli Pick Tracker

A multi-tracker dashboard with Fund Tracker, Stock Tracker, and Prediction Market.

## Folder Structure

```
src/
├── App.jsx                        ← Main shell (navigation + page routing)
├── main.jsx                       ← React entry point
├── components/
│   └── TrackerSelector.jsx        ← Top navbar switcher
└── pages/
    ├── FundTracker.jsx            ← Mutual Fund Tracker (default page)
    ├── StockTracker.jsx           ← Stock Tracker
    └── PredictionMarket.jsx       ← Prediction Market (coming soon placeholder)
```

## Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev

# 3. Open http://localhost:5173
```

## Build for Production

```bash
npm run build
npm run preview
```

## Notes

- Fund Tracker is the **default** page on load
- Each tracker is fully independent with its own state and localStorage keys
- The top navbar stays fixed across all pages
- To change your Google Sheet URLs, edit `SHEET_API_URL` inside:
  - `src/pages/FundTracker.jsx`
  - `src/pages/StockTracker.jsx`
