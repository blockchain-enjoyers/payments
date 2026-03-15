# OmniFlow v3 Landing — Current State Spec

> **Status:** Implemented
> **Date:** 2026-03-16
> **Files:** `v3/index.html`, `v3/css/`, `v3/js/`
> **Stack:** Vanilla HTML/CSS/JS + GSAP 3 + ScrollTrigger + Lenis + SimplexNoise

---

## Design System

### Typography
- **Display/Body:** Sora (400, 500, 600, 700)
- **Mono:** JetBrains Mono (400, 600)
- **Headlines:** `clamp(2.5rem, 6vw, 5rem)`, weight 700, letter-spacing -0.03em
- **Headline gradient:** `.gradient-text` on last keyword (blue→purple)
- **Headline glow:** `.section-headline-glow` behind all headlines (600×300px, blur 40px)

### Colors
- Primary: `#1894E8` (blue)
- Purple: `#9F72FF`
- Mint: `#62E2A4`
- Gradient: `linear-gradient(135deg, #1894E8, #9F72FF)`
- Text Primary: `#E4E5EA` / Text Secondary: `#7C7E8A`
- BG Primary: `#0B0D12` / BG Secondary: `#131620`

### Theme
- Dark only (light theme code preserved but disabled)
- Toggle button hidden via `display:none !important` + `hidden`

---

## Section Order

| # | Section | ID | Background | Pinned |
|---|---------|-----|-----------|--------|
| 0 | Nav | — | Glass blur | Fixed |
| bg | Flow field canvas | `#flowCanvas` | Fixed behind all | — |
| 1 | Hero | `#hero` | Transparent (particles visible) | No |
| 2 | Problem Wall | `#problem` | Solid dark | Yes (+700%) |
| 3 | Isometric / How It Works | `#isometric` | Solid dark | Yes (+200%) |
| 4 | Features Accordion | `#features` | Solid dark | Left sticky |
| 4b | Mid-page CTA | `#mid-cta` | Solid, blue/purple tints | No |
| 5 | Security | `#security` | Alt bg | No |
| 6 | Integrations | `#integrations` | Solid dark | No |
| 9 | FAQ | `#faq` | Alt bg | No |
| 10 | CTA | `#cta` | Gradient mesh (blue+purple drift) | No |
| 11 | Footer | `#footer` | Solid footer-bg | No |

---

## #0 — Nav

- Fixed top, height 72px, glass blur background
- Logo: "OmniFlow" (gradient text blue→purple)
- Links: Features, Security, FAQ, Docs
- CTA: "Launch App" (`btn--nav`, href="/app/")
- Theme toggle: **hidden** (disabled)
- Mobile: hamburger → overlay menu
- Scroll effect: `.nav--scrolled` adds bottom border

---

## #1 — Hero

**Layout:** 60/40 split (content left, flow field right)

- **Badge:** "🏆 1st Place "Best DeFi Composer" — ETHGlobal 2026"
  - Purple text, glass bg, gradient border (blue→purple)
- **H1:** "Receiver-first cross-chain **payments.**"
  - `gradient-text` on "payments."
  - `.section-headline-glow` behind headline
- **Subtitle:** "Pay and get paid in crypto. Any token, any chain, one click."
- **CTA:** "Launch App" (`btn--primary`, href="/app/")
- **Animation:** stagger fade-up on load (GSAP)
- **Mobile:** centered, single column, no right visual

---

## #2 — Problem Wall

**Layout:** Horizontal scroll, pinned (+700% scroll height), 7 slides

| Slide | Red text | Gray text |
|-------|----------|-----------|
| 1 | "Which chain?" | "Money is money. That's a bug, not a question." |
| 2 | "Buy ETH to send USDC." | "Read that again." |
| 3 | "Approve. Sign. Switch. Approve. Sign. Confirm. Wait." | "That's one payment." |
| 4 | "They pay in USDT on Arbitrum, you wanted USDC on Base." | "Hope someone know how to bridge." |
| 5 | "Copy-paste address and pray." | "Your bank: autopay, invoices, subscriptions. Crypto?" |
| 6 | "It's your money." | "Until they decide it's not." |
| 7 (resolve) | "What if none of this was your problem?" | — (gradient text, blue→purple) |

