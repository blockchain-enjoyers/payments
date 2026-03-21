# OmniFlow

**Payments orchestration protocol. One API. One Balance. Any Chain.**

---

## The Problem

Tokens and USDC are scattered across chains with no unified way to manage them. An organization paying 50 contributors across 5 chains needs 50 separate transactions, native gas tokens on every chain, and manual tracking. There is no single balance, no single API, no single flow.

## The Solution

OmniFlow is a hub-and-spoke payments protocol that unifies fragmented crypto liquidity into a single balance across all chains.

- **Deposit** any stablecoin from any chain — auto-routes to the hub
- **Pay out** to any chain in any token recipients want
- **Batch payouts** — any recipients, any chains, any tokens, one API call
- **Checkout page** — Stripe-like hosted payment page for merchants
- **Passkey auth** — FaceID/TouchID signs every transaction, no seed phrases
- **Fully non-custodial** — every user owns their Modular Smart Contract Account (MSCA)
- **Gasless** — all transactions sponsored by paymaster, users never need gas tokens

---

## Live Links

| What | URL |
|------|-----|
| Backend API | [omniflow.up.railway.app](https://omniflow.up.railway.app) |
| App | [omniflow-app.up.railway.app](https://omniflow-app.up.railway.app) |
| Landing | [omniflow-landing.up.railway.app](https://omniflow-landing.up.railway.app) |

---

## Architecture

**Hub-and-spoke model.** Every deposit flows inward (any chain → Polygon hub), every payout flows outward (Polygon hub → any chain). This reduces routing from N×(N-1) cross-chain paths to just 2N.

**Supported chains:** Polygon (hub), Base, Avalanche, Optimism, Arbitrum — all mainnet.

**Supported tokens:** USDC, USDT, DAI (stablecoins).

```
Source Chain (e.g., Base)           Polygon (Hub)            Destination Chain
       │                               │                              │
  [MSCA Wallet]                   [MSCA Wallet]                  [MSCA Wallet]
       │                               │                              │
       │ 1. approve + deposit          │                              │
       ├──────────────────────────────>│                              │
       │    (UserOp via bundler)       │                              │
       │                               │                              │
       │ 2. burn intent (EIP-712)      │                              │
       ├──────────────────────────────>│                              │
       │    (signed by delegate)       │                              │
       │                               │                              │
       │                               │ 3. mint + deliver            │
       │                               ├─────────────────────────────>│
       │                               │    (UserOp via bundler)      │
```

---

## Key Flows

### 1. Onboarding — Passkey Register + Smart Account

User taps FaceID once. A Passkey credential is created, a deterministic MSCA address is computed via CREATE2, and the contract deploys automatically on first UserOp.

### 2. Deposit — Any Token → USDC → Hub

User holds WETH on Arbitrum. LI.FI swaps to USDC, Gateway bridges to hub. One biometric tap.

### 3. Payout — Hub → Any Token on Any Chain

Recipient wants DAI on Optimism. OmniFlow bridges USDC from hub, swaps to DAI on destination. Server-side via ECDSA executor.

### 4. Batch Payout — Multiple Recipients, Chains, Tokens

One API call distributes funds to N recipients across different chains and tokens. Each destination gets its own Gateway bridge + optional LI.FI swap.

```
POST /v1/operations/send
{
  "recipients": [
    { "address": "0xAlice...", "chain": "base",     "amount": "500" },
    { "address": "0xBob...",   "chain": "arbitrum",  "amount": "200", "outputToken": "0x..." },
    { "address": "0xCarol...", "chain": "optimism",  "amount": "300", "outputToken": "0x..." }
  ],
  "sourceChain": "polygon",
  "sourceToken": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"
}
```

### 5. Checkout — Stripe-like Payment Page

Merchant creates invoice, gets checkout URL. Payer selects chain and token, connects wallet, pays. Settlement runs automatically server-side.

---

## Project Structure

| Directory | Description |
|-----------|-------------|
| `backend/` | NestJS REST API — Prisma ORM, Circle SDK, LI.FI, Gateway |
| `frontend/` | Dashboard UI + checkout page (vanilla HTML/JS/CSS) |
| `landing/` | Marketing landing page |
| `docs/` | Design specs and implementation plans |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | NestJS 11 + TypeScript |
| Database | Prisma 7 (SQLite dev / PostgreSQL prod) |
| Smart Accounts | ERC-4337 via ZeroDev Kernel v3.1 |
| Cross-chain | Circle Gateway (CCTP V2) |
| Swaps | LI.FI Quote API |
| Auth | Passkeys (WebAuthn) + JWT |
| Bundlers | ZeroDev + Pimlico (fallback) |
| Frontend | Vanilla HTML/CSS/JS (no framework) |
| Deploy | Railway |

---

## Key Technologies Used

### Circle Gateway (CCTP V2)
Native USDC burn-attestation-mint across chains. No wrapped tokens, no liquidity pools. Real native USDC on every chain.

### Circle Modular Wallets (MSCA)
ERC-4337 smart accounts with WebAuthn signer. One Passkey controls accounts on all chains. Lazy deployment via CREATE2.

### LI.FI
Any-token support on both ends. Deposit any token — auto-swaps to USDC. Payout in any token — auto-swaps from USDC. Aggregates DEXes for optimal routes.

### Delegate Mechanism
Gateway requires EIP-712 signatures (EOA only, no EIP-1271). We add an EOA delegate to the MSCA with limited permissions, bridging the gap between Modular Wallets and Gateway.

---

## API Overview

All endpoints at `/v1`. Interactive docs at `/api`.

| Endpoint | Description |
|----------|-------------|
| `POST /auth/register` | Register with passkey |
| `POST /auth/login` | Login with passkey |
| `GET /wallet/balances` | Unified balance across all chains |
| `POST /operations/send` | Payout (single or batch) |
| `POST /payments` | Create checkout invoice |
| `GET /payments/:id` | Get invoice (public, for checkout page) |
| `POST /payments/:id/pay` | Submit payment proof |
| `POST /webhooks` | Register webhook endpoint |
