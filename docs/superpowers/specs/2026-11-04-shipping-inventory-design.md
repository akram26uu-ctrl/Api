# الشحن والتوصيل والمخزون — وثيقة التصميم

التاريخ: 2026-11-04 · الحالة: بانتظار موافقة صاحب المنتج · النماذج المرئية: https://claude.ai/artifact/XooSgh3CdkobkVMU9h2tfS

## 1. لماذا

يقيّم Ordium اليوم الطلب ويؤكده مع الزبون، لكن الإرسال إلى شركة التوصيل ومعرفة النتيجة يبقيان عملًا يدويًا خارج المنصة. نريد أن يربط التاجر حسابه لدى شركة التوصيل مرة واحدة، فتخرج الطلبات المقبولة تلقائيًا، وتبقى المشكوك فيها معلّقة حتى يقرر. ونتابع كل طرد حتى التسليم أو الإرجاع، وندير المخزون الموجود عند الشركات أو عند التاجر. نتيجة التسليم الفعلية تعود إلى تقييم المخاطر، فيتحسن من بيانات حقيقية.

لا توجد اتفاقيات مع شركات التوصيل بعد. لذلك نبني **الأساس فقط**: واجهة موحّدة لأي شركة (adapter)، وشركة تجريبية وهمية (`sandbox`) تحاكي السلوك الحقيقي، وكل الصفحات والإعدادات. ربط شركة حقيقية لاحقًا يعني إضافة ملف adapter واحد.

## 2. الأهداف

1. **الربط:** يربط التاجر حسابه لدى شركة توصيل بمفاتيح API خاصة به، لكل متجر ولكل بيئة (TEST/LIVE). المفاتيح مشفّرة ولا تُعرض مرة أخرى.
2. **الإرسال التلقائي:** الطلب المقبول (ALLOW) يُرسل تلقائيًا حسب إعدادات المتجر. طلبات REVIEW وREJECT، والطلبات التي نفد منتجها، **لا تُرسل أبدًا** قبل قرار التاجر.
3. **صفحة «بانتظار القرار»:** فيها ثلاثة أقسام: تحتاج مراجعة، نفد المخزون، مرفوضة. لكل طلب سبب واضح وأزرار القرار.
4. **صفحة «الشحنات»:** كل الطرود بحالاتها، والاستلام القادم، وتنبيه عند فشل الإرسال مع إعادة محاولة تلقائية.
5. **التتبع:** سجل أحداث كل طرد، يصل عبر webhook من الشركة أو عبر سؤال دوري. التسليم والإرجاع يسجّلان نتيجة الطلب (`OrderOutcome`) تلقائيًا.
6. **المخزون:** كل منتج له مكان: مستودع شركة واحد، أو عدة مستودعات، أو عند التاجر. نتابع المتوفر والمحجوز والقادم، والإيداعات، وسجل الحركة. التاجر يحدد في الإعدادات ما يحدث عند النفاد.
7. **إعدادات شحن غنية:** على مستوى المتجر فقط، دون أي إعداد يخص طلبًا بعينه.

## 3. ما ليس من الأهداف

- ربط أي شركة توصيل حقيقية.
- تسوية مبالغ الدفع عند الاستلام مع الشركات (remittance).
- توليد ملصقات PDF. نعرض رابط الملصق الذي توفره الشركة، والـ sandbox يعطي رابطًا تجريبيًا.
- الفوترة والخطط.
- **أي تغيير في ألوان الداشبورد أو تصميمه الحالي.**

## 4. ما يجب ألا يحدث مهما كان (anti-goals)

- **إرسال طلب REVIEW أو REJECT إلى الشحن دون قرار التاجر.** هذا أخطر فشل ممكن.
- إرسال الطلب نفسه مرتين إلى الشركة: لكل طلب شحنة نشطة واحدة، والإرسال idempotent.
- بيع قطعة واحدة مرتين: الحجز عند القبول اختياري لكنه مفعّل افتراضيًا.
- خلط بيانات TEST وLIVE: بيئة TEST تستعمل شركة الـ sandbox فقط.
- احتساب إرجاع سببه نفاد المخزون أو قرار Ordium كطلب سيئ. نتبع القاعدة الحالية في `app/core/outcomes.py`.
- أي اختلاف بصري عن الداشبورد الحالي.