- Red text: `clamp(1.5rem, 4vw, 2.75rem)`, color #ff6b6b, text-shadow glow
- Dots nav: 7 dots fixed bottom, red active, purple resolve
- GSAP scrub: translateX tracks scroll progress

---

## #3 — Isometric / How It Works

**Layout:** Pinned SVG (+200% scroll height), viewBox `0 -20 980 450`

### Source Cards (left, 3 cubes):
| Card | Label | Icon |
|------|-------|------|
| src1 | Invoice | Document with lines |
| src2 | Recurring | Clock |
| src3 | Multisig | Two people |

- 3D isometric: 140×66px rect + top/right face polygons
- Text: x=90, y=35, font-size 13, weight 600

### Center Engine:
- Orbital rings (2 back, 2 front, counter-rotating)
- Glass sphere (r=69, gradient body + rim + specular)
- "OmniFlow" text inside sphere
- Pulse animation: scale 1→1.03, 3s infinite

### Scroll-Driven Tokens:
- 15 tokens (5 per source, staggered)
- Path: curve in → 1.5 orbits around sphere → curve out
- Icons: USDC, USDT, ETH (SVG symbols)
- Colored glow behind each token

### Recipient Cards (right, 5 cubes):
| Card | Name | Chain | Logo |
|------|------|-------|------|
| dst1 | alice.eth | Base | `assets/chains/base.svg` |
| dst2 | bob.eth | Arbitrum | `assets/chains/arb.svg` |
| dst3 | carol.eth | Ethereum | `assets/chains/eth_chain.svg` |
| dst4 | dave.eth | Optimism | `assets/chains/optimism.svg` |
| dst5 | eve.eth | Avalanche | `assets/chains/avalanche.svg` |

- 140×56px, left colored stripe, chain logo via `<image>`
- dst4, dst5: `hide-mobile`

### Step Indicators:
1. "01 Pay in — Any source, any chain"
2. "02 Manage — Smart routing engine"
3. "03 Payout — Multi-chain, gasless"

### Scroll Phases:
- 0–15%: Sources bright, rest dimmed
- 15–85%: Engine bright, rest dimmed
- 85–100%: Recipients bright, rest dimmed

---

## #4 — Features Accordion

**Layout:** 45% sticky left + 55% scrolling right

### Left (sticky):
- "More than" (text-primary, `clamp(2.5rem, 6vw, 5rem)`)
- "payments." (gradient-text, same size)
- `.section-headline-glow` behind

### Right (5 features):
| Feature | Description |
|---------|------------|
| Invoicing | "User pays in any token on any chain. We convert and settle to your preferred token and chain automatically." |
| Batch Payouts | "Upload CSV or add recipients manually. One-click cross-chain payout in different tokens to different chains." |
| Gasless | "Zero gas pop-ups. Zero failed transactions. Account Abstraction handles everything." |
| Recurring | "Scheduled payouts and subscription pay-ins. Set once, runs automatically." |
| Flexible Auth | "Passkeys, crypto wallet, email — access your account however you prefer. No forced workflow, no mandatory browser extensions." |

- Title: `clamp(2.4rem, 4.2vw, 4.2rem)`, gradient when active
- States: passed (0.25 opacity) → active (gradient) → upcoming (0.4) → far (0.2)
- Pin releases when last item aligns with "payments."

---

## #4b — Mid-page CTA

**Layout:** Full-viewport split (50/50)

- **Headline:** "Choose your **flow**" (gradient-text on "flow")
  - `clamp(2.5rem, 6vw, 5rem)`, absolute positioned over split
  - `.section-headline-glow` behind
- **Left:** "Get paid in crypto" → "Create Invoice" (blue tint)
- **Right:** "Pay anyone, anywhere" → "Start Payout" (purple tint)
- **Hover:** active side flex 1.2, bg brightens; other side flex 0.8, opacity 0.5
- **Mobile:** stacked vertically

---

## #5 — Security

**Layout:** Hero headline + pill tabs + card panels

- **H2:** "Enterprise-grade **security.**" (gradient-text on "security.")
  - `.section-headline-glow` behind
- **7 pills:** Non-Custodial, No Own Code, Access Control, Limits, Your Account, Recovery, Revoke
  - Animated slider behind active pill
