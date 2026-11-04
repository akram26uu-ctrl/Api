/**
 * Terms of Service and Privacy Policy content (ar / fr / en).
 *
 * Kept as structured data instead of i18n JSON because these are long legal
 * documents that must stay identical in meaning across languages.
 * Edit LEGAL_META when the operator, contact address or effective date change.
 */
import type { Language } from '../i18n/LanguageContext';

export const LEGAL_META = {
  operator: 'ORDIUM',
  contactEmail: 'support@ordium.dev',
  effectiveDate: '2026-11-04',
};

export type LegalDocId = 'terms' | 'privacy';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

const E = LEGAL_META.contactEmail;

const terms: Record<Language, LegalDoc> = {
  ar: {
    title: 'شروط الخدمة',
    intro: 'تحكم هذه الشروط استخدامك لخدمة ORDIUM (الموقع ولوحة التحكم وواجهة API). بإنشاء حساب أو استخدام الخدمة فإنك توافق عليها نيابةً عنك وعن المتجر الذي تمثله.',
    sections: [
      { heading: '1. الخدمة', paragraphs: [
        'تقيّم ORDIUM مخاطر الطلبات الواردة إلى متجرك (طلبات وهمية أو احتيالية) وتعطي لكل طلب قراراً مقترحاً: قبول أو مراجعة أو رفض، مع الإشارات التي أدت إليه. وتتيح تأكيد الطلب مع الزبون عبر واتساب أو الهاتف وتسجيل نتيجته.',
        'الخدمة حالياً في مرحلة تجريبية (Beta). قد تتغير الميزات أو تتوقف، وقد تحدث أعطال.',
      ] },
      { heading: '2. الحساب', items: [
        'يجب أن تقدم معلومات صحيحة وأن تكون مخوّلاً بتمثيل المتجر.',
        'أنت مسؤول عن سرية كلمة المرور ومفاتيح API وعن كل ما يتم عبر حسابك. أبلغنا فوراً عند الاشتباه في أي استخدام غير مصرح به.',
        'يمكن لحساب واحد إدارة عدة متاجر، وتبقى بيانات كل متجر وكل بيئة (TEST وLIVE) منفصلة.',
      ] },
      { heading: '3. التزاماتك كتاجر', items: [
        'أن تكون بيانات الزبائن التي ترسلها إلينا قد جُمعت بشكل قانوني، وأن تُعلم زبائنك بأن طلباتهم تُفحص وقد يتم التواصل معهم لتأكيدها، وفق القانون رقم \u206618-07\u2069 المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي.',
        'ألا ترسل أرقام البطاقات البنكية أو رموز CVV أو أي بيانات دفع حساسة.',
        'أن ترسل عنوان IP الحقيقي للزبون عند توفره، لا عنوان خادم متجرك.',
        'ألا تستخدم رسائل التأكيد عبر واتساب لأي غرض غير تأكيد طلب حقيقي، كالإعلانات أو الرسائل غير المرغوب فيها.',
      ] },
      { heading: '4. القرارات توصيات', paragraphs: [
        'القرارات والدرجات التي تعطيها ORDIUM توصيات مبنية على الإشارات المتوفرة، ولا نضمن اكتشاف كل طلب احتيالي ولا خلوّ القرارات من الخطأ. يبقى القرار النهائي بشحن الطلب أو إلغائه لك، ويمكنك تعديل أوزان الإشارات وحدود المراجعة والرفض أو استخدام وضع المراقبة (Shadow).',
      ] },
      { heading: '5. الاستخدام المقبول', items: [
        'لا يجوز استخدام الخدمة لأي نشاط غير قانوني أو للتمييز ضد الزبائن بطريقة غير مشروعة.',
        'لا يجوز محاولة الوصول إلى بيانات تجار آخرين أو تعطيل الخدمة أو تجاوز حدود الاستخدام أو إجراء هندسة عكسية لها.',
        'لا يجوز إعادة بيع الخدمة أو نتائجها دون موافقة كتابية منا.',
      ] },
      { heading: '6. البيانات', paragraphs: [
        'تبقى بيانات متجرك ملكاً لك. نعالجها لتقديم الخدمة كما هو موضح في سياسة الخصوصية.',
        'لتحسين الحماية لجميع التجار، نستخدم مؤشرات مجمّعة عبر التجار (مثل نسبة الطلبات الملغاة أو المرتجعة المرتبطة برقم هاتف أو جهاز). لا يرى أي تاجر بيانات طلبات تاجر آخر، بل إشارة خطر فقط.',
      ] },
      { heading: '7. الأسعار', paragraphs: [
        'الخدمة مجانية خلال المرحلة التجريبية. إذا أطلقنا خططاً مدفوعة فسنبلغك قبل 30 يوماً على الأقل، ولن تُفرض عليك أي رسوم دون موافقتك.',
      ] },
      { heading: '8. توفر الخدمة', paragraphs: [
        'نسعى لإبقاء الخدمة متاحة، لكننا لا نقدم ضماناً لنسبة تشغيل محددة خلال المرحلة التجريبية. قد نوقف الخدمة مؤقتاً للصيانة أو لأسباب أمنية.',
      ] },
      { heading: '9. حدود المسؤولية', paragraphs: [
        'تُقدَّم الخدمة "كما هي". في الحدود التي يسمح بها القانون، لا نتحمل المسؤولية عن الخسائر غير المباشرة، أو عن خسائر ناتجة عن شحن طلب أو إلغائه بناءً على قرار الخدمة، أو عن انقطاع خدمات الأطراف الأخرى (مثل واتساب أو منصة متجرك).',
      ] },
      { heading: '10. الإيقاف وإنهاء الحساب', paragraphs: [
        'يمكنك التوقف عن استخدام الخدمة وطلب حذف حسابك في أي وقت عبر مراسلتنا. ويحق لنا تعليق أو إغلاق حساب يخالف هذه الشروط أو يعرّض الخدمة أو مستخدميها للخطر، مع إشعارك متى أمكن.',
      ] },
      { heading: '11. تعديل الشروط', paragraphs: [
        'قد نعدّل هذه الشروط. سننشر النسخة الجديدة هنا مع تاريخ سريانها، ونبلغك بالبريد الإلكتروني عند أي تغيير جوهري. استمرارك في استخدام الخدمة بعد ذلك يعني موافقتك.',
      ] },
      { heading: '12. القانون المطبق', paragraphs: [
        'تخضع هذه الشروط للقانون الجزائري، وتختص المحاكم الجزائرية بأي نزاع يتعلق بها، بعد محاولة الحل الودي.',
      ] },
      { heading: '13. التواصل', paragraphs: [`لأي سؤال حول هذه الشروط: ${E}`] },
    ],
  },
  fr: {
    title: "Conditions d'utilisation",
    intro: "Ces conditions régissent votre utilisation du service ORDIUM (site, tableau de bord et API). En créant un compte ou en utilisant le service, vous les acceptez en votre nom et au nom de la boutique que vous représentez.",
    sections: [
      { heading: '1. Le service', paragraphs: [
        "ORDIUM évalue le risque des commandes reçues par votre boutique (commandes fictives ou frauduleuses) et propose pour chaque commande une décision — accepter, vérifier ou rejeter — avec les signaux qui l'expliquent. Le service permet aussi de confirmer la commande avec le client par WhatsApp ou par téléphone et d'en enregistrer le résultat.",
        'Le service est actuellement en version bêta. Les fonctionnalités peuvent évoluer ou être interrompues, et des incidents peuvent survenir.',
      ] },
      { heading: '2. Le compte', items: [
        'Vous devez fournir des informations exactes et être habilité à représenter la boutique.',
        "Vous êtes responsable de la confidentialité de votre mot de passe et de vos clés API, ainsi que de toute activité effectuée depuis votre compte. Signalez-nous immédiatement tout usage non autorisé.",
        'Un compte peut gérer plusieurs boutiques ; les données de chaque boutique et de chaque environnement (TEST et LIVE) restent séparées.',
      ] },
      { heading: '3. Vos obligations en tant que commerçant', items: [
        "Les données clients que vous nous transmettez doivent avoir été collectées légalement, et vous devez informer vos clients que leurs commandes sont analysées et qu'ils peuvent être contactés pour confirmation, conformément à la loi n° 18-07 relative à la protection des personnes physiques dans le traitement des données à caractère personnel.",
        "Ne transmettez jamais de numéros de carte bancaire, de codes CVV ni d'autres données de paiement sensibles.",
        "Transmettez l'adresse IP réelle du client lorsqu'elle est disponible, et non celle du serveur de votre boutique.",
        "N'utilisez pas les messages de confirmation WhatsApp à d'autres fins que la confirmation d'une commande réelle (publicité, messages non sollicités, etc.).",
      ] },
      { heading: '4. Les décisions sont des recommandations', paragraphs: [
        "Les décisions et scores fournis par ORDIUM sont des recommandations fondées sur les signaux disponibles. Nous ne garantissons ni la détection de toute commande frauduleuse ni l'absence d'erreur. La décision finale d'expédier ou d'annuler une commande vous appartient ; vous pouvez ajuster le poids des signaux, les seuils de vérification et de rejet, ou utiliser le mode observation (Shadow).",
      ] },
      { heading: '5. Usage acceptable', items: [
        "Le service ne doit pas être utilisé pour une activité illégale ni pour discriminer des clients de manière illicite.",
        "Il est interdit de tenter d'accéder aux données d'autres commerçants, de perturber le service, de contourner ses limites ou d'en faire de l'ingénierie inverse.",
        'Il est interdit de revendre le service ou ses résultats sans notre accord écrit.',
      ] },
      { heading: '6. Les données', paragraphs: [
        'Les données de votre boutique vous appartiennent. Nous les traitons pour fournir le service, comme décrit dans la politique de confidentialité.',
        "Pour mieux protéger l'ensemble des commerçants, nous utilisons des indicateurs agrégés entre commerçants (par exemple le taux de commandes annulées ou retournées associé à un numéro de téléphone ou à un appareil). Aucun commerçant ne voit les commandes d'un autre ; seul un signal de risque est affiché.",
      ] },
      { heading: '7. Tarifs', paragraphs: [
        "Le service est gratuit pendant la bêta. Si nous lançons des offres payantes, nous vous en informerons au moins 30 jours à l'avance, et aucun frais ne vous sera facturé sans votre accord.",
      ] },
      { heading: '8. Disponibilité', paragraphs: [
        "Nous nous efforçons de maintenir le service disponible, sans garantie de taux de disponibilité pendant la bêta. Le service peut être interrompu temporairement pour maintenance ou pour des raisons de sécurité.",
      ] },
      { heading: '9. Limitation de responsabilité', paragraphs: [
        "Le service est fourni « en l'état ». Dans les limites permises par la loi, nous ne sommes pas responsables des dommages indirects, des pertes liées à l'expédition ou à l'annulation d'une commande sur la base d'une décision du service, ni des interruptions de services tiers (WhatsApp, plateforme de votre boutique, etc.).",
      ] },
      { heading: '10. Suspension et résiliation', paragraphs: [
        "Vous pouvez cesser d'utiliser le service et demander la suppression de votre compte à tout moment en nous écrivant. Nous pouvons suspendre ou fermer un compte qui enfreint ces conditions ou met en danger le service ou ses utilisateurs, en vous prévenant lorsque c'est possible.",
      ] },
      { heading: '11. Modification des conditions', paragraphs: [
        "Nous pouvons modifier ces conditions. La nouvelle version sera publiée ici avec sa date d'entrée en vigueur, et nous vous préviendrons par e-mail en cas de changement important. La poursuite de l'utilisation du service vaut acceptation.",
      ] },
      { heading: '12. Droit applicable', paragraphs: [
        "Ces conditions sont régies par le droit algérien. Après tentative de règlement amiable, tout litige relève des juridictions algériennes compétentes.",
      ] },
      { heading: '13. Contact', paragraphs: [`Pour toute question sur ces conditions : ${E}`] },
    ],
  },
  en: {
    title: 'Terms of Service',
    intro: 'These terms govern your use of the ORDIUM service (website, dashboard and API). By creating an account or using the service, you accept them on your own behalf and on behalf of the store you represent.',
    sections: [
      { heading: '1. The service', paragraphs: [
        'ORDIUM evaluates the risk of orders your store receives (fake or fraudulent orders) and proposes a decision for each one — allow, review or reject — together with the signals behind it. It also lets you confirm the order with the customer over WhatsApp or by phone and record the outcome.',
        'The service is currently in beta. Features may change or be discontinued, and incidents may occur.',
      ] },
      { heading: '2. Your account', items: [
        'You must provide accurate information and be authorized to act for the store.',
        'You are responsible for keeping your password and API keys confidential and for all activity under your account. Tell us immediately about any unauthorized use.',
        'One account can manage several stores; data for each store and each environment (TEST and LIVE) is kept separate.',
      ] },
      { heading: '3. Your obligations as a merchant', items: [
        'Customer data you send us must have been collected lawfully, and you must inform your customers that their orders are screened and that they may be contacted for confirmation, in line with Algerian Law No. 18-07 on the protection of individuals in the processing of personal data.',
        'Never send payment card numbers, CVV codes or other sensitive payment data.',
        "Send the customer's real IP address when available, not your store server's address.",
        'Do not use WhatsApp confirmation messages for anything other than confirming a real order, such as advertising or unsolicited messages.',
      ] },
      { heading: '4. Decisions are recommendations', paragraphs: [
        'Decisions and scores from ORDIUM are recommendations based on the available signals. We do not guarantee that every fraudulent order will be detected or that decisions are free of error. The final decision to ship or cancel an order is yours; you can adjust signal weights and review/reject thresholds, or use shadow mode.',
      ] },
      { heading: '5. Acceptable use', items: [
        'Do not use the service for any unlawful activity or to unlawfully discriminate against customers.',
        "Do not attempt to access other merchants' data, disrupt the service, bypass its limits or reverse-engineer it.",
        'Do not resell the service or its results without our written consent.',
      ] },
      { heading: '6. Data', paragraphs: [
        "Your store's data remains yours. We process it to provide the service, as described in the Privacy Policy.",
        "To better protect all merchants, we use indicators aggregated across merchants (for example, the share of cancelled or returned orders linked to a phone number or device). No merchant sees another merchant's orders, only a risk signal.",
      ] },
      { heading: '7. Pricing', paragraphs: [
        'The service is free during the beta. If we introduce paid plans, we will tell you at least 30 days in advance, and you will not be charged without your agreement.',
      ] },
      { heading: '8. Availability', paragraphs: [
        'We aim to keep the service available but do not guarantee a specific uptime during the beta. We may pause the service temporarily for maintenance or security reasons.',
      ] },
      { heading: '9. Limitation of liability', paragraphs: [
        'The service is provided "as is". To the extent permitted by law, we are not liable for indirect losses, for losses resulting from shipping or cancelling an order based on a decision of the service, or for outages of third-party services (such as WhatsApp or your store platform).',
      ] },
      { heading: '10. Suspension and termination', paragraphs: [
        'You can stop using the service and ask us to delete your account at any time by writing to us. We may suspend or close an account that breaches these terms or puts the service or its users at risk, notifying you where possible.',
      ] },
      { heading: '11. Changes to these terms', paragraphs: [
        'We may update these terms. The new version will be published here with its effective date, and we will email you about any material change. Continuing to use the service afterwards means you accept it.',
      ] },
      { heading: '12. Governing law', paragraphs: [
        'These terms are governed by Algerian law. After an attempt at amicable settlement, any dispute falls under the competent Algerian courts.',
      ] },
      { heading: '13. Contact', paragraphs: [`Questions about these terms: ${E}`] },
    ],
  },
};