## 5. القيود

- يبقى التصميم الحالي كما هو: رموز الألوان في `web/src/index.css`، وخطا Cairo وJetBrains Mono، والقائمة الجانبية الحالية، وأصناف `dashboard-panel` و`settings-*`، وأيقونات Lucide.
- كل نص يظهر للمستخدم موجود بالعربية والفرنسية والإنجليزية (`web/src/i18n/*.json`).
- الـ migrations إضافية فقط ولا تلمس بيانات قائمة، كما في `deploy/ec2/README.md`.
- نفس طريقة المصادقة الحالية: `require_api_scope`، مع scopes جديدة: `shipping:read`، `shipping:write`، `inventory:read`، `inventory:write`.
- أهداف اللمس 44px على الأقل، ودعم RTL كامل.

## 6. ما قرره صاحب المنتج

- يربط التاجر حسابه بنفسه، وتُرسل الطلبات المقبولة تلقائيًا.
- طلبات المراجعة والمرفوضة تبقى معلّقة في صفحة مستقلة.
- لي حرية ترتيب صفحات الداشبورد وعناصره لتسهيل الاستخدام، دون تغيير الألوان أو التصميم.
- الإعدادات غنية، لكن **ما يخص كل طلب** (التوصيل للمنزل أو للمكتب، السعر، رسوم التوصيل، الاستبدال) يأتي من الطلب نفسه ولا يُضبط في الإعدادات.
- المخزون قد يكون عند الشركة، أو موزعًا على عدة مستودعات أو عدة شركات، أو عند التاجر، ويُحدَّد ذلك لكل منتج.
- ما يحدث عند نفاد المخزون يقرره التاجر في الإعدادات، وله ثلاثة خيارات:
  - تعليق الطلب في «بانتظار القرار».
  - الانتظار ثم الإرسال تلقائيًا عند وصول المخزون.
  - الإرسال من مستودع آخر فيه المنتج.
- لا نربط شركات فعلية الآن، ونجهّز الكود الأساسي فقط.

## 7. التصميم

### 7.1 واجهة شركة التوصيل (adapter)

الحزمة `api/app/services/carriers/`:

- `base.py`: يحتوي على:
  - `CarrierAdapter` (Protocol)، ومعه `capabilities` تعلن ما تدعمه الشركة: الـ webhook، والمستودعات، ومكاتب التوقف، والإلغاء.
  - دوال: `validate_credentials()`، `list_warehouses()`، `list_stock()`، `create_shipment(ShipmentRequest) -> CarrierShipmentResult`، `cancel_shipment(tracking)`، `get_tracking(tracking) -> list[TrackingEvent]`، `parse_webhook(headers, body) -> list[TrackingEvent]` (تتحقق من التوقيع)، `label_url(tracking)`.
  - أنواع بيانات مستقلة عن أي شركة بعينها: `ShipmentRequest` (المستلم، الهاتف، الولاية، البلدية، العنوان، نوع التوصيل، رقم مكتب التوقف، مبلغ التحصيل، الأصناف، المستودع)، و`TrackingEvent` (الحالة الموحّدة، الحالة الخام، المكان، الوقت).
  - أخطاء موحّدة: `CarrierAuthError`، `CarrierValidationError` (لا تُعاد المحاولة بعده، ويحتاج إصلاحًا من التاجر)، `CarrierUnavailable` (تُعاد المحاولة بعده).
- `registry.py`: يربط كل رمز شركة بالـ adapter الخاص بها. الآن فيه `sandbox` فقط.
- `sandbox.py`: شركة وهمية حتمية (deterministic):
  - تقبل أي مفاتيح تبدأ بـ `test_`.
  - تعطي مستودعَين (وهران والجزائر) ومخزونًا.
  - تتقدم حالة الشحنة مع الوقت.
  - العناوين التي تحتوي `FAIL` ترفضها بخطأ validation، والتي تحتوي `RETURN` تنتهي بإرجاع.
  - تُستعمل في الاختبارات وفي بيئة TEST.

