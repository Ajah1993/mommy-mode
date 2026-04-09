# bloom. — A Single Mom's Command Center

A Progressive Web App (PWA) featuring meal plans, budget tracking, interactive learning activities by age, a daily journal, and a calendar with notes.

---

## Quick Start (Run Locally)

1. **Install Node.js** — Download from https://nodejs.org (use the LTS version)

2. **Open Terminal** and navigate to this folder:
   ```bash
   cd bloom-pwa
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start the app:**
   ```bash
   npm start
   ```

5. Open http://localhost:3000 in your browser. Done!

---

## Deploy to GitHub Pages (Free Hosting)

### First-time setup:

1. **Create a GitHub account** if you don't have one at https://github.com

2. **Create a new repository:**
   - Go to https://github.com/new
   - Name it `bloom-app` (or whatever you want)
   - Make it Public
   - Don't add a README (you already have one)
   - Click "Create repository"

3. **In your terminal, inside the bloom-pwa folder:**
   ```bash
   git init
   git add .
   git commit -m "Initial bloom. PWA"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/bloom-app.git
   git push -u origin main
   ```

4. **Deploy:**
   ```bash
   npm run deploy
   ```

5. **Enable GitHub Pages:**
   - Go to your repo → Settings → Pages
   - Under "Source", select `gh-pages` branch
   - Click Save

6. Your app is now live at: `https://YOUR_USERNAME.github.io/bloom-app`

### To update after making changes:
```bash
git add .
git commit -m "Updated bloom."
git push
npm run deploy
```

---

## Connect Your Custom Domain (Optional)

If you want it at something like `bloom-app.com`:

1. Buy a domain on Namecheap (or use one you already own)

2. In your GitHub repo, go to Settings → Pages → Custom domain, type your domain

3. In Namecheap DNS settings, add:
   - **CNAME record**: `www` → `YOUR_USERNAME.github.io`
   - **A records** (for apex domain):
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```

4. Wait 15-30 minutes, then check "Enforce HTTPS" in GitHub Pages settings

---

## Install as PWA on Your Phone

Once deployed, open the URL on your phone:

**iPhone (Safari):**
1. Open the URL in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

**Android (Chrome):**
1. Open the URL in Chrome
2. Tap the three dots menu
3. Tap "Install app" or "Add to Home Screen"

The app will appear on your home screen with the bloom. icon and open without a browser bar — it looks and feels like a native app.

---

## File Structure

```
bloom-pwa/
├── public/
│   ├── index.html          ← Main HTML with PWA meta tags
│   ├── manifest.json       ← PWA manifest (name, icons, colors)
│   ├── service-worker.js   ← Offline caching
│   ├── icon-192.png        ← App icon (small)
│   ├── icon-512.png        ← App icon (large)
│   └── favicon.ico         ← Browser tab icon
├── src/
│   ├── App.js              ← The entire bloom. app
│   ├── index.js            ← Entry point + service worker registration
│   └── serviceWorkerRegistration.js  ← SW registration logic
├── package.json            ← Dependencies and scripts
└── README.md               ← You're reading this!
```

---

## Monetization Options

### Option A: Paywall with Stripe (Recommended)
- Create a Stripe account at https://stripe.com
- Add a checkout page before the app
- Users pay once or subscribe, then get access
- You keep ~97% (vs 70% on App Store)

### Option B: Sell via Stan Store
- Link to the app from your existing Stan Store
- Treat it like a digital product ($14.99-$29.99 one-time)
- After purchase, redirect to the app URL

### Option C: Freemium
- Let basic features (meals, calendar) be free
- Gate premium features (learning, budget) behind payment
- Use Stripe or Gumroad for the paywall

---

## Future Enhancements

- [ ] AI-powered weekly content (Claude API for infinite meals + learning)
- [ ] Data persistence with Supabase or Firebase
- [ ] Push notifications for reminders
- [ ] React Native conversion for App Store listing
- [ ] User accounts and cloud sync

---

Built with love for mamas doing it all. 🌱
