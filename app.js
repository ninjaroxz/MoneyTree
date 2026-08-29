// MoneyTree — a paper-trading portfolio app for kids.
// Plain JS, no build step, no framework. One shared state object saved to
// localStorage on this device; a hash router swaps the visible screen.

(function () {
  const CFG = window.APP_CONFIG || {};
  const COMPANIES = window.COMPANIES || [];
  const COMPANY_BY_TICKER = Object.fromEntries(COMPANIES.map((c) => [c.ticker, c]));
  const STATE_KEY = "kidsInvestApp.state.v1";
  const MAX_HISTORY_POINTS = 180;

  const app = document.getElementById("app");
  let state = null;
  let quotesCache = {}; // in-memory, refreshed by loadQuotes()

  // ---------------- state ----------------

  function todayStr(d) {
    return (d || new Date()).toISOString().slice(0, 10);
  }

  function freshState() {
    return {
      balance: CFG.startingBalance ?? 1000,
      holdings: {}, // ticker -> { shares, costBasis }
      trades: [],
      priceHistory: {}, // ticker -> [{date, close}]
      lastAllowanceDate: todayStr(),
      passcode: CFG.defaultPasscode || "1234",
      createdAt: new Date().toISOString(),
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return freshState();
      const parsed = JSON.parse(raw);
      // fill in any fields added in later versions
      return Object.assign(freshState(), parsed);
    } catch (e) {
      console.warn("Could not read saved data, starting fresh:", e);
      return freshState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Could not save data:", e);
    }
  }

  function addTrade(trade) {
    state.trades.unshift(Object.assign({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), date: new Date().toISOString() }, trade));
  }

  // Credits missed weeks of allowance since lastAllowanceDate. Returns info for a banner, or null.
  function creditAllowanceIfDue() {
    const last = new Date(state.lastAllowanceDate + "T00:00:00");
    const now = new Date();
    const msPerWeek = 7 * 86400000;
    const weeks = Math.floor((now - last) / msPerWeek);
    if (weeks < 1) return null;
    const amount = weeks * (CFG.weeklyAllowance ?? 100);
    state.balance += amount;
    state.lastAllowanceDate = todayStr(new Date(last.getTime() + weeks * msPerWeek));
    addTrade({ type: "allowance", amount, note: weeks === 1 ? "Weekly allowance" : `Allowance (${weeks} weeks)` });
    saveState();
    return { weeks, amount };
  }

  function recordPriceHistory(ticker, quote) {
    const hist = state.priceHistory[ticker] || [];
    const today = todayStr();
    if (hist.length && hist[hist.length - 1].date === today) {
      hist[hist.length - 1].close = quote.price;
    } else {
      hist.push({ date: today, close: quote.price });
    }
    if (hist.length > MAX_HISTORY_POINTS) hist.splice(0, hist.length - MAX_HISTORY_POINTS);
    state.priceHistory[ticker] = hist;
  }

  function holdingValue(ticker) {
    const h = state.holdings[ticker];
    if (!h || h.shares <= 0) return 0;
    const q = quotesCache[ticker];
    return q ? h.shares * q.price : 0;
  }

  function portfolioTotals() {
    let holdingsValue = 0;
    let costBasis = 0;
    for (const ticker of Object.keys(state.holdings)) {
      const h = state.holdings[ticker];
      if (h.shares <= 0) continue;
      holdingsValue += holdingValue(ticker);
      costBasis += h.costBasis;
    }
    return {
      cash: state.balance,
      holdingsValue,
      total: state.balance + holdingsValue,
      gain: holdingsValue - costBasis,
      gainPct: costBasis > 0 ? ((holdingsValue - costBasis) / costBasis) * 100 : 0,
    };
  }

  function buy(ticker, shares, price) {
    const cost = round2(shares * price);
    if (cost > state.balance + 0.001) throw new Error("Not enough cash for that.");
    if (shares <= 0) throw new Error("Enter an amount first.");
    state.balance = round2(state.balance - cost);
    const h = state.holdings[ticker] || { shares: 0, costBasis: 0 };
    h.shares = round4(h.shares + shares);
    h.costBasis = round2(h.costBasis + cost);
    state.holdings[ticker] = h;
    addTrade({ type: "buy", ticker, shares: round4(shares), price, amount: cost });
    saveState();
  }

  function sell(ticker, shares, price) {
    const h = state.holdings[ticker];
    if (!h || shares > h.shares + 0.0001) throw new Error("You don't own that many shares.");
    if (shares <= 0) throw new Error("Enter an amount first.");
    const proceeds = round2(shares * price);
    const proportionalCost = round2((shares / h.shares) * h.costBasis);
    h.shares = round4(h.shares - shares);
    h.costBasis = round2(h.costBasis - proportionalCost);
    if (h.shares <= 0.0001) {
      h.shares = 0;
      h.costBasis = 0;
    }
    state.holdings[ticker] = h;
    state.balance = round2(state.balance + proceeds);
    addTrade({ type: "sell", ticker, shares: round4(shares), price, amount: proceeds, realizedGain: round2(proceeds - proportionalCost) });
    saveState();
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }
  function round4(n) {
    return Math.round(n * 10000) / 10000;
  }
  function fmtMoney(n) {
    const sign = n < 0 ? "-" : "";
    return sign + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtPct(n) {
    return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
  }
  function fmtShares(n) {
    return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------------- data fetch ----------------

  async function loadQuotes(tickers) {
    const quotes = await window.MarketProvider.getQuotes(tickers);
    Object.assign(quotesCache, quotes);
    for (const ticker of Object.keys(quotes)) recordPriceHistory(ticker, quotes[ticker]);
    saveState();
    return quotes;
  }

  // ---------------- small UI helpers ----------------

  function logoHtml(company) {
    const initial = esc(company.name[0]);
    return `<span class="logo" style="background:${company.color}">
      <img src="https://logo.clearbit.com/${company.domain}?size=80" alt=""
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <span class="logo-fallback" style="display:none">${initial}</span>
    </span>`;
  }

  function changeClass(n) {
    return n > 0 ? "up" : n < 0 ? "down" : "flat";
  }

  function sourceBadge(q) {
    if (!q) return "";
    return q.source === "simulated" ? `<span class="badge">simulated</span>` : "";
  }

  function sparkline(history, width, height) {
    if (!history || history.length < 2) {
      return `<div class="spark-empty">Price history builds up the more you open the app 📈</div>`;
    }
    const closes = history.map((p) => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const stepX = width / (closes.length - 1);
    const points = closes.map((c, i) => {
      const x = i * stepX;
      const y = height - ((c - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const trendUp = closes[closes.length - 1] >= closes[0];
    const color = trendUp ? "var(--up)" : "var(--down)";
    return `<svg viewBox="0 0 ${width} ${height}" class="spark" preserveAspectRatio="none">
      <polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
  }

  // ---------------- routing / shell ----------------

  function navBar(active) {
    const items = [
      ["#/portfolio", "💰", "Portfolio"],
      ["#/browse", "🔎", "Invest"],
      ["#/history", "📜", "History"],
      ["#/settings", "⚙️", "Settings"],
    ];
    return `<nav class="tabbar">
      ${items
        .map(
          ([href, icon, label]) => `<a href="${href}" class="tab ${active === href ? "active" : ""}">
              <span class="tab-icon">${icon}</span><span class="tab-label">${label}</span>
            </a>`
        )
        .join("")}
    </nav>`;
  }

  function screen(activeTab, contentHtml, opts) {
    opts = opts || {};
    app.innerHTML = `
      <div class="screen">
        ${opts.header || ""}
        <div class="content">${contentHtml}</div>
      </div>
      ${activeTab ? navBar(activeTab) : ""}
    `;
  }

  function header(title, backHref) {
    return `<header class="topbar">
      ${backHref ? `<a href="${backHref}" class="back">‹</a>` : `<span class="back-spacer"></span>`}
      <h1>${esc(title)}</h1>
      <span class="back-spacer"></span>
    </header>`;
  }

  async function router() {
    const hash = location.hash || "#/portfolio";
    const [, route, param] = hash.split("/");

    if (route === "portfolio" || !route) return renderPortfolio();
    if (route === "browse") return renderBrowse();
    if (route === "company" && param) return renderCompany(decodeURIComponent(param));
    if (route === "history") return renderHistory();
    if (route === "settings") return renderSettings();
    if (route === "add-funds") return renderAddFunds();
    return renderPortfolio();
  }

  // ---------------- screens ----------------

  async function renderPortfolio() {
    const allowance = creditAllowanceIfDue();
    const tickers = Object.keys(state.holdings).filter((t) => state.holdings[t].shares > 0);
    screen("#/portfolio", `<div class="loading">Loading your portfolio…</div>`, { header: header(CFG.appName || "MoneyTree") });

    if (tickers.length) await loadQuotes(tickers);
    const totals = portfolioTotals();

    const holdingsHtml = tickers.length
      ? tickers
          .map((ticker) => {
            const c = COMPANY_BY_TICKER[ticker];
            const h = state.holdings[ticker];
            const q = quotesCache[ticker];
            const value = q ? h.shares * q.price : 0;
            const gain = value - h.costBasis;
            const gainPct = h.costBasis > 0 ? (gain / h.costBasis) * 100 : 0;
            return `<a href="#/company/${ticker}" class="holding-row">
              ${logoHtml(c)}
              <div class="holding-main">
                <div class="holding-name">${esc(c.name)}</div>
                <div class="holding-sub">${fmtShares(h.shares)} shares</div>
              </div>
              <div class="holding-value">
                <div class="holding-worth">${fmtMoney(value)}</div>
                <div class="holding-gain ${changeClass(gain)}">${fmtMoney(gain)} (${fmtPct(gainPct)})</div>
              </div>
            </a>`;
          })
          .join("")
      : `<div class="empty-state">
          <p>No investments yet — pick a company and buy your first shares!</p>
          <a class="btn btn-primary" href="#/browse">Browse companies</a>
        </div>`;

    const banner = allowance
      ? `<div class="banner">🎉 Your $${allowance.amount} weekly allowance just landed in your cash balance!</div>`
      : "";

    screen(
      "#/portfolio",
      `
      ${banner}
      <div class="hero">
        <div class="hero-label">Total portfolio value</div>
        <div class="hero-value">${fmtMoney(totals.total)}</div>
        <div class="hero-gain ${changeClass(totals.gain)}">${fmtMoney(totals.gain)} (${fmtPct(totals.gainPct)}) all-time</div>
      </div>
      <div class="cash-row">
        <div>💵 Cash to invest</div>
        <div class="cash-amount">${fmtMoney(totals.cash)}</div>
      </div>
      <div class="section-title">Your investments</div>
      <div class="holding-list">${holdingsHtml}</div>
    `,
      { header: header(CFG.appName || "MoneyTree") }
    );
  }

  async function renderBrowse() {
    screen("#/browse", `<div class="loading">Loading prices…</div>`, { header: header("Invest") });
    const tickers = COMPANIES.map((c) => c.ticker);
    await loadQuotes(tickers);

    const rows = COMPANIES.map((c) => {
      const q = quotesCache[c.ticker];
      const held = state.holdings[c.ticker];
      return `<a href="#/company/${c.ticker}" class="browse-row">
        ${logoHtml(c)}
        <div class="holding-main">
          <div class="holding-name">${esc(c.name)} ${sourceBadge(q)}</div>
          <div class="holding-sub">${c.ticker}${held && held.shares > 0 ? " · you own this" : ""}</div>
        </div>
        <div class="holding-value">
          <div class="holding-worth">${q ? fmtMoney(q.price) : "—"}</div>
          <div class="holding-gain ${q ? changeClass(q.changePercent) : ""}">${q ? fmtPct(q.changePercent) : ""}</div>
        </div>
      </a>`;
    }).join("");

    screen(
      "#/browse",
      `<div class="section-title">Companies you can invest in</div>
       <p class="hint">Prices update every few minutes${CFG.provider === "demo" ? " (currently using simulated demo prices — see Settings)" : ""}.</p>
       <div class="holding-list">${rows}</div>`,
      { header: header("Invest") }
    );
  }

  async function renderCompany(ticker) {
    const c = COMPANY_BY_TICKER[ticker];
    if (!c) {
      location.hash = "#/browse";
      return;
    }
    screen(null, `<div class="loading">Loading ${esc(c.name)}…</div>`, { header: header(c.name, "#/browse") });
    await loadQuotes([ticker]);
    const q = quotesCache[ticker];
    const held = state.holdings[ticker] || { shares: 0, costBasis: 0 };
    const heldValue = q ? held.shares * q.price : 0;
    const heldGain = heldValue - held.costBasis;

    renderCompanyContent(c, q, held, heldValue, heldGain, "buy", "$", "");
  }

  function renderCompanyContent(c, q, held, heldValue, heldGain, action, unit, amountStr) {
    const price = q ? q.price : null;
    const maxAffordableShares = price ? state.balance / price : 0;
    const canSell = held.shares > 0;

    const actionTabsHtml = canSell
      ? `<div class="mode-toggle">
          <button class="mode-btn ${action === "buy" ? "active" : ""}" data-action="buy">Buy</button>
          <button class="mode-btn ${action === "sell" ? "active" : ""}" data-action="sell">Sell</button>
        </div>`
      : "";

    const unitTabsHtml = `<div class="mode-toggle mode-toggle-secondary">
      <button class="unit-btn ${unit === "$" ? "active" : ""}" data-unit="$">By dollar amount</button>
      <button class="unit-btn ${unit === "#" ? "active" : ""}" data-unit="#">By # of shares</button>
    </div>`;

    const quickChipsHtml =
      action === "sell"
        ? ["25", "50", "100"]
            .map((pct) => `<button class="chip" data-quick-pct="${pct}">${pct}%</button>`)
            .join("")
        : ["10", "25", "50", "100"].map((v) => `<button class="chip" data-quick="${v}">${unit === "$" ? "$" + v : v}</button>`).join("") +
          `<button class="chip" data-quick="max">Max</button>`;

    const buySellHtml = `
      <div class="trade-box">
        ${actionTabsHtml}
        ${unitTabsHtml}
        <input class="amount-input" inputmode="decimal" type="text"
               placeholder="${unit === "$" ? "Dollar amount" : "Number of shares"}"
               value="${esc(amountStr)}" id="amount-input">
        <div class="quick-amounts">${quickChipsHtml}</div>
        <button class="btn ${action === "sell" ? "btn-secondary" : "btn-primary"} full" id="trade-confirm-btn">
          ${action === "sell" ? "Sell " + esc(c.ticker) : "Buy " + esc(c.ticker)}
        </button>
        <div id="trade-error" class="trade-error"></div>
      </div>
    `;

    const positionHtml =
      held.shares > 0
        ? `<div class="position-box">
            <div class="section-title">Your position</div>
            <div class="row"><span>Shares owned</span><span>${fmtShares(held.shares)}</span></div>
            <div class="row"><span>Current value</span><span>${fmtMoney(heldValue)}</span></div>
            <div class="row"><span>Gain / loss</span><span class="${changeClass(heldGain)}">${fmtMoney(heldGain)}</span></div>
          </div>`
        : "";

    screen(
      null,
      `
      <div class="company-head">
        ${logoHtml(c)}
        <div>
          <div class="company-name">${esc(c.name)} <span class="ticker-pill">${c.ticker}</span></div>
          <div class="company-blurb">${esc(c.blurb)}</div>
        </div>
      </div>

      ${
        price
          ? `<div class="price-row">
              <div class="price-big">${fmtMoney(price)}</div>
              <div class="price-change ${changeClass(q.changePercent)}">${fmtMoney(q.change)} (${fmtPct(q.changePercent)}) today ${sourceBadge(q)}</div>
            </div>
            <div class="chart-wrap">${sparkline(state.priceHistory[c.ticker] || window.MarketProvider.simulatedHistory(c.ticker, 14), 320, 90)}</div>
            <a class="history-link" href="https://finance.yahoo.com/quote/${encodeURIComponent(c.ticker)}/" target="_blank" rel="noopener noreferrer">
              📈 See ${esc(c.ticker)}'s full price history ↗
            </a>`
          : `<div class="empty-state"><p>Couldn't load a price for ${esc(c.ticker)} right now.</p></div>`
      }

      <details class="more-info">
        <summary>More info</summary>
        ${
          q
            ? `<div class="row"><span>Today's open</span><span>${fmtMoney(q.open)}</span></div>
               <div class="row"><span>Today's high</span><span>${fmtMoney(q.high)}</span></div>
               <div class="row"><span>Today's low</span><span>${fmtMoney(q.low)}</span></div>
               <div class="row"><span>Previous close</span><span>${fmtMoney(q.prevClose)}</span></div>
               <div class="row"><span>You could afford</span><span>${fmtShares(maxAffordableShares)} shares</span></div>`
            : ""
        }
      </details>

      ${positionHtml}
      ${price ? buySellHtml : ""}
    `,
      { header: header(c.name, "#/browse") }
    );

    if (!price) return;
    wireTradeBox(c, q, held, action, unit);
  }

  function wireTradeBox(c, q, held, action, unit) {
    const input = document.getElementById("amount-input");
    const errorEl = document.getElementById("trade-error");

    function rerender(newAction, newUnit, amountStr) {
      const heldValue = held.shares * q.price;
      renderCompanyContent(c, q, held, heldValue, heldValue - held.costBasis, newAction, newUnit, amountStr || "");
    }

    document.querySelectorAll(".mode-btn[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => rerender(btn.dataset.action, unit, ""));
    });

    document.querySelectorAll(".unit-btn").forEach((btn) => {
      btn.addEventListener("click", () => rerender(action, btn.dataset.unit, ""));
    });

    // Buy quick chips: fixed $ / share amounts, plus "Max" based on cash available
    document.querySelectorAll(".chip[data-quick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.quick === "max") {
          input.value = unit === "$" ? String(Math.floor(state.balance)) : fmtShares(Math.floor((state.balance / q.price) * 1000) / 1000);
        } else {
          input.value = btn.dataset.quick;
        }
      });
    });

    // Sell quick chips: percentage of the shares actually held
    document.querySelectorAll(".chip[data-quick-pct]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pct = parseFloat(btn.dataset.quickPct) / 100;
        const shares = held.shares * pct;
        input.value = unit === "$" ? String(round2(shares * q.price)) : fmtShares(Math.floor(shares * 1000) / 1000);
      });
    });

    const confirmBtn = document.getElementById("trade-confirm-btn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        try {
          const val = parseFloat(input.value);
          if (!val || val <= 0) throw new Error("Enter an amount first.");
          const shares = unit === "$" ? val / q.price : val;
          if (action === "sell") {
            sell(c.ticker, shares, q.price);
          } else {
            buy(c.ticker, shares, q.price);
          }
          location.hash = "#/portfolio";
        } catch (e) {
          errorEl.textContent = e.message;
        }
      });
    }
  }

  function renderHistory() {
    const rows = state.trades.length
      ? state.trades
          .map((t) => {
            const c = t.ticker ? COMPANY_BY_TICKER[t.ticker] : null;
            const when = new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            let label, amountHtml;
            if (t.type === "buy") {
              label = `Bought ${fmtShares(t.shares)} shares of ${c ? c.name : t.ticker}`;
              amountHtml = `<span class="down">-${fmtMoney(t.amount)}</span>`;
            } else if (t.type === "sell") {
              label = `Sold ${fmtShares(t.shares)} shares of ${c ? c.name : t.ticker}`;
              amountHtml = `<span class="up">+${fmtMoney(t.amount)}</span>`;
            } else if (t.type === "allowance") {
              label = t.note || "Weekly allowance";
              amountHtml = `<span class="up">+${fmtMoney(t.amount)}</span>`;
            } else {
              label = t.note || "Funds added";
              amountHtml = `<span class="up">+${fmtMoney(t.amount)}</span>`;
            }
            return `<div class="history-row">
              <div>
                <div class="holding-name">${esc(label)}</div>
                <div class="holding-sub">${when}</div>
              </div>
              <div>${amountHtml}</div>
            </div>`;
          })
          .join("")
      : `<div class="empty-state"><p>No activity yet — your trades and allowance deposits will show up here.</p></div>`;

    screen("#/history", `<div class="section-title">Activity</div><div class="holding-list">${rows}</div>`, { header: header("History") });
  }

  function renderSettings() {
    screen(
      "#/settings",
      `
      <div class="section-title">This week</div>
      <div class="row"><span>Starting balance</span><span>${fmtMoney(CFG.startingBalance ?? 1000)}</span></div>
      <div class="row"><span>Weekly allowance</span><span>${fmtMoney(CFG.weeklyAllowance ?? 100)}</span></div>
      <div class="row"><span>Price source</span><span>${CFG.provider === "demo" ? "Simulated (demo)" : CFG.provider}</span></div>

      <div class="section-title">Parent tools</div>
      <a class="btn btn-primary full" href="#/add-funds">Add funds (passcode required)</a>
      <button class="btn btn-secondary full" id="change-passcode">Change passcode</button>
      <button class="btn btn-danger full" id="reset-app">Reset all data</button>
      <p class="hint">Resetting starts this device back at ${fmtMoney(CFG.startingBalance ?? 1000)} and clears all trades. This can't be undone.</p>
    `,
      { header: header("Settings") }
    );

    document.getElementById("change-passcode").addEventListener("click", () => {
      openPasscodeFlow({
        title: "Enter current passcode",
        onSuccess: () => {
          openPasscodeFlow({
            title: "Choose a new passcode",
            skipCheck: true,
            onSuccess: (code) => {
              state.passcode = code;
              saveState();
              alert("Passcode updated.");
              renderSettings();
            },
          });
        },
      });
    });

    document.getElementById("reset-app").addEventListener("click", () => {
      openPasscodeFlow({
        title: "Enter passcode to reset",
        onSuccess: () => {
          if (confirm("This clears everything on this device and starts over. Are you sure?")) {
            localStorage.removeItem(STATE_KEY);
            state = loadState();
            location.hash = "#/portfolio";
          }
        },
      });
    });
  }

  function renderAddFunds() {
    screen(null, "", { header: header("Add Funds", "#/settings") });
    openPasscodeFlow({
      title: "Parent passcode",
      backHref: "#/settings",
      onSuccess: () => renderAddFundsAmount(),
    });
  }

  function renderAddFundsAmount() {
    screen(
      null,
      `
      <div class="section-title">Add funds</div>
      <p class="hint">This goes straight into the cash balance — for allowance bonuses, birthday money, or any manual top-up.</p>
      <input class="amount-input" inputmode="decimal" type="text" placeholder="Dollar amount" id="funds-input">
      <div class="quick-amounts">
        ${["10", "25", "50", "100"].map((v) => `<button class="chip" data-quick="${v}">$${v}</button>`).join("")}
      </div>
      <button class="btn btn-primary full" id="add-funds-confirm">Add to balance</button>
      <div id="funds-error" class="trade-error"></div>
    `,
      { header: header("Add Funds", "#/settings") }
    );

    const input = document.getElementById("funds-input");
    document.querySelectorAll(".chip").forEach((btn) => btn.addEventListener("click", () => (input.value = btn.dataset.quick)));
    document.getElementById("add-funds-confirm").addEventListener("click", () => {
      const val = parseFloat(input.value);
      const errorEl = document.getElementById("funds-error");
      if (!val || val <= 0) {
        errorEl.textContent = "Enter an amount first.";
        return;
      }
      state.balance = round2(state.balance + val);
      addTrade({ type: "deposit", amount: round2(val), note: "Funds added by parent" });
      saveState();
      location.hash = "#/portfolio";
    });
  }

  // Reusable numeric-keypad passcode screen.
  function openPasscodeFlow({ title, onSuccess, skipCheck, backHref }) {
    let entered = "";
    renderPad();

    function renderPad() {
      screen(
        null,
        `
        <div class="passcode-wrap">
          <div class="section-title center">${esc(title)}</div>
          <div class="dots">${[0, 1, 2, 3].map((i) => `<span class="dot ${i < entered.length ? "filled" : ""}"></span>`).join("")}</div>
          <div id="passcode-error" class="trade-error center"></div>
          <div class="keypad">
            ${["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"]
              .map((k) => (k ? `<button class="key" data-key="${k}">${k}</button>` : `<span></span>`))
              .join("")}
          </div>
        </div>
      `,
        { header: header(title, backHref || "#/settings") }
      );

      document.querySelectorAll(".key").forEach((btn) => {
        btn.addEventListener("click", () => {
          const key = btn.dataset.key;
          if (key === "⌫") {
            entered = entered.slice(0, -1);
          } else if (entered.length < 4) {
            entered += key;
          }
          if (entered.length === 4) {
            if (skipCheck || entered === state.passcode) {
              onSuccess(entered);
              return; // onSuccess renders the next screen — don't re-render the keypad over it
            } else {
              document.getElementById("passcode-error").textContent = "That's not right — try again.";
              entered = "";
              setTimeout(renderPad, 400);
              return;
            }
          }
          renderPad();
        });
      });
    }
  }

  // ---------------- boot ----------------

  window.addEventListener("hashchange", router);
  document.addEventListener("DOMContentLoaded", () => {
    state = loadState();
    router();
  });

  if (document.readyState !== "loading") {
    state = loadState();
    router();
  }
})();
