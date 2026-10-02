# ADR-0017 — COD-first payments behind a provider interface; hosted-redirect gateways; signed idempotent webhooks

| Field | Value |
|---|---|
| ID | ADR-0017 |
| Title | Payments architecture |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (F-02), ADR-0009, ADR-0013, ADR-0020 |
| Decisions used | ADR-0014 |

## Purpose and scope
Payment domain design and provider abstraction. Provider-specific details, signatures and field lists are DOC-12 (to be verified from merchant docs).

## Context
COD is the default and majority method in Pakistan (v2 evidence, secondary). Wallets and cards run through gateways: JazzCash advertises a hosted checkout with cards, mobile-account and voucher methods; Easypay publishes integration guides; Raast P2M is documented by SBP (DOC-02 §4, weak third-party summaries; primary docs are behind merchant onboarding). The contract has `paymentMethod: cod|card|wallet|bank_transfer|bnpl` (`schemas.js:392`) and store-level `payments[]` and `codLimit` (`schemas.js:283-286,281`) that are not served or enforced today.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Provider interface; hosted-redirect gateways; COD as a first-class flow | PCI scope stays with gateways; swap providers; COD fraud controls fit | Redirect UX; per-gateway adapter work |
| B. Direct wallet-charge APIs inside our checkout | Smoother UX | More security/compliance surface; gateway-specific |
| C. Payment aggregator (single API for several rails) | One integration | Fees, availability and onboarding unverified |

## Decision
**Option A.**
- Interface (`modules/payments`): `createSession(order) → { redirectUrl | instructions }`, `handleWebhook(rawBody, headers) → PaymentEvent`, `getStatus(ref)`, `refund(ref, amount)`. Adapters: `cod`, `bank_transfer` (manual proof upload), then `jazzcash`, `easypaisa`, `card-gateway`, later `raast`.
- **Payment and order are separate state machines** (DOC-09): `payment: initiated → authorized|pending_confirmation → captured | failed | expired`; a refund is a separate payment row, and the order carries a derived `payment_status` (`unpaid`, `deposit_paid`, `paid`, `refund_due`, `partially_refunded`, `refunded`), DOC-09.7 §5.2–5.3. An order is `confirmed` only when its payment policy is satisfied (COD: confirmation call/WhatsApp done; online: `captured`).
- **COD controls:** `codLimit` enforced server-side; COD disabled for deposit lines (ADR-0014); phone format validated (`03XXXXXXXXX` / `+923XXXXXXXXX` normalised to E.164); first-time or high-value COD orders enter `pending_confirmation` until a staff action or customer WhatsApp reply (DOC-07 orders).
- **Webhooks:** public endpoint per provider; verify signature over the **raw** body; reject stale timestamps if the provider supplies one; store every inbound payload (`payment_events`) with a unique provider event id → duplicate deliveries are no-ops; processing happens in a job (ADR-0009); respond 2xx fast.
- **Idempotency:** every outbound provider call carries our `payment_id` as the merchant reference; retrying never creates a second charge.
- **Reconciliation:** a daily job lists `pending` payments older than 30 min and calls `getStatus`.
- Secrets in environment/secret store only; never in the contract or logs.

## Examples
```ts
interface PaymentProvider {
  id: "cod" | "bank_transfer" | "jazzcash" | "easypaisa" | "card";
  createSession(input: { paymentId: string; amount: Money; returnUrl: string; customer: { phone: string } }): Promise<{ redirectUrl?: string; instructions?: string }>;
  handleWebhook(raw: Buffer, headers: Record<string, string>): Promise<{ eventId: string; paymentId: string; status: "captured" | "failed" | "pending" }>;
}
```

## Consequences
Customers on wallets/cards leave the site briefly; COD gets real fraud controls; adding a gateway is an adapter plus tests. DOC-12 must be completed from official merchant docs before any adapter is coded.

## Rules
**Always:** verify webhook signatures on raw bytes; make handlers idempotent; keep amounts in paisa. **Never:** trust a redirect/return URL as proof of payment; log full card/wallet data; mark an order paid from the browser. **Common mistake:** parsing JSON before verifying the signature.

## Acceptance checklist
- [ ] Replaying the same webhook twice changes nothing (test).
- [ ] A forged webhook (bad signature) returns 401 and creates no event.
- [ ] COD above `codLimit` is rejected server-side.

## Revisit trigger
A gateway lacks a hosted checkout or webhooks (reconsider option B/C for that rail), or COD share drops below 40% for 3 months (invest in prepaid UX).

## Open questions and assumptions
**Unverified:** exact JazzCash/Easypaisa APIs, signature algorithms, sandbox access, fees and settlement times. Merchant accounts are a business prerequisite (CQ-3). Raast availability for merchants is unverified.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Owner answer: COD only at launch, online payment later (README A-07). Decision unchanged; gateway adapters are not on the launch path |
| 2026-10-02 | Launch rule while COD is the only enabled method (README A-07): an order containing a deposit line is accepted with `cod` and held in `pending_confirmation`; staff collect the deposit offline and record it as a manual payment before confirming (DOC-07.5). The "COD disabled for deposit lines" rule applies again as soon as any prepaid method is enabled |
| 2026-10-02 | Phase 5: payment tables and the split between per-payment state and order-level payment status in DOC-09.7 §4–5 |
| 2026-10-02 | Phase 5: provider interface, launch adapters (`cod`, `manual`), bank transfer, gateway research status and the pre-adapter verification checklist in DOC-12 §3 and §8 |
| 2026-10-02 | Phase 7 consistency review: state list matches DOC-09.7 |
