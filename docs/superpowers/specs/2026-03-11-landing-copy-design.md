# OmniFlow v3 Landing — Sales Copy Spec

> **Status:** Implemented
> **Date:** 2026-03-11
> **Files:** `v3/index.html`

## Copy Strategy

1. **Receiver-first messaging** — упор на удобство получателей, не только отправителей
2. **Cross-chain + non-custodial** — две ключевые дифференциации, всегда в связке
3. **One-click + gasless** — все действия максимально просто, без газа
4. **Any token in, any token out** — принимать и платить в любом токене
5. **Pay-in + pay-out** — платформа работает в обе стороны (invoicing + payouts)
6. **Modern design** — модные эффекты, графика, анимации. Сайт должен выглядеть premium
7. **Vanilla JS only** — никаких тяжёлых фреймворков. Vanilla JS + библиотеки для эффектов (GSAP, Lenis)
8. **Any** — any tokens, any recipients, any chains. Без конкретных цифр-лимитов


## Section Order

1. Hero (text + flow field background + trust bar)
2. Problem — Terminal wall of pain (pinned scroll, 6 error lines + 1 green resolution)
3. Isometric Visualization / How It Works (pinned scroll, step indicators)
4. Features (6 outcome-framed cards)
5. Security & Compliance (flow diagram + 3 trust cards + tech badges)
6. Integrations/Supported
7. Traction/Metrics
8. Team / Founders (2 cards)
9. FAQ (7-item accordion + JSON-LD schema)
10. CTA (single primary + subtle link)
11. Footer

---

## Visual Effects Map

### Background Strategy
Flow field canvas (`position: fixed`) всегда за всем контентом. Секции чередуют прозрачный фон (частицы видны) и solid/mesh фон (частицы скрыты):

| Секция | Фон | Частицы видны? |
|--------|-----|---------------|
| Hero | Прозрачный | ✅ Реки + vortex на мышку |
| Isometric | Solid dark | ❌ Фокус на SVG |
| How It Works | Прозрачный | ✅ Реки за карточками |
| Features | Mesh gradient | ❌ Gradient blobs |
| Integrations | Solid dark | ❌ Чистый фон для логотипов |
| Traction | Прозрачный | ✅ Реки за статистикой |
| CTA | Mesh gradient | ❌ Gradient callback к hero |
| Footer | Solid dark | ❌ |

Чередование: ✅❌✅❌❌✅❌❌ — ритм, не монотонно.

### Эффекты по секциям

**1. Hero** — Flow field rivers
- Фон: flow field canvas (вечные реки, mouse vortex)
- Текст: fade-up stagger при загрузке
- Stats badges: fade-up с задержкой

**2. Isometric** — 3D pinned scroll
- Фон: solid dark (скрывает частицы)
- Эффект: **pinned scroll** — SVG залипает, 3 фазы подсвечиваются при скролле (Upload → Route → Execute)
- Animated: dash flow lines, floating cards, center glow pulse
- Step indicators переключаются по фазам

**3. How It Works** — Scroll-reveal cards
- Фон: прозрачный (частицы видны за карточками)
- Эффект: **fade-up stagger** — 3 карточки появляются одна за другой при скролле
- Карточки с glass-эффектом (backdrop-blur) → частицы красиво просвечивают

**4. Features** — Split-screen #1 (sticky left)
- Фон: mesh gradient (purple + blue blobs)
- Эффект: **split-screen** — левая колонка с большим заголовком залипает, правая скроллится с 6 карточками
- Карточки: fade-up по одной при скролле
- Карточки с hover-эффектом (gradient border, subtle lift)

**5. Integrations** — Marquee ticker
- Фон: solid dark
- Эффект: **бегущая лента** — бесконечный горизонтальный скролл логотипов чейнов (Ethereum, Base, Arbitrum, OP, Polygon, Avalanche, Sonic)
- Логотипы с картинками (SVG иконки чейнов)
- Скорость: 30s loop, hover pauses
- Партнёры (LI.FI, ZeroDev, Circle) — статичные карточки над лентой

**6. Traction** — Split-screen #2 (sticky left)
- Фон: прозрачный (частицы видны)
- Эффект: **split-screen** — левая колонка "Small team. Big leverage." залипает, правая скроллится с метриками
- Карточки метрик: **animated counters** (число анимируется от 0 до значения)
- ETHGlobal badge с золотым свечением

**7. CTA** — Call to action
- Фон: mesh gradient (callback к hero)
- Эффект: fade-up текст + **rotating gradient border** на главной кнопке (conic-gradient animation)
- Subtle floating particles (CSS, не canvas)

**8. Footer** — Minimal
- Фон: solid dark
- Без анимаций, clean typography

