// Curated, kid-friendly starting list of real public companies.
// `domain` is used to fetch a logo from Clearbit's free logo API (no key needed);
// `color` is the fallback badge color if the logo image fails to load.
// Feel free to add/remove entries — every screen in the app reads from this list.

window.COMPANIES = [
  { ticker: "AAPL",  name: "Apple",               domain: "apple.com",       color: "#111111", blurb: "Makes iPhones, iPads, Macs, and the Apple Watch." },
  { ticker: "DIS",   name: "Disney",               domain: "disney.com",      color: "#0f3d91", blurb: "Movies, Disney+, and theme parks like Disney World." },
  { ticker: "NKE",   name: "Nike",                 domain: "nike.com",        color: "#111111", blurb: "Sneakers and sports gear — the swoosh logo." },
  { ticker: "MCD",   name: "McDonald's",           domain: "mcdonalds.com",   color: "#da291c", blurb: "The fast-food restaurant with the golden arches." },
  { ticker: "HAS",   name: "Hasbro",               domain: "hasbro.com",      color: "#0056a4", blurb: "Makes toys and games like Monopoly and Nerf." },
  { ticker: "MAT",   name: "Mattel",               domain: "mattel.com",      color: "#e2231a", blurb: "Makes toys like Barbie and Hot Wheels." },
  { ticker: "NFLX",  name: "Netflix",               domain: "netflix.com",     color: "#e50914", blurb: "Streams movies and TV shows." },
  { ticker: "SBUX",  name: "Starbucks",            domain: "starbucks.com",   color: "#00704a", blurb: "Coffee shop chain with the green mermaid logo." },
  { ticker: "TGT",   name: "Target",               domain: "target.com",      color: "#cc0000", blurb: "A big retail store with the red bullseye logo." },
  { ticker: "KO",    name: "Coca-Cola",            domain: "coca-cola.com",   color: "#e4022c", blurb: "Makes Coke and other soft drinks." },
  { ticker: "PEP",   name: "PepsiCo",              domain: "pepsico.com",     color: "#004b93", blurb: "Makes Pepsi, Gatorade, Doritos, and Lay's chips." },
  { ticker: "CROX",  name: "Crocs",                domain: "crocs.com",       color: "#2f6d3b", blurb: "Makes the foam clogs with holes in them." },
  { ticker: "RBLX",  name: "Roblox",               domain: "roblox.com",      color: "#e2231a", blurb: "The online game platform where players build worlds." },
  { ticker: "SPOT",  name: "Spotify",              domain: "spotify.com",     color: "#1db954", blurb: "Streams music and podcasts." },
  { ticker: "AMZN",  name: "Amazon",               domain: "amazon.com",      color: "#ff9900", blurb: "Online shopping and delivery — also makes Kindle & Alexa." },
  { ticker: "WBD",   name: "Warner Bros. Discovery", domain: "wbd.com",       color: "#00a0e0", blurb: "Makes Harry Potter, DC movies, and HBO shows." },
  { ticker: "EA",    name: "Electronic Arts",      domain: "ea.com",          color: "#111111", blurb: "Makes video games like FIFA/EA Sports FC and The Sims." },
  { ticker: "CMG",   name: "Chipotle",             domain: "chipotle.com",    color: "#a81612", blurb: "The build-your-own burrito restaurant chain." },
  { ticker: "LULU",  name: "Lululemon",            domain: "lululemon.com",   color: "#82142c", blurb: "Makes yoga pants and athletic clothing." },
  { ticker: "SONY",  name: "Sony",                 domain: "sony.com",        color: "#000000", blurb: "Makes the PlayStation, TVs, and headphones." },
];
