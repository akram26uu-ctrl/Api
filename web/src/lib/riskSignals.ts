/**
 * Human labels for the risk engine's event types (app/models/enums.py → RiskEventType).
 * The dashboard showed raw codes such as `phone_reused`; merchants read these instead.
 */
import type { Language } from '../i18n/LanguageContext';

type Labels = Record<'ar' | 'fr' | 'en', string>;

const SIGNALS: Record<string, Labels> = {
  vpn_detected: { ar: 'اتصال عبر VPN', fr: 'Connexion via VPN', en: 'VPN connection' },
  proxy_detected: { ar: 'اتصال عبر Proxy', fr: 'Connexion via proxy', en: 'Proxy connection' },
  tor_detected: { ar: 'اتصال عبر شبكة Tor', fr: 'Connexion via Tor', en: 'Tor connection' },
  bot_activity: { ar: 'نشاط آلي', fr: 'Activité automatisée', en: 'Automated activity' },
  high_ip_reputation: { ar: 'عنوان IP بسمعة سيئة', fr: 'Adresse IP à mauvaise réputation', en: 'Poor IP reputation' },
  high_cancel_rate: { ar: 'سجل إلغاء أو إرجاع مرتفع', fr: 'Taux d’annulation ou de retour élevé', en: 'High cancel or return rate' },
  phone_reused: { ar: 'هاتف متكرر في طلبات كثيرة', fr: 'Téléphone utilisé dans de nombreuses commandes', en: 'Phone used in many orders' },
  device_reused: { ar: 'جهاز متكرر في طلبات كثيرة', fr: 'Appareil utilisé dans de nombreuses commandes', en: 'Device used in many orders' },
  address_reused: { ar: 'عنوان متكرر في طلبات كثيرة', fr: 'Adresse utilisée dans de nombreuses commandes', en: 'Address used in many orders' },
  new_device: { ar: 'جهاز جديد لزبون معروف', fr: 'Nouvel appareil pour un client connu', en: 'New device for a known customer' },
  repeated_request: { ar: 'طلب مكرر', fr: 'Requête répétée', en: 'Repeated request' },
  multiple_customers_same_phone: { ar: 'عدة زبائن على هاتف واحد', fr: 'Plusieurs clients, un téléphone', en: 'Several customers, one phone' },
  multiple_phones_same_device: { ar: 'عدة هواتف على جهاز واحد', fr: 'Plusieurs téléphones, un appareil', en: 'Several phones, one device' },
  multiple_customers_same_ip: { ar: 'عدة زبائن من عنوان IP واحد', fr: 'Plusieurs clients, une adresse IP', en: 'Several customers, one IP' },
  multiple_customers_same_address: { ar: 'عدة زبائن على عنوان واحد', fr: 'Plusieurs clients, une adresse', en: 'Several customers, one address' },
  multiple_customers_same_device: { ar: 'عدة زبائن على جهاز واحد', fr: 'Plusieurs clients, un appareil', en: 'Several customers, one device' },
  high_ip_frequency: { ar: 'طلبات كثيرة من عنوان IP واحد', fr: 'Nombreuses commandes depuis une IP', en: 'Many orders from one IP' },
  high_order_frequency: { ar: 'ارتفاع غير معتاد في عدد الطلبات', fr: 'Pic inhabituel de commandes', en: 'Unusual spike in orders' },
  duplicate_order_pattern: { ar: 'طلبية مكررة', fr: 'Commande en double', en: 'Duplicate order' },
  burst_network_activity: { ar: 'زبائن وهواتف كثيرة من شبكة واحدة', fr: 'Rafale depuis un même réseau', en: 'Burst from one network' },
  strong_identity_combination: { ar: 'اجتماع عدة إشارات هوية', fr: 'Combinaison de signaux d’identité', en: 'Combined identity signals' },
  high_customer_velocity: { ar: 'طلبات متتالية من نفس الزبون', fr: 'Commandes rapprochées du même client', en: 'Rapid orders from one customer' },
  high_phone_velocity: { ar: 'طلبات متتالية من نفس الهاتف', fr: 'Commandes rapprochées du même téléphone', en: 'Rapid orders from one phone' },
  high_device_velocity: { ar: 'طلبات متتالية من نفس الجهاز', fr: 'Commandes rapprochées du même appareil', en: 'Rapid orders from one device' },
  global_phone_reputation: { ar: 'هاتف بسجل سيئ لدى متاجر أخرى', fr: 'Téléphone signalé par d’autres boutiques', en: 'Phone flagged by other stores' },
  global_device_reputation: { ar: 'جهاز بسجل سيئ لدى متاجر أخرى', fr: 'Appareil signalé par d’autres boutiques', en: 'Device flagged by other stores' },
  global_ip_reputation: { ar: 'عنوان IP بسجل سيئ لدى متاجر أخرى', fr: 'IP signalée par d’autres boutiques', en: 'IP flagged by other stores' },
  identity_cluster_risk: { ar: 'هوية مرتبطة بشبكة كبيرة', fr: 'Identité liée à un large réseau', en: 'Identity linked to a large cluster' },
  unusual_order_quantity: { ar: 'كمية أكبر من المعتاد', fr: 'Quantité inhabituelle', en: 'Unusual quantity' },
  unusual_order_value: { ar: 'قيمة أكبر من المعتاد', fr: 'Montant inhabituel', en: 'Unusual order value' },
  trusted_customer_history: { ar: 'زبون موثوق: طلبات سابقة سُلّمت', fr: 'Client fiable : commandes déjà livrées', en: 'Trusted buyer: past orders delivered' },
};

export function riskSignalLabel(code: string, language: Language | string): string {
  const entry = SIGNALS[code];
  if (!entry) return code.replace(/_/g, ' ');
  return entry[(language as 'ar' | 'fr' | 'en')] ?? entry.en;
}
