# Flowfield Speed Fix — Design Spec

> Date: 2026-03-20

## Problem

Flow field particles use delta-time normalized to 60fps (`elapsed / 16.667`). On a ProMotion Mac (120Hz), this makes particles move at half the speed the user expects — they look slow. The user's reference speed is 120Hz (which is how the page looks most of the time on their machine).

## Solution: Normalize to 120fps

**File:** `landing/js/flowfield.js`

**Changes:**

1. Change normalization base from 60fps to 120fps:
   - `elapsed / 16.667` → `elapsed / 8.333`
   - At 120Hz: `dt = 1.0` → same speed as original 120Hz behavior
   - At 60Hz: `dt = 2.0` → same px/sec as 120Hz, consistent

2. Remove trail throttle (`trailAccum`, `addTrail` variables and logic):
   - Push trail point every frame, as in original code
   - At 60Hz trails are slightly longer in pixels (30 × 2× movement), acceptable for decorative effect

3. `TRAIL_LENGTH = 30` unchanged.

## Diff size: ~5 lines
