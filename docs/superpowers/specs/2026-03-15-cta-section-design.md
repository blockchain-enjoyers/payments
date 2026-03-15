# CTA Section — Design Spec

> Last updated: 2026-03-15

## Role

Emotional closing of the landing page. Not a conversion push — the page already has 3 conversion points (hero, mid-CTA split, nav). This section closes the narrative arc that started with Wall of Pain.

**Tone:** Relief and simplicity. The pain is over.

## Content

### Headline
```
Never think about
payments again.
```
- "payments" highlighted with brand gradient (blue→purple: `#1894e8` → `#9f72ff`)
- All other text: `--color-text-primary` (#E4E5EA)
- Font: Sora, 700 weight, `clamp(1.75rem, 5vw, 3rem)`, letter-spacing: -0.02em
- Line break after "about" (2 lines on desktop)

### Subtle Link
```
Talk to Founders →
```
- `--color-text-secondary`, 0.875rem
- Hover: transition to `--color-primary`
- Links to: Telegram or mailto (TBD)

### No other elements
- No buttons, no metrics row, no cards, no subtitle

## Visual Treatment

### Background: Gradient Mesh (existing)
Keep current `.bg-mesh--cta` — two radial gradients (blue + purple) with `meshDrift` 22s animation. No changes needed.

### Added: Text Glow
Soft radial glow centered behind the headline:
- `radial-gradient(ellipse, rgba(24,148,232,0.10) 0%, rgba(159,114,255,0.05) 40%, transparent 70%)`
- `filter: blur(25px)`
- Centered on headline, ~60-70% width of container
- Subtle — enhances the text without overpowering

### Layout
- Centered container, generous vertical padding (120px+ top/bottom for breathing room)
- `text-align: center`
- Max-width: let headline breathe, no artificial constraints
- Vertical stack: headline → 28-32px gap → subtle link

## Animation
- Headline fades in on scroll (GSAP ScrollTrigger, `autoAlpha: 0 → 1`, `y: 20 → 0`)
- Subtle link fades in 0.2s after headline
- No other animations — stillness reinforces the relief tone

## Files to Modify
- `v3/index.html:1142-1160` — update CTA HTML
- `v3/css/sections.css:1547-1595` — update CTA styles (add glow, adjust padding)
- `v3/js/animations.js` — add scroll-triggered fade-in for CTA

## What This Replaces
Current CTA has:
- ~~"Stop copy-pasting wallet addresses."~~ → "Never think about payments again."
- ~~"One API. Any chain. Any token. Gasless."~~ → removed (no subtitle)
- ~~btn--rotating-border "Start Your First Batch"~~ → removed (no button)
- "Talk to Founders →" → kept as-is
