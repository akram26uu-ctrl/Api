# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences use the merchant dashboard about equally:

- **Store owners** of small and mid-sized Algerian online stores. They watch results, set the rules (risk thresholds, WhatsApp confirmation, store connections) and decide what to ship. Often working between preparing orders and answering customers.
- **Order-confirmation staff** who work through the day's orders: review flagged orders, contact customers, record the outcome (confirmed, cancelled, no answer).

Developers integrating a custom store (API keys, webhooks) are a secondary audience.

## Product Purpose

Ordium scores every incoming order for fake-order and fraud risk before the merchant ships it, then confirms the order with the customer (automatic WhatsApp message with Confirm / Cancel buttons, or a manual call) and records the result. Success means fewer shipped fake orders, fewer refused cash-on-delivery parcels and returns, and less time spent confirming orders by hand.

## Positioning

- **An explained decision for every order.** No black box: each order shows the signals that produced its score, and the merchant can change each signal's weight and the review/reject thresholds.
- **Built for the Algerian market.** Cash on delivery, wilayas and communes, Algerian phone numbers, DZD, and an interface in Arabic (right-to-left) and French, plus English.

## Operating Context

- Orders arrive automatically from Shopify, YouCan, WooCommerce or a custom store (signed webhooks), or through the API.
- Each decision is ALLOW, REVIEW or REJECT; shadow mode lets a merchant observe rejections without blocking.
- Confirmation happens over WhatsApp (one Ordium-managed number, merchants do not connect their own) or by phone; outcomes (delivered, cancelled, returned, with a reason) feed back into calibration.
- One account can hold several stores; orders, keys and statistics are separated per store. TEST and LIVE environments are separate.

## Capabilities and Constraints

- Risk rules on identity reuse (phone, device, address), velocity, network signals (VPN, proxy, Tor, IP reputation), cancellation/return history, unusual quantity or value against the merchant's own baseline, and cross-merchant reputation (limited to established merchants).
- Live risk IP must be the shopper's IP sent by the store (`customer_ip`), never the merchant server's.
- Languages: Arabic (default, RTL), French, English. Every user-facing string must exist in all three.
- Automatic WhatsApp confirmation is built but stays off until the Meta number and template are approved.
- Pricing, plan limits beyond the current beta, and public launch date are undecided.

## Brand Commitments

- Name: **ORDIUM** / Ordium. Existing dark interface with violet accent and cyan signal color.

## Evidence on Hand

None yet: beta product. No named customers, testimonials, case studies, published statistics or benchmarks. Future work must not invent any of these.

## Product Principles

1. **Explain before asking for trust.** Every score, flag and automatic action shows why it happened.
2. **Daily work first, configuration out of the way.** Processing orders is the main path; settings live in one place.
3. **Fit the local reality.** COD, Arabic-first RTL, local phone and address formats are defaults, not edge cases.
4. **Never block a legitimate customer silently.** Uncertain cases go to review or confirmation, and the merchant keeps the final say.
5. **Only real numbers.** Metrics come from the merchant's own data; no fabricated proof.

## Accessibility & Inclusion

Full RTL support for Arabic and correct LTR for French and English. Keyboard operable, visible focus, touch targets of at least 44px (much of the use is on phones).