**الحالات الموحّدة للشحنة:** `pending_dispatch`، `dispatch_failed`، `accepted`، `picked_up`، `in_transit`، `out_for_delivery`، `delivery_attempt_failed`، `delivered`، `returning`، `returned`، `cancelled`. الانتقالات تسير للأمام فقط. أي حدث قديم أو مكرر يُسجَّل في السجل لكنه لا يعيد الحالة إلى الوراء.

### 7.2 البيانات (migration إضافية واحدة)

| الجدول | المحتوى |
|---|---|
| `carrier_accounts` | merchant، store، environment، `carrier_code`، display_name، `credentials_encrypted` (Fernet بنفس طريقة `webhook_service`)، status (active/error/disabled)، last_sync_at، last_error |
| `carrier_warehouses` | carrier_account، external_id، name، wilaya_code، commune، is_active |
| `products` | merchant، store، `sku` (فريد لكل متجر)، name، `fulfillment` (`carrier` \| `merchant`)، weight_grams (اختياري) |
| `product_carrier_links` | product، carrier_account، external_product_id |
| `stock_levels` | product، `warehouse_id` (فارغ تعني عند التاجر)، on_hand، reserved، inbound. القيود: الكميات ≥ 0 و reserved ≤ on_hand |
| `stock_deposits` | carrier_account، warehouse، reference، status (in_transit/counting/received)، lines (JSON: sku وكمية) |
| `stock_movements` | product، location، delta، reason (shipment، return، deposit، adjustment، sync)، shipment_id أو deposit_id، occurred_at. سجل لا يُعدَّل |
| `shipments` | order (شحنة **نشطة** واحدة لكل طلب بقيد partial unique)، carrier_account، warehouse (فارغ تعني من التاجر)، status، tracking_number، label_url، cod_amount، delivery_type، hold_reason (`review`، `rejected`، `out_of_stock`، `unmapped_product`، أو فارغ)، attempts، next_attempt_at، last_error، dispatched_at، delivered_at |
| `shipment_events` | shipment، status، raw_status، location، occurred_at، source (webhook/poll/manual)، dedupe_key فريد |
| `shipping_settings` | store (1:1). القيم الافتراضية بين قوسين: auto_dispatch (true)، dispatch_trigger (`after_confirmation` \| `on_allow`، الافتراضي after_confirmation)، hold_minutes (15)، retry_max (5)، retry_interval_minutes (10)، fallback_enabled (true)، out_of_stock_policy (`hold` \| `backorder` \| `other_warehouse`، الافتراضي hold)، low_stock_days (5)، reserve_on_accept (true)، disable_product_when_out (false)، عنوان الاستلام (الاسم، الولاية، البلدية، الهاتف)، label_size، ومفاتيح الإشعارات |
| `shipping_routes` | store، wilaya_codes (JSON)، carrier_account، fallback_carrier_account، priority. يوجد مسار افتراضي (wilaya_codes فارغة) |

**مدخلات الطلب:** نضيف إلى `OrderCreate` حقلين اختياريين:
- `delivery_type` (`home` \| `stop_desk`، والافتراضي home).
- `stop_desk_id`.

ونحدّث محوّلات Shopify وYouCan وWooCommerce وOmniterra لتملأ الحقلين إن وُجدت المعلومة في الطلب. أما مبلغ التحصيل فهو `total_amount` كما أرسله المتجر.

### 7.3 المسار

1. **بعد قرار المخاطر،** يُستدعى `ShippingService.on_decision(order)`:
   - إذا كان القرار REVIEW أو REJECT، تُنشأ شحنة `pending_dispatch` مع `hold_reason=review` أو `rejected`. لا يلتقطها العامل.
   - إذا كان ALLOW والإعداد `on_allow`، يُحدَّد `next_attempt_at = الآن + hold_minutes`.
   - إذا كان الإعداد `after_confirmation`، تُنشأ الشحنة معلّقة حتى يُستدعى `on_confirmed(order)` من `apply_confirmation`.
