# Meet Radadiya — Portfolio (Vite + GSAP + Lenis)

Animated, single-page portfolio for an **AI / ML Engineer**. Smooth momentum
scroll (Lenis), cinematic scroll-triggered reveals, pinned project showcase,
count-up stats, magnetic CTAs (GSAP + ScrollTrigger). Fully static — no backend.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs to dist/
npm run preview    # serve the production build (mirrors what Cloudflare ships)
```

## Deploy to Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → pick this repo.
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. **Save and Deploy.** You get a `*.pages.dev` URL.

### ⚠️ Turn OFF Rocket Loader (this is why the old site had no animations)

Cloudflare's **Rocket Loader** rewrites script execution and breaks
JS-driven animation. It's the reason the previous build showed no motion once
deployed.

- Dashboard → your site → **Speed → Optimization → Content Optimization**
- Set **Rocket Loader = Off**. Also turn **Auto Minify (JS)** off.

This build ships its JS as a bundled ES module, which Rocket Loader ignores by
design — but switching it off removes any doubt. (Even with all JS disabled, the
page degrades to fully-readable static content — no blank sections.)

## Swapping in real assets

- **Résumé:** replace `public/Meet_Radadiya_Resume.pdf`.
- **Project / hero images:** currently tasteful Unsplash stand-ins referenced in
  `index.html`. Drop real screenshots into `public/` and point the `src=`
  attributes at them (e.g. `/medisight.png`). Each image has a gradient
  fallback, so a missing image never shows a broken-image icon.
- **Accent color:** change the single `--accent` variable at the top of
  `src/style.css` to re-skin the whole site.
- **Links:** GitHub (`MR-0312`) and LinkedIn (`meet-radadiya`) are wired in
  `index.html`; MediSight & DermaScan link to your HF Spaces.

## Stack

- [Vite](https://vitejs.dev) — build/bundler
- [GSAP](https://gsap.com) + ScrollTrigger — animation engine
- [Lenis](https://github.com/darkroomengineering/lenis) — smooth scroll

All motion respects `prefers-reduced-motion`.
