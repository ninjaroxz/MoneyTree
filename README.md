# MoneyTree — a paper-trading investing app for kids

A simple installable web app where each daughter gets her own portfolio: real
(delayed) stock prices, play money only, a weekly allowance, and a
passcode-protected screen for you to add extra funds. No backend, no login,
no real money — everything lives on the iPad it's installed on.

## 1. Try it immediately (no setup)

The app ships in **demo mode** by default (`config.js` → `provider: "demo"`),
which makes up realistic-looking price movement with no API key or signup
needed at all. Open `index.html` in a browser, or host it (step 2), and it
just works — great for checking the app out before wiring up real prices.

## 2. Put it online

This is a static site (plain HTML/CSS/JS, no build step) — any static host
works. Two easy free options:

- **Netlify Drop** — go to https://app.netlify.com/drop and drag the whole
  `kids-investing-app` folder onto the page. You'll get a URL in seconds.
- **GitHub Pages** — push this folder to a GitHub repo, then turn on Pages
  for it in the repo's Settings → Pages. You'll get a URL like
  `https://yourname.github.io/kids-investing-app/`.

Either way, note the URL — that's what you'll open on each iPad.

## 3. Turn on real stock prices (optional but recommended)

1. Sign up for a **free** API key at one of:
   - **Finnhub** (recommended — more generous free rate limit):
     https://finnhub.io/register
   - **Twelve Data**: https://twelvedata.com/pricing
2. Open `config.js` and set:
   ```js
   provider: "finnhub",       // or "twelvedata"
   apiKey: "your-key-here",
   ```
3. Re-deploy (drag the folder onto Netlify Drop again, or push to GitHub).

Note: the API key is visible in the app's front-end code, which is normal for
a small personal project like this but means it's not meant to be a secret —
free-tier keys are the right fit here (nothing paid or sensitive is exposed).

If a price lookup ever fails (bad key, hit a rate limit, no signal), that one
stock silently falls back to simulated data and shows a small "simulated"
tag, rather than showing an error to the kids.

## 4. Install it on each iPad

1. Open the site's URL in **Safari** on the iPad (must be Safari, not Chrome,
   for "Add to Home Screen" to make a full-screen app).
2. Tap the **Share** button, then **Add to Home Screen**.
3. It now opens like a real app — full screen, its own icon, no address bar.

Do this separately on each daughter's iPad. Because each device keeps its own
local data, their portfolios are automatically completely separate — no
accounts or profile-switching needed.

## 5. Set your own passcode

The default parent passcode is `1234` (set in `config.js` as
`defaultPasscode`). Change it either by editing that value before you deploy,
or right on the iPad: **Settings → Change passcode** inside the app (enter
the current code, then choose a new one). This passcode guards the "Add
Funds" screen — it's a light deterrent for kids, not real security.

## 6. Customize the company list

Edit `data/companies.js` — it's a plain array, add or remove entries freely.
Each needs a stock `ticker`, a `name`, a `domain` (used to fetch a logo, no
key needed), a fallback `color`, and a one-line kid-friendly `blurb`.

## What's in this folder

```
index.html               the app shell
style.css                all styling
app.js                   app logic, screens, local storage state
config.js                your settings: API key, starting balance, allowance, passcode
data/companies.js        the curated list of companies kids can invest in
data/market-provider.js  the Finnhub / Twelve Data / demo price-fetching layer
manifest.json, sw.js     PWA install + basic offline support
icons/                   home-screen icons
```

## How money works, under the hood

- Each iPad starts both girls at **$1,000** in play cash.
- **$100** is automatically added every 7 days, the first time the app is
  opened after a week has passed (it catches up if the app wasn't opened for
  a while — no allowance is lost, it just arrives in a lump when next opened).
- Buying/selling supports either a dollar amount (fractional shares, like a
  real modern brokerage) or a whole number of shares.
- Everything — cash balance, holdings, and trade history — is stored only in
  that iPad's local browser storage. Nothing syncs anywhere, so an app
  reinstall or "Clear website data" in Safari settings would reset it back to
  the starting balance. That's a deliberate simplicity trade-off for v1; if
  you ever want portfolios backed up or visible from your phone, that would
  mean adding a small shared backend — worth revisiting once the girls are
  actually using it day to day.

## Ideas for later (not built yet)

A short recap of what the brief flagged as good phase-2/3 additions once the
core habit sticks: plain-language "why did this stock move" explainers,
a weekly recap notification, bite-sized investing lessons unlocked by
trading, and a friendly leaderboard between the two girls.