2. **قرار التاجر** من «بانتظار القرار»: «قبول وإرسال» يزيل hold_reason ويحدد next_attempt_at بالوقت الحالي. «رفض» يلغي الشحنة ويضع حالة الطلب cancelled بسبب `risk_decision`. «لم يرد» يستعمل محاولات التأكيد الحالية.
3. **العامل** `scripts/dispatch_shipments.py` يُضاف إلى حلقة `webhook-worker` في `compose.ec2.yaml`. يلتقط الشحنات المستحقة بقفل `FOR UPDATE SKIP LOCKED`، ثم:
   - يختار الشركة من `shipping_routes` حسب ولاية الطلب.
   - يحدد المستودع:
     - منتجات `merchant`: تُرسل من التاجر.
     - منتجات `carrier`: من أول مستودع لدى الشركة المختارة فيه كل الأصناف (مستودع نفس الولاية أولًا).
     - إذا لم يوجد مستودع مناسب، يُطبَّق `out_of_stock_policy`.
     - منتج بلا SKU أو غير مربوط يصبح `hold_reason=unmapped_product`.
   - يستدعي `create_shipment` بمفتاح idempotency هو معرف الشحنة. النجاح يعطي الحالة `accepted` مع رقم التتبع. `CarrierUnavailable` يؤدي إلى إعادة المحاولة بتأخير متزايد حتى `retry_max`، ثم الشركة الاحتياطية إن كانت مفعّلة. `CarrierValidationError` يعطي `dispatch_failed` مع رسالة واضحة للتاجر.
   - يحجز المخزون في نفس المعاملة (transaction)، ويكتب حركة المخزون.
4. **التتبع** يصل بطريقتين:
   - webhook على `POST /api/v1/carriers/{carrier_code}/webhook/{account_id}`، يتحقق منه الـ adapter.
   - أو عامل `scripts/sync_shipments.py` يسأل عن الشحنات النشطة كل 30 دقيقة.

   كل حدث يُكتب في `shipment_events` بمفتاح يمنع التكرار، ثم تُحدَّث الحالة:
   - **`delivered`:** يُسجَّل `OrderOutcome(delivered, source=carrier)`، ويُستهلك المحجوز.
   - **`returned`:** يُسجَّل `OrderOutcome(returned, reason=customer_refused)`، ويُعاد المخزون إلى المستودع.

   ننقل منطق إنشاء النتيجة من `api/v1/order_outcomes.py` إلى خدمة مشتركة حتى يستعملها المسار اليدوي والآلي معًا. إذا كانت للطلب نتيجة مسجّلة يدويًا من قبل، لا نكتب فوقها.
5. **مزامنة المخزون:** `scripts/sync_inventory.py` يقرأ `list_stock()` كل ساعة ويكتب حركات من نوع `sync` بالفرق.
6. **حين يصل مخزون جديد** (إيداع مستلَم أو مزامنة) والإعداد `backorder`، تُفك تلقائيًا الشحنات المعلّقة بسبب `out_of_stock` على ذلك المنتج.

### 7.4 الـ API (تحت `/api/v1`)

- **`/shipping/carriers`:** القائمة، الإنشاء، الاختبار، التعطيل، الحذف. **`/shipping/carriers/{id}/warehouses`:** المستودعات.
- **`/shipping/settings`:** القراءة (GET) والتعديل (PUT). **`/shipping/routes`:** إنشاء وقراءة وتعديل وحذف.
- **`/shipping/shipments`:** القائمة مع فلاتر الحالة والمصدر والبحث، والعدّادات لكل حالة. **`/shipping/shipments/{id}`:** التفاصيل مع الأحداث. ومعها: `/retry`، `/cancel`، و`POST /shipping/shipments` للإرسال اليدوي.
- **`/shipping/next-pickups`:** ملخص «الاستلام القادم».
- **`/shipping/pending`:** القائمة حسب hold_reason مع أسباب المخاطر الحالية، و`/shipping/pending/{order_id}/{approve|reject|restore|archive|dispatch-from}`.
- **`/inventory/products`:** إنشاء وقراءة وتعديل، مع الربط بمنتجات الشركة. **`/inventory/products/unmapped`:** المنتجات غير المربوطة.
- **`/inventory/stock`**، **`/inventory/deposits`** (إنشاء وقراءة وتعديل الحالة)، **`/inventory/movements`**.

