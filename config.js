// ---- App configuration ----
// Edit the values below, then re-deploy (or just refresh, if you're hosting
// this by re-uploading the folder). No build step needed — this is plain JS.

window.APP_CONFIG = {
  // Which market data source to use: "finnhub", "twelvedata", or "demo".
  // "demo" needs no signup at all and is great for trying the app out —
  // it makes up realistic-looking (but fake) price movement.
  //
  // For real prices, sign up for a free API key at:
  //   Finnhub:     https://finnhub.io/register        (recommended — higher free rate limit)
  //   Twelve Data: https://twelvedata.com/pricing      (works too, lower free rate limit)
  // then set provider + apiKey below. See README.md for the full walkthrough.
  provider: "finhub",
  provider: "da875upr01qo86cgch5gda875upr01qo86cgch60",
  apiKey: "",

  // Money settings — both girls get the same amounts.
  startingBalance: 1000,
  weeklyAllowance: 100,

  // Default 4-digit passcode for the parent-only "Add Funds" screen.
  // Change this to your own code before handing over the iPad — it's stored
  // in the app's local data, not sent anywhere, and it's meant to keep a kid
  // from casually topping herself up, not as real security.
  defaultPasscode: "1234",

  appName: "MoneyTree", // shown on the home screen and splash
};
