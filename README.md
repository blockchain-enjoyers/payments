# OmniFlow

**Receiver-first cross-chain payments. The receiving layer for crypto.**

> 1st Place "Best Use of LI.FI Composer in DeFi" - ETHGlobal HackMoney 2026

---

## What is OmniFlow?

OmniFlow lets receivers control how they get paid in crypto. Set your preferred token and chain once - every incoming payment auto-converts through your own smart account. Non-custodial, gasless, one signature.

Senders pay with any token on any chain. Receivers get exactly what they want. No manual bridging, no gas management, no custody handoff.

---

## Links

- **App** (demo mode, no wallet needed): [omniflow-app.up.railway.app](https://omniflow-app.up.railway.app)
- **Landing**: [omniflow-landing.up.railway.app](https://omniflow-landing.up.railway.app)
- **Demo video**: [youtube.com/watch?v=OGP1Qp3q7rk](https://www.youtube.com/watch?v=OGP1Qp3q7rk)

---

## Tech Stack

- **Smart accounts**: ZeroDev Kernel v3.3 (Offchain Labs) - ERC-4337
- **USDC routing**: Circle Gateway (fast cross-chain USDC)
- **Cross-chain routing**: LI.FI SDK (bridge + DEX aggregation)
- **Backend**: NestJS, Prisma, TypeScript
- **Auth**: Passkeys (WebAuthn) - no seed phrases

---

## Supported Chains

Live on mainnet: Arbitrum, Ethereum, Base, Optimism, Polygon, Avalanche


---
