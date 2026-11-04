# WhatsApp order confirmation — Meta setup

Ordium sends one approved **utility** template per order, from a single
Ordium-managed number, with two quick-reply buttons. Code is ready; it stays
inactive until `WHATSAPP_ENABLED=true` and each merchant enables it in the
dashboard (Confirmation tab).

## 1. Meta app (≈ 30 min)
1. https://business.facebook.com → create/select the Ordium business portfolio.
2. https://developers.facebook.com → **Create app** → type *Business* → add product **WhatsApp**.
3. WhatsApp → *API Setup*: note the **Phone number ID** (test number is given immediately)
   and add your own phone as a test recipient (the test number can message up to 5 numbers).
4. App settings → Basic: copy the **App Secret**.
5. Permanent token: Business settings → *System users* → add (Admin) → *Assign assets*
   (the app + the WhatsApp account, full control) → *Generate token* with
   `whatsapp_business_messaging` and `whatsapp_business_management`. Never expires.

## 2. Template (minutes to hours for approval)
WhatsApp Manager → *Message templates* → **Create** → Category **Utility**, name `order_confirmation`.

**Arabic (`ar`)** — body:
```
مرحباً {{1}}،
نود تأكيد طلبك رقم {{2}} بقيمة {{3}} من متجر {{4}}.
هل تؤكد الطلب؟
```
Samples: `أمينة` · `10234` · `4 500 DZD` · `Boutique Oran`
Buttons → *Quick reply*: `تأكيد الطلب` (first) · `إلغاء الطلب` (second)

**French (`fr`)** — same template name, add language:
```
Bonjour {{1}},
Nous souhaitons confirmer votre commande n° {{2}} d'un montant de {{3}} chez {{4}}.
Confirmez-vous la commande ?
```
Buttons: `Confirmer` · `Annuler`

Button order matters: index 0 = confirm, index 1 = cancel.

## 3. Webhook
WhatsApp → *Configuration* → Webhook:
- Callback URL: `https://api.ordium.dev/api/v1/whatsapp/webhook`
- Verify token: the same random value as `WHATSAPP_VERIFY_TOKEN` (≥ 32 chars)
- Subscribe to the **messages** field.

## 4. Server configuration (`.env.ec2`, chmod 600)
```
WHATSAPP_ENABLED=true
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...        # system-user token
WHATSAPP_APP_SECRET=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_TEMPLATE_NAME=order_confirmation
WHATSAPP_TEMPLATE_LANGUAGE=ar
```
Then recreate `api` and `webhook-worker`. Verify the webhook in Meta *after* the API runs with the token.

## 5. Real number
Add a number that is **not** registered on regular WhatsApp/WhatsApp Business app,
verify it by SMS/voice, set the display name (Meta reviews it, ~1–2 days) and start
*Business verification* to lift the messaging limit. Replace `WHATSAPP_PHONE_NUMBER_ID`.

## Behaviour
- Sent only for live orders whose risk decision is in the merchant's list (default ALLOW + REVIEW).
  TEST orders are recorded as `simulated` and never sent.
- Confirm/Cancel button → order `CONFIRMED`/`CANCELLED` (unless the merchant turned
  auto-update off), confirmation attempt + notification + `order.confirmation.updated` webhook,
  then a free thank-you message inside the 24 h window.
- Free-text reply → `needs_review` attempt, status unchanged.
- No reply in 24 h → `no_answer` attempt (no paid reminder).
- Replies are accepted only from the number the message was sent to; Meta retries are de-duplicated.