كل endpoint يحترم البيئة (TEST/LIVE) والمتجر بنفس طريقة endpoints الطلبات الحالية.

### 7.5 الواجهة

- **القائمة الجانبية** (`DashboardSidebar.tsx`)، بنفس الأسلوب الحالي، مع إضافة عناصر فقط:
  - مجموعة «الطلبات»: الطلبات، التأكيد، **بانتظار القرار**.
  - مجموعة جديدة «الشحن»: **الشحنات**، **المخزون**.
  - باقي المجموعات كما هي.
- **صفحات جديدة** تستعمل المكوّنات والأصناف الموجودة: `PendingView.tsx`، `ShipmentsView.tsx`، `InventoryView.tsx`، و`ShipmentDetailDrawer.tsx` (بنفس نمط `OrderDetailDrawer`).
- **الإعدادات** (`SettingsView.tsx`): مجموعة جديدة «الشحن» فيها:
  - شركات التوصيل.
  - الإرسال والتوجيه.
  - المخزون.
  - الاستلام من متجرك.
  - التتبع والإشعارات.

  كل قسم panel مستقل بنمط `ConfirmationSettingsPanel`.
- **حالات كل صفحة:** تحميل (skeleton)، فارغ يشرح الخطوة التالية مثل «اربط شركة توصيل»، وخطأ.
- **التخطيط والمحتوى** يتبعان النماذج المرئية، والألوان والمكوّنات من الداشبورد الحالي.

### 7.6 الاختبارات

- عقد الـ adapter: كل الدوال على الـ sandbox.
- العامل:
  - لا يُرسل أبدًا طلب REVIEW أو REJECT.
  - الإرسال idempotent.
  - إعادة المحاولة، ثم الشركة الاحتياطية.
  - التوجيه حسب الولاية.
- المخزون: الحجز، والسياسات الثلاث عند النفاد، وعدم النزول تحت الصفر، والمنتج غير المربوط.
- التتبع:
  - الأحداث المكررة.
  - ترتيب الحالات.
  - التسليم يسجّل النتيجة، والإرجاع يسجّلها ويعيد المخزون.
  - لا نكتب فوق نتيجة يدوية.
- العزل: بين البيئات، وبين المتاجر، وبين التجار.
- الصلاحيات: الـ scopes الجديدة.
- الواجهة: `npm run lint` و`npm run build`، ووجود كل المفاتيح في اللغات الثلاث.

## 8. قرارات إضافية

### قرارات صاحب المنتج (2026-11-04)

1. **طلب مقبول دون تأكيد:**
   - إذا كان التأكيد غير مفعّل للطلبات المقبولة (`whatsapp_confirmation_enabled` متوقف، أو ALLOW غير موجود في `decisions` ضمن إعدادات التأكيد)، يُعامل الطلب كأن الإعداد `on_allow`.
   - إذا كان التأكيد مفعّلًا ولم يرد الزبون خلال `confirmation_timeout_hours` (24 افتراضيًا، حقل جديد في `shipping_settings`)، يُعلَّق الطلب بسبب `hold_reason=no_answer`، ويظهر في «بانتظار القرار» تحت «تحتاج مراجعة» مع السبب «لم يرد».
   - إذا رد الزبون بـ cancelled، تُلغى الشحنة ولا تُرسل.