const privacy: Record<Language, LegalDoc> = {
  ar: {
    title: 'سياسة الخصوصية',
    intro: 'توضح هذه السياسة البيانات التي تعالجها ORDIUM ولماذا وأين تُحفظ وحقوقك بشأنها، وفق القانون رقم \u206618-07\u2069 المؤرخ في 10 يونيو 2018 المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي.',
    sections: [
      { heading: '1. دورنا', items: [
        'بيانات حسابات التجار (أصحاب المتاجر وفرقهم): نحن المسؤول عن معالجتها.',
        'بيانات زبائن المتاجر التي يرسلها التاجر إلينا مع كل طلب: التاجر هو المسؤول عن المعالجة، ونحن نعالجها نيابةً عنه ولتقديم الخدمة له فقط، مع استثناء المؤشرات المجمّعة المذكورة في البند 3.',
      ] },
      { heading: '2. البيانات التي نعالجها', items: [
        'حساب التاجر: الاسم، البريد الإلكتروني، اسم المؤسسة، كلمة المرور (تُحفظ مشفّرة بدالة تجزئة ولا يمكن قراءتها)، جلسات الدخول وعنوان IP المستخدم لأغراض الأمان.',
        'بيانات الطلبات: اسم الزبون، رقم الهاتف، البريد الإلكتروني إن أُرسل، الولاية والبلدية والعنوان، المنتجات والكميات والمبلغ، عنوان IP للزبون ومعرّف الجهاز إن أرسلهما المتجر.',
        'نتائج الطلبات: مؤكَّد، ملغى، لم يرد، تم التسليم، مرتجع، مع السبب إن وُجد.',
        'رسائل التأكيد عبر واتساب: رقم هاتف الزبون، حالة الرسالة (أُرسلت، وصلت، قُرئت) وزر الرد الذي ضغطه.',
        'سجلات تقنية: معرّفات الطلبات، الأخطاء، وسجل التدقيق للعمليات داخل الحساب.',
      ] },
      { heading: '3. لماذا نعالجها', items: [
        'تقييم مخاطر كل طلب وشرح القرار للتاجر.',
        'إرسال رسالة تأكيد للزبون عبر واتساب عند تفعيلها من التاجر، وتسجيل رده.',
        'المؤشرات المجمّعة عبر التجار: نحسب إحصاءات مثل نسبة الطلبات الملغاة أو المرتجعة المرتبطة برقم هاتف أو جهاز أو عنوان عبر عدة متاجر، وتُستخدم فقط كإشارة خطر. لا يرى أي تاجر طلبات تاجر آخر ولا اسمه ولا بيانات زبائنه.',
        'حماية الحسابات والخدمة من الاختراق وسوء الاستخدام.',
        'إرسال رسائل الحساب الضرورية (تفعيل البريد، استعادة كلمة المرور، إشعارات مهمة).',
      ] },
      { heading: '4. ما لا نفعله', items: [
        'لا نبيع البيانات الشخصية ولا نستخدمها للإعلان.',
        'لا نستقبل أرقام البطاقات البنكية أو رموز CVV.',
        'لا نرسل للزبائن عبر واتساب سوى رسالة تأكيد الطلب.',
      ] },
      { heading: '5. مزودو الخدمة ومكان حفظ البيانات', paragraphs: ['نعتمد على مزودين يعالجون البيانات نيابةً عنا ولهذا الغرض فقط. قد يعني ذلك نقل البيانات خارج الجزائر:'], items: [
        'Amazon Web Services: استضافة الخوادم (أيرلندا، الاتحاد الأوروبي).',
        'Supabase: قواعد البيانات (أيرلندا، الاتحاد الأوروبي).',
        'IPQualityScore: فحص سمعة عنوان IP (اكتشاف VPN والبروكسي وTor). يُرسل إليه عنوان IP فقط.',
        'Meta (WhatsApp Business): إرسال رسائل التأكيد واستقبال الردود، عند التفعيل.',
        'مزود البريد الإلكتروني: إرسال رسائل الحساب.',
      ] },
      { heading: '6. مدة الحفظ', paragraphs: [
        'نحتفظ بالبيانات طوال مدة نشاط حساب التاجر. عند طلب حذف الحساب نحذف بياناته أو نجعلها مجهولة الهوية، باستثناء ما يلزمنا القانون بالاحتفاظ به. يمكن للتاجر طلب حذف طلبات أو زبائن محددين في أي وقت.',
      ] },
      { heading: '7. الأمان', paragraphs: [
        'جميع الاتصالات مشفّرة عبر HTTPS. مفاتيح API تُحفظ كقيم مجزّأة (SHA-256)، وكلمات المرور مجزّأة، وبيانات اعتماد الجلسات مشفّرة. بيانات كل تاجر وكل بيئة معزولة عن غيرها. لا يوجد نظام آمن بالكامل، وسنبلغ التجار المتأثرين عند وقوع أي حادث أمني يمس بياناتهم.',
      ] },
      { heading: '8. حقوقك', paragraphs: [
        'لك الحق في الاطلاع على بياناتك وتصحيحها وحذفها والاعتراض على معالجتها. إذا كنت زبوناً لأحد المتاجر فتواصل مع المتجر أولاً لأنه المسؤول عن بياناتك، ويمكنك أيضاً مراسلتنا وسنحيل طلبك إليه ونساعده في تنفيذه. نرد على الطلبات خلال 30 يوماً. ويحق لك تقديم شكوى إلى السلطة الوطنية لحماية المعطيات ذات الطابع الشخصي (ANPDP).',
      ] },
      { heading: '9. ملفات تعريف الارتباط', paragraphs: [
        'نستخدم ملف تعريف ارتباط ضرورياً واحداً لإبقائك مسجلاً في لوحة التحكم، ونحفظ اختيار اللغة في متصفحك. لا نستخدم ملفات تتبع أو إعلانات.',
      ] },
      { heading: '10. التعديلات', paragraphs: ['قد نحدّث هذه السياسة، وسننشر النسخة الجديدة هنا مع تاريخها، ونبلغ التجار بالبريد عند أي تغيير جوهري.'] },
      { heading: '11. التواصل', paragraphs: [`لأي طلب يتعلق بالخصوصية أو البيانات: ${E}`] },
    ],
  },
  fr: {
    title: 'Politique de confidentialité',
    intro: "Cette politique explique quelles données ORDIUM traite, pourquoi, où elles sont conservées et quels sont vos droits, conformément à la loi n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel.",
    sections: [
      { heading: '1. Notre rôle', items: [
        'Données des comptes commerçants (propriétaires de boutiques et leurs équipes) : nous sommes responsables du traitement.',
        "Données des clients des boutiques, transmises par le commerçant avec chaque commande : le commerçant est responsable du traitement ; nous les traitons pour son compte et uniquement pour lui fournir le service, à l'exception des indicateurs agrégés décrits au point 3.",
      ] },
      { heading: '2. Données traitées', items: [
        "Compte commerçant : nom, e-mail, nom de l'organisation, mot de passe (stocké sous forme hachée, illisible), sessions de connexion et adresse IP utilisée, à des fins de sécurité.",
        "Commandes : nom du client, téléphone, e-mail s'il est transmis, wilaya, commune et adresse, produits, quantités et montant, adresse IP du client et identifiant d'appareil si la boutique les transmet.",
        "Résultats des commandes : confirmée, annulée, sans réponse, livrée, retournée, avec le motif le cas échéant.",
        'Messages de confirmation WhatsApp : numéro du client, statut du message (envoyé, distribué, lu) et bouton de réponse choisi.',
        "Journaux techniques : identifiants de requête, erreurs et journal d'audit des actions dans le compte.",
      ] },
      { heading: '3. Finalités', items: [
        "Évaluer le risque de chaque commande et expliquer la décision au commerçant.",
        "Envoyer au client un message de confirmation WhatsApp lorsque le commerçant l'active, et enregistrer sa réponse.",
        "Indicateurs agrégés entre commerçants : nous calculons des statistiques telles que le taux de commandes annulées ou retournées associé à un téléphone, un appareil ou une adresse sur plusieurs boutiques, utilisées uniquement comme signal de risque. Aucun commerçant ne voit les commandes, le nom ou les clients d'un autre.",
        'Protéger les comptes et le service contre les intrusions et les abus.',
        "Envoyer les e-mails nécessaires au compte (vérification d'adresse, réinitialisation du mot de passe, avis importants).",
      ] },
      { heading: '4. Ce que nous ne faisons pas', items: [
        'Nous ne vendons pas de données personnelles et ne les utilisons pas à des fins publicitaires.',
        'Nous ne recevons pas de numéros de carte bancaire ni de codes CVV.',
        "Nous n'envoyons aux clients par WhatsApp que le message de confirmation de commande.",
      ] },
      { heading: '5. Sous-traitants et lieu de conservation', paragraphs: ["Nous faisons appel à des prestataires qui traitent les données pour notre compte et à cette seule fin, ce qui peut impliquer un transfert hors d'Algérie :"], items: [
        'Amazon Web Services : hébergement des serveurs (Irlande, Union européenne).',
        'Supabase : bases de données (Irlande, Union européenne).',
        "IPQualityScore : réputation des adresses IP (détection VPN, proxy, Tor). Seule l'adresse IP lui est transmise.",
        "Meta (WhatsApp Business) : envoi des messages de confirmation et réception des réponses, lorsqu'activé.",
        "Prestataire e-mail : envoi des e-mails liés au compte.",
      ] },
      { heading: '6. Durée de conservation', paragraphs: [
        "Les données sont conservées tant que le compte du commerçant est actif. Sur demande de suppression du compte, nous supprimons ou anonymisons ses données, sauf obligation légale de conservation. Le commerçant peut demander à tout moment la suppression de commandes ou de clients précis.",
      ] },
      { heading: '7. Sécurité', paragraphs: [
        "Toutes les communications sont chiffrées (HTTPS). Les clés API sont stockées sous forme hachée (SHA-256), les mots de passe sont hachés et les identifiants de session chiffrés. Les données de chaque commerçant et de chaque environnement sont isolées. Aucun système n'est parfaitement sûr ; nous informerons les commerçants concernés de tout incident de sécurité touchant leurs données.",
      ] },
      { heading: '8. Vos droits', paragraphs: [
        "Vous disposez d'un droit d'accès, de rectification, de suppression et d'opposition. Si vous êtes client d'une boutique, adressez-vous d'abord à la boutique, responsable de vos données ; vous pouvez aussi nous écrire et nous transmettrons votre demande en l'aidant à y répondre. Nous répondons sous 30 jours. Vous pouvez également saisir l'Autorité nationale de protection des données à caractère personnel (ANPDP).",
      ] },
      { heading: '9. Cookies', paragraphs: [
        'Nous utilisons un seul cookie nécessaire pour maintenir votre session dans le tableau de bord, et votre choix de langue est enregistré dans votre navigateur. Aucun cookie de suivi ou publicitaire.',
      ] },
      { heading: '10. Modifications', paragraphs: ['Nous pouvons mettre à jour cette politique ; la nouvelle version sera publiée ici avec sa date, et les commerçants seront prévenus par e-mail de tout changement important.'] },
      { heading: '11. Contact', paragraphs: [`Pour toute demande liée à la confidentialité ou aux données : ${E}`] },
    ],
  },
  en: {
    title: 'Privacy Policy',
    intro: 'This policy explains what data ORDIUM processes, why, where it is stored and your rights over it, in line with Algerian Law No. 18-07 of 10 June 2018 on the protection of individuals in the processing of personal data.',
    sections: [
      { heading: '1. Our role', items: [
        'Merchant account data (store owners and their teams): we are the controller.',
        'Store customer data that the merchant sends with each order: the merchant is the controller; we process it on their behalf and only to provide the service to them, except for the aggregated indicators described in section 3.',
      ] },
      { heading: '2. Data we process', items: [
        'Merchant account: name, email, organization name, password (stored as a one-way hash, never readable), sign-in sessions and the IP address used, for security.',
        'Orders: customer name, phone number, email if sent, wilaya, commune and address, products, quantities and amount, customer IP address and device identifier if the store sends them.',
        'Order outcomes: confirmed, cancelled, no answer, delivered, returned, with a reason where given.',
        "WhatsApp confirmation messages: the customer's phone number, message status (sent, delivered, read) and the reply button they pressed.",
        'Technical logs: request IDs, errors and an audit log of actions in the account.',
      ] },
      { heading: '3. Why we process it', items: [
        'To score the risk of each order and explain the decision to the merchant.',
        'To send the customer a WhatsApp confirmation message when the merchant turns it on, and record the reply.',
        "Cross-merchant aggregated indicators: we compute statistics such as the share of cancelled or returned orders linked to a phone number, device or address across several stores, used only as a risk signal. No merchant sees another merchant's orders, name or customers.",
        'To protect accounts and the service against intrusion and abuse.',
        'To send necessary account emails (email verification, password reset, important notices).',
      ] },
      { heading: "4. What we don't do", items: [
        'We do not sell personal data or use it for advertising.',
        'We do not accept payment card numbers or CVV codes.',
        'We send customers nothing over WhatsApp except the order confirmation message.',
      ] },
      { heading: '5. Service providers and storage location', paragraphs: ['We rely on providers that process data on our behalf and only for this purpose, which may involve transfers outside Algeria:'], items: [
        'Amazon Web Services: server hosting (Ireland, European Union).',
        'Supabase: databases (Ireland, European Union).',
        'IPQualityScore: IP reputation checks (VPN, proxy and Tor detection). Only the IP address is sent.',
        'Meta (WhatsApp Business): sending confirmation messages and receiving replies, when enabled.',
        'Email provider: sending account emails.',
      ] },
      { heading: '6. Retention', paragraphs: [
        "We keep data for as long as the merchant's account is active. When an account deletion is requested, we delete or anonymize its data, except where the law requires us to keep it. A merchant can ask us to delete specific orders or customers at any time.",
      ] },
      { heading: '7. Security', paragraphs: [
        "All traffic is encrypted over HTTPS. API keys are stored as SHA-256 hashes, passwords are hashed and session credentials are encrypted. Each merchant's and each environment's data is isolated. No system is perfectly secure; we will notify affected merchants of any security incident involving their data.",
      ] },
      { heading: '8. Your rights', paragraphs: [
        "You have the right to access, correct and delete your data and to object to its processing. If you are a store's customer, contact the store first, as it controls your data; you can also write to us and we will forward your request and help the store fulfil it. We respond within 30 days. You may also complain to Algeria's National Authority for the Protection of Personal Data (ANPDP).",
      ] },
      { heading: '9. Cookies', paragraphs: [
        'We use a single necessary cookie to keep you signed in to the dashboard, and your language choice is saved in your browser. No tracking or advertising cookies.',
      ] },
      { heading: '10. Changes', paragraphs: ['We may update this policy; the new version will be posted here with its date, and merchants will be emailed about any material change.'] },
      { heading: '11. Contact', paragraphs: [`For any privacy or data request: ${E}`] },
    ],
  },
};

export const LEGAL_DOCS: Record<LegalDocId, Record<Language, LegalDoc>> = { terms, privacy };
