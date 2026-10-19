# Payments

Today every order is **paid at pick-up**: `PAYMENT_GATEWAY`
(`src/app/shared/payments/payment-gateway.ts`) is `PayAtPickupGateway`, and
checkout calls `start(orderId)` after `create_order`. The app never sees card
data, and amounts always come from the server (`create_order`).

## Plan for Wompi (not implemented)

1. **Hosted checkout**. A new Edge Function `start-payment` (JWT, the
   caller's own order only) reads the order total from the database, builds
   the Wompi payment link or widget data with `reference = order id`,
   `amount_in_cents = total_cop * 100`, currency COP, the integrity signature
   (SHA-256 of reference + amount + currency + integrity secret, server side)
   and a redirect URL back to `/orders/:id`. The app only opens that URL:
   `WompiGateway.start()` returns a new `PaymentStart` kind `redirect`.
2. **Signed event**. A public Edge Function `wompi-events` receives
   `transaction.updated`, verifies the event checksum with the events secret
   (properties listed in `signature.properties` + timestamp + secret,
   SHA-256), rejects anything unsigned or replayed, and re-reads the
   transaction from the Wompi API before trusting it.
3. **Idempotency by reference**. A `payments` table (`order_id` unique,
   `wompi_transaction_id` unique, `status`, `amount_cop`, timestamps) updated
   with `insert ... on conflict do update` only when the status moves
   forward; the same event delivered twice changes nothing.
4. **Amounts from the server only**. The event amount must equal
   `orders.total_cop * 100`; a mismatch is recorded and never marks the order
   as paid.
5. **Payment state apart from the order state**. `payments.status`
   (`pending`, `approved`, `declined`, `voided`, `error`) never changes
   `orders.status`; the owner sees "Pagado en línea" next to the order, and a
   declined payment leaves the order to be paid at pick-up or cancelled.
6. **Secrets** (Edge Function secrets only): public key, integrity secret,
   events secret, private key. Sandbox keys first; the app ships only the
   public key, if any.
7. **Tests**: signature verification (good, tampered, missing), replay and
   duplicate events, amount mismatch, unknown reference, RLS on `payments`
   (customer reads their own, owner reads their businesses', nobody writes).