---

## Section Copy

### 0. Meta/OG
- `<title>`: OmniFlow — Crypto Payments
- `<meta description>`: Cross-chain crypto payments — pay and get paid in any token, on any chain. Gasless, non-custodial. Winner: ETHGlobal HackMoney 2026.
- `og:description`: Pay and get paid in any token, on any chain. One click. Gasless. Non-custodial.

### 1. Hero
- Badge: 🏆 1st Place "Best DeFi Composer" — ETHGlobal 2026
- H1: Receiver-first cross-chain payments.
- Subtitle: Non-custodial pay-in and pay-out infrastructure for crypto teams. Any token, any chain, one click. Gasless.
- CTA Primary: Start Building

### 2. Problem — "Wall of pain"
- **Формат**: Одна строка по центру экрана. Pinned при скролле. Без терминал-chrome, без иконок, без `✗`/`⚠`.
- **Механика**: Scroll-driven. Каждый шаг скролла = fade-out текущей строки → fade-in следующей. После последней — пауза → fade-out → финальная строка fade-in. Unpin.
- **Шрифт**: Sora, 600 weight, clamp(1.2rem, 3vw, 2rem). Чистый текст, по центру.
- **Цвет строк**: красный (#ff6b6b) — цвет боли. Все 6 одним цветом.
- **Финальная**: brand gradient (синий→фиолетовый), glow-эффект.
- **Фон**: тёмный (#0b0d12), ничего лишнего.

**Строки (6, по эскалации):**
```
1. Money is money. "Which chain?" is a bug, not a question.
2. Buy ETH to send USDC. Read that again.
3. Approve. Sign. Switch. Approve. Sign. Confirm. Wait. That's one payment.
4. They pay in ETH on Arbitrum. You wanted USDC on Base. Hope they know how to bridge.
5. Your bank: autopay, invoices, subscriptions. Crypto: copy-paste address and pray.
6. It's your money until they decide it's not.
```

**Финальная (brand gradient):**
```
What if none of this was your problem?
```

### 3. Isometric / How It Works
- Full SVG: source cards (Treasury, Payroll CSV, DAO Fund) → OmniFlow Engine → recipient cards (alice.eth/Base, bob.eth/Arbitrum, etc.)
- Step indicators: 01 Upload, 02 Route, 03 Execute (pinned scroll animation)
- Separate 3-card How It Works section removed (was duplicate)

### 4. Features
- H2: More than batch payouts.
- Subtitle: Batch payouts today. Invoicing, recurring payments, and DeFi operations next. One engine, expanding scope.
- Cards (outcome-framed): Cross-chain ("Stop building separate integrations per chain"), Batch Payouts ("Pay 1,000 recipients in one transaction"), Gasless ("Zero gas pop-ups. Zero failed transactions."), Any Token In/Out ("Accept USDC, pay out ETH"), Non-Custodial ("Your users keep control. Zero custodial liability for you."), Coming Q3 ("Invoicing, recurring, DeFi ops")

### 5. Security & Compliance
- H2: Enterprise-grade security. Zero custody.
- Flow diagram: User Wallet → Smart Account → Recipients
- 3 cards: Non-custodial by design, Smart account isolation (ERC-4337), Open-source contracts
- Trust badges: ZeroDev Kernel v3.3, Safe, Circle CCTP v2
- Audit: Trail of Bits planned Q3 2026

### 6. Integrations/Supported
- H2: Composing the best infrastructure in crypto.
- Partners: LI.FI, ZeroDev, Circle CCTP v2
- Chains marquee: Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, Sonic...

### 7. Traction/Metrics
- H2: Small team. Big leverage.
- Cards: 1st Place ETHGlobal, 2 engineers + AI, $8-10K/mo burn, 60x market growth

### 8. Team / Founders
- H2: Who's building this.
- 2 cards: Ildar (Co-founder & Engineering), Andrey (Co-founder & Engineering)
- Links: GitHub, LinkedIn

### 9. FAQ
- H2: Questions? Answered.
- 7 items: Is OmniFlow custodial?, Which chains?, How does gasless work?, Is it audited?, What tokens?, How to integrate?, Pricing?
- FAQPage JSON-LD schema for SEO
- Native `<details>` accordion

### 10. CTA
- H2: Stop copy-pasting wallet addresses.
- Subtitle: One API. Any chain. Any token. Gasless.
- CTA Primary: Start Your First Batch
- Subtle link: Talk to Founders →

### 11. Footer
- Tagline: The cross-chain payment engine for crypto teams.
- Tech: Built on ZeroDev + Circle CCTP v2 + LI.FI + Pimlico