- **7 cards** (tab panels, one visible at a time):

| Tab | Title | Description |
|-----|-------|-------------|
| 1 | Your keys, your funds | Full self-custody from day one |
| 2 | Zero custom contracts | Audited ZeroDev Kernel v3.3, 6M+ accounts |
| 3 | Enforced onchain | Rules enforced by smart contract |
| 4 | You set the rules | Daily caps, auto-expiring permissions |
| 5 | Isolated account | Dedicated smart account per user |
| 6 | Recovery on your terms | Email, contacts, hardware key, dead man's switch |
| 7 | Revoke anytime | One click, no lock-in |

- Card title: gradient-text, `clamp(2.5rem, 5vw, 4rem)`
- Glow color transitions per tab
- Animation: fadeUp 0.4s on tab switch

---

## #6 — Integrations

**Layout:** Hero + partner cards grid + chain marquee

- **H2:** "Powered by **the best.**" (gradient-text)
  - `.section-headline-glow` behind
- **3 partner cards** (grid 3 columns):
  - LI.FI — "Routing"
  - ZeroDev — "Smart Accounts"
  - Circle CCTP v2 — "Bridging"
  - Hover: translateY(-4px), shadow, border brighter
- **Chain marquee** (infinite CSS scroll, 35s):
  - Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, BNB, Linea, Ink, Unichain, Sonic, HyperEVM
  - Logos from `assets/chains/`
  - Gradient fade on edges
- **Label:** "Supported chains" (mono, uppercase)

---

## #9 — FAQ

- **H2:** "Questions? **Answered.**" (gradient-text)
  - `.section-headline-glow` behind
- **7 accordion items** (`<details>`/`<summary>`):

| Question | Answer (summary) |
|----------|-----------------|
| Is OmniFlow custodial? | No. Fully non-custodial... |
| Which chains are supported? | 30+ EVM chains... |
| How does gasless work? | Account Abstraction with paymaster... |
| Is OmniFlow audited? | Audit planned Q3 2026... |
| What tokens can I use? | Any ERC-20 on any supported chain... |
| What does it cost? | Small fee per transaction... |
| How do I integrate? | (via JSON-LD schema) |

- SVG +/− icon animates on open/close

---

## #10 — CTA (Final)

- **H2:** "Never think about **payments** again." (gradient-text on "payments")
  - `.section-headline-glow` behind
  - `data-animate="fade-up"`
- **CTA:** "Try OmniFlow" (`btn--primary btn--lg`, href="/app/")
  - `data-animate="fade-up"`
- **Background:** gradient mesh (blue + purple), `meshDrift` 22s animation
- **Padding:** 120px top/bottom
- **No subtitle, no secondary link** — headline + button only

---

## #11 — Footer

- **Logo:** "OmniFlow"
- **Tagline:** "The cross-chain payments engine."
- **Links:** Docs, GitHub, Twitter, ETHGlobal
- **Legal:** © 2026 OmniFlow, Terms, Privacy
- **3-column layout**

---

## JS Files

| File | Purpose |
|------|---------|
| `main.js` | Theme (force dark), nav scroll, mobile menu, Lenis smooth scroll |
| `flowfield.js` | Canvas particle system (Simplex noise, mouse vortex, 300 particles) |
| `animations.js` | GSAP ScrollTrigger: hero, problem wall, isometric, features, mid-CTA, security pills |
| `isometric.js` | Scroll-driven token paths (cubic bezier curves around sphere) |
| `batch-demo.js` | Status row animation (Pending → Processing → Confirmed) |
| `interactions.js` | Card 3D tilt effect (perspective, rotateX/Y on mousemove) |

---

## Headline Style Guide

All section headlines follow unified style:
- **Font:** Sora, 700 weight, `clamp(2.5rem, 6vw, 5rem)`
- **Letter-spacing:** -0.03em
- **Line-height:** 1.1
- **Gradient:** `.gradient-text` on keyword (last word or key phrase)
- **Glow:** `.section-headline-glow` div (600×300px radial gradient, blur 40px)
- **Badge border:** gradient blue→purple (no mint/green)

Applied to: Hero h1, Features sticky, Mid-CTA, Security h2, Integrations h2, FAQ h2, CTA h2.
