// Market data layer. Three interchangeable providers behind one interface —
// switch which one is active in config.js, no other code needs to change.
//
//   MarketProvider.getQuotes(["AAPL","DIS",...]) -> Promise<{ AAPL: Quote, DIS: Quote, ... }>
//
// Quote shape: { price, change, changePercent, open, high, low, prevClose, source }
// `source` is "live" or "simulated" so the UI can show a small badge when a
// ticker fell back to simulated data (bad key, rate limit, network hiccup, etc).

(function () {
  const CACHE_KEY = "kidsInvestApp.quoteCache.v1";
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — plenty fresh for a kids' app, easy on free API limits

  function loadCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function saveCache(cache) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      /* storage full or unavailable — quotes just won't be cached this session */
    }
  }

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function daysSinceEpoch(date) {
    return Math.floor(date.getTime() / 86400000);
  }

  // ---- Simulated provider: no network, no key, deterministic per ticker/day ----
  // Used automatically as a fallback whenever a live call fails, and as the
  // whole provider when config.provider === "demo".
  function simulatedPriceForDay(ticker, dayIndex) {
    const seed = hashString(ticker);
    const base = 20 + (seed % 380); // $20–$400 base price per ticker
    const phase1 = (seed % 100) / 100 * Math.PI * 2;
    const phase2 = (seed % 37) / 37 * Math.PI * 2;
    const wave =
      0.15 * Math.sin(dayIndex / 37 + phase1) +
      0.05 * Math.sin(dayIndex / 11 + phase2);
    const jitterSeed = hashString(ticker + ":" + dayIndex);
    const jitter = ((jitterSeed % 1000) / 1000 - 0.5) * 0.02; // +/-1%
    return Math.max(1, base * (1 + wave + jitter));
  }

  function simulatedQuote(ticker) {
    const today = daysSinceEpoch(new Date());
    const price = simulatedPriceForDay(ticker, today);
    const prevClose = simulatedPriceForDay(ticker, today - 1);
    const change = price - prevClose;
    return {
      price: round2(price),
      change: round2(change),
      changePercent: prevClose ? round2((change / prevClose) * 100) : 0,
      open: round2(prevClose),
      high: round2(Math.max(price, prevClose) * 1.01),
      low: round2(Math.min(price, prevClose) * 0.99),
      prevClose: round2(prevClose),
      source: "simulated",
    };
  }

  function simulatedHistory(ticker, days) {
    const today = daysSinceEpoch(new Date());
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayIndex = today - i;
      out.push({
        date: dateFromDayIndex(dayIndex),
        close: round2(simulatedPriceForDay(ticker, dayIndex)),
      });
    }
    return out;
  }

  function dateFromDayIndex(dayIndex) {
    return new Date(dayIndex * 86400000).toISOString().slice(0, 10);
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  // ---- Finnhub adapter ----
  // Free tier: ~60 calls/minute, one symbol per call, no key needed to explore
  // (but you do need your own free key to run this for real). Historical
  // candles are restricted on the free tier, so we don't rely on them —
  // this app builds its own price history locally over time instead (see app.js).
  async function finnhubQuote(ticker, apiKey) {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Finnhub HTTP " + res.status);
    const d = await res.json();
    if (!d || typeof d.c !== "number" || d.c === 0) throw new Error("Finnhub: no data for " + ticker);
    return {
      price: round2(d.c),
      change: round2(d.d ?? d.c - d.pc),
      changePercent: round2(d.dp ?? ((d.c - d.pc) / d.pc) * 100),
      open: round2(d.o),
      high: round2(d.h),
      low: round2(d.l),
      prevClose: round2(d.pc),
      source: "live",
    };
  }

  // ---- Twelve Data adapter ----
  // Free tier is tighter (roughly 8 calls/minute, 800/day) but supports
  // batching many symbols into one request, which we use here.
  async function twelveDataQuotes(tickers, apiKey) {
    const symbols = tickers.join(",");
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Twelve Data HTTP " + res.status);
    const d = await res.json();
    const out = {};
    // Response is either one object (single symbol) or {SYMBOL: {...}} (multiple)
    const entries = tickers.length === 1 ? { [tickers[0]]: d } : d;
    for (const ticker of tickers) {
      const q = entries[ticker];
      if (!q || q.status === "error" || q.close == null) continue;
      const price = parseFloat(q.close);
      const change = parseFloat(q.change ?? 0);
      out[ticker] = {
        price: round2(price),
        change: round2(change),
        changePercent: round2(parseFloat(q.percent_change ?? 0)),
        open: round2(parseFloat(q.open ?? price)),
        high: round2(parseFloat(q.high ?? price)),
        low: round2(parseFloat(q.low ?? price)),
        prevClose: round2(parseFloat(q.previous_close ?? price - change)),
        source: "live",
      };
    }
    return out;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function getQuotes(tickers) {
    const cfg = window.APP_CONFIG || {};
    const provider = cfg.provider || "demo";
    const cache = loadCache();
    const now = Date.now();
    const results = {};
    const needFetch = [];

    for (const ticker of tickers) {
      const cached = cache[ticker];
      if (cached && now - cached.at < CACHE_TTL_MS) {
        results[ticker] = cached.quote;
      } else {
        needFetch.push(ticker);
      }
    }

    if (needFetch.length === 0) return results;

    if (provider === "demo" || !cfg.apiKey) {
      for (const ticker of needFetch) {
        const q = simulatedQuote(ticker);
        results[ticker] = q;
        cache[ticker] = { at: now, quote: q };
      }
      saveCache(cache);
      return results;
    }

    if (provider === "twelvedata") {
      try {
        const live = await twelveDataQuotes(needFetch, cfg.apiKey);
        for (const ticker of needFetch) {
          const q = live[ticker] || simulatedQuote(ticker);
          results[ticker] = q;
          cache[ticker] = { at: now, quote: q };
        }
      } catch (e) {
        console.warn("Twelve Data batch quote failed, falling back to simulated:", e);
        for (const ticker of needFetch) {
          const q = simulatedQuote(ticker);
          results[ticker] = q;
          cache[ticker] = { at: now, quote: q };
        }
      }
      saveCache(cache);
      return results;
    }

    // finnhub (default live provider) — one call per symbol, lightly staggered
    for (const ticker of needFetch) {
      try {
        const q = await finnhubQuote(ticker, cfg.apiKey);
        results[ticker] = q;
        cache[ticker] = { at: now, quote: q };
      } catch (e) {
        console.warn(`Finnhub quote failed for ${ticker}, using simulated:`, e);
        const q = simulatedQuote(ticker);
        results[ticker] = q;
        cache[ticker] = { at: now, quote: q };
      }
      await sleep(120); // stay comfortably under free-tier rate limits
    }
    saveCache(cache);
    return results;
  }

  window.MarketProvider = {
    getQuotes,
    simulatedHistory, // used to seed a chart's early history before real local history builds up
  };
})();