2. **بيئة LIVE:** شركة الـ `sandbox` متاحة في TEST فقط، والـ registry يرفض ربطها في LIVE. صفحات الشحن في LIVE تعرض حالة فارغة نصها «لا توجد شركات توصيل متاحة بعد».

### قرارات المنفّذ (يمكن لصاحب المنتج تعديلها)

3. **حجز المخزون** يتم لحظة إنشاء شحنة قابلة للإرسال، أي عند ALLOW أو عند قبول التاجر، لا عند الإرسال. هكذا لا يحدث بيع مزدوج أثناء المهلة أو انتظار التأكيد. نفاد المخزون يُفحص مرتين: عند الحجز، ثم عند الإرسال. الحجز يُلغى إذا أُلغيت الشحنة أو رُفض الطلب.
4. **الطلبات القديمة:** لا تُنشأ شحنات تلقائيًا إلا للطلبات التي يُتخذ قرارها **بعد** ربط أول شركة للمتجر. الطلبات الأقدم تُرسل يدويًا فقط.
5. **حالة الطلب:** تصبح `Order.status = shipped` عند `picked_up`. أما `delivered` و`returned` فتأتيان من خدمة النتائج المشتركة. نرسل حدث webhook جديدًا باسم `order.shipment.updated` لكل تغيير في حالة الشحنة. `apply_confirmation` يبقى كما هو: يرفض تأكيد طلب شُحن.
6. **مصدر المنتجات:**
   - منتجات الشركة تُنشأ تلقائيًا من `list_stock()` عند الربط والمزامنة، وتُربط بالـ SKU.
   - منتجات التاجر يضيفها بنفسه.
   - صنف الطلب يُطابَق بالـ `sku` (بعد trim وتجاهل حالة الأحرف). الصنف الذي ليس له SKU، أو له SKU غير معروف، يؤدي إلى `unmapped_product`.
   - `/inventory/products/unmapped` يجمع الـ SKUs وأسماء المنتجات من الطلبات المعلّقة حتى يربطها التاجر.
7. **أفعال «بانتظار القرار»:**
   - `reject`: يلغي الشحنة، ويضع حالة الطلب cancelled بسبب `risk_decision`، فلا يُحتسب طلبًا سيئًا.
   - `restore`: متاح فقط لطلب مرفوض لم يُلغَ بعد. يزيل التعليق، ويُسجَّل في الـ audit log.
   - `archive`: يُلغي الطلب بسبب `risk_decision` ويخفيه من القائمة.
   - `dispatch-from`: يغيّر **المستودع فقط** (لنفس الشركة أو الشركة الاحتياطية في المسار)، ولا يتجاوز قاعدة REVIEW/REJECT.
   - كل الأفعال تُسجَّل في الـ audit log.
8. **طلب دون متجر** (`store_id` فارغ): لا يُرسل تلقائيًا أبدًا. يُرسل يدويًا بعد اختيار المتجر.
9. **طلب يجمع منتجات من التاجر ومن مستودع شركة:** يُعلَّق بسبب `hold_reason=mixed_source`. التاجر يقرر: إما إرسال كل الطلب من عنده إن توفرت الكميات، أو إلغاؤه. لا نقسّم الطلب إلى شحنتين في هذه المرحلة.
10. **الإلغاء بعد الإرسال:**
    - إذا أُلغي الطلب والشحنة في حالة `accepted` أو `pending_dispatch`، نستدعي `cancel_shipment` إن كانت الشركة تدعمه، ونُلغي الحجز.
    - بعد `picked_up` لا نلغي تلقائيًا، بل ننبّه التاجر.
    - البضاعة المرتجعة تعود إلى المخزون عند حدث `returned` دائمًا، حتى لو كانت للطلب نتيجة يدوية سابقة لا نكتب فوقها.

## 9. ما يُترك لمن ينفّذ

أسماء الملفات الداخلية، وشكل الـ schemas، وتقسيم الـ API إلى routers، وتفاصيل التأخير المتزايد بين المحاولات، وطريقة جلب البيانات في الواجهة، كلها حسب أنماط المشروع الحالية.
