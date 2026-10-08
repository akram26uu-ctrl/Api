/**
 * Algerian Wilayas & E-Commerce Market Data for ORDIUM
 * Comprehensive list of all 58 Wilayas with Arabic, French, and English nomenclature.
 */

export interface Wilaya {
  code: number;
  nameEn: string;
  nameFr: string;
  nameAr: string;
}

export const ALGERIAN_WILAYAS: Wilaya[] = [
  { code: 1, nameEn: "Adrar", nameFr: "Adrar", nameAr: "أدرار" },
  { code: 2, nameEn: "Chlef", nameFr: "Chlef", nameAr: "الشلف" },
  { code: 3, nameEn: "Laghouat", nameFr: "Laghouat", nameAr: "الأغواط" },
  { code: 4, nameEn: "Oum El Bouaghi", nameFr: "Oum El Bouaghi", nameAr: "أم البواقي" },
  { code: 5, nameEn: "Batna", nameFr: "Batna", nameAr: "باتنة" },
  { code: 6, nameEn: "Béjaïa", nameFr: "Béjaïa", nameAr: "بجاية" },
  { code: 7, nameEn: "Biskra", nameFr: "Biskra", nameAr: "بسكرة" },
  { code: 8, nameEn: "Béchar", nameFr: "Béchar", nameAr: "بشار" },
  { code: 9, nameEn: "Blida", nameFr: "Blida", nameAr: "البليدة" },
  { code: 10, nameEn: "Bouira", nameFr: "Bouira", nameAr: "البويرة" },
  { code: 11, nameEn: "Tamanrasset", nameFr: "Tamanrasset", nameAr: "تمنراست" },
  { code: 12, nameEn: "Tébessa", nameFr: "Tébessa", nameAr: "تبسة" },
  { code: 13, nameEn: "Tlemcen", nameFr: "Tlemcen", nameAr: "تلمسان" },
  { code: 14, nameEn: "Tiaret", nameFr: "Tiaret", nameAr: "تيارت" },
  { code: 15, nameEn: "Tizi Ouzou", nameFr: "Tizi Ouzou", nameAr: "تيزي وزو" },
  { code: 16, nameEn: "Algiers", nameFr: "Alger", nameAr: "الجزائر العاصمة" },
  { code: 17, nameEn: "Djelfa", nameFr: "Djelfa", nameAr: "الجلفة" },
  { code: 18, nameEn: "Jijel", nameFr: "Jijel", nameAr: "جيجل" },
  { code: 19, nameEn: "Sétif", nameFr: "Sétif", nameAr: "سطيف" },
  { code: 20, nameEn: "Saïda", nameFr: "Saïda", nameAr: "سعيدة" },
  { code: 21, nameEn: "Skikda", nameFr: "Skikda", nameAr: "سكيكدة" },
  { code: 22, nameEn: "Sidi Bel Abbès", nameFr: "Sidi Bel Abbès", nameAr: "سيدي بلعباس" },
  { code: 23, nameEn: "Annaba", nameFr: "Annaba", nameAr: "عنابة" },
  { code: 24, nameEn: "Guelma", nameFr: "Guelma", nameAr: "قالمة" },
  { code: 25, nameEn: "Constantine", nameFr: "Constantine", nameAr: "قسنطينة" },
  { code: 26, nameEn: "Médéa", nameFr: "Médéa", nameAr: "المدية" },
  { code: 27, nameEn: "Mostaganem", nameFr: "Mostaganem", nameAr: "مستغانم" },
  { code: 28, nameEn: "M'Sila", nameFr: "M'Sila", nameAr: "المسيلة" },
  { code: 29, nameEn: "Mascara", nameFr: "Mascara", nameAr: "معسكر" },
  { code: 30, nameEn: "Ouargla", nameFr: "Ouargla", nameAr: "ورقلة" },
  { code: 31, nameEn: "Oran", nameFr: "Oran", nameAr: "وهران" },
  { code: 32, nameEn: "El Bayadh", nameFr: "El Bayadh", nameAr: "البيض" },
  { code: 33, nameEn: "Illizi", nameFr: "Illizi", nameAr: "إليزي" },
  { code: 34, nameEn: "Bordj Bou Arréridj", nameFr: "Bordj Bou Arréridj", nameAr: "برج بوعريريج" },
  { code: 35, nameEn: "Boumerdès", nameFr: "Boumerdès", nameAr: "بومرداس" },
  { code: 36, nameEn: "El Tarf", nameFr: "El Tarf", nameAr: "الطارف" },
  { code: 37, nameEn: "Tindouf", nameFr: "Tindouf", nameAr: "تندوف" },
  { code: 38, nameEn: "Tissemsilt", nameFr: "Tissemsilt", nameAr: "تيسمسيلت" },
  { code: 39, nameEn: "El Oued", nameFr: "El Oued", nameAr: "الوادي" },
  { code: 40, nameEn: "Khenchela", nameFr: "Khenchela", nameAr: "خنشلة" },
  { code: 41, nameEn: "Souk Ahras", nameFr: "Souk Ahras", nameAr: "سوق أهراس" },
  { code: 42, nameEn: "Tipaza", nameFr: "Tipaza", nameAr: "تيبازة" },
  { code: 43, nameEn: "Mila", nameFr: "Mila", nameAr: "ميلة" },
  { code: 44, nameEn: "Aïn Defla", nameFr: "Aïn Defla", nameAr: "عين الدفلى" },
  { code: 45, nameEn: "Naâma", nameFr: "Naâma", nameAr: "النعامة" },
  { code: 46, nameEn: "Aïn Témouchent", nameFr: "Aïn Témouchent", nameAr: "عين تموشنت" },
  { code: 47, nameEn: "Ghardaïa", nameFr: "Ghardaïa", nameAr: "غرداية" },
  { code: 48, nameEn: "Relizane", nameFr: "Relizane", nameAr: "غليزان" },
  { code: 49, nameEn: "Timimoun", nameFr: "Timimoun", nameAr: "تيميمون" },
  { code: 50, nameEn: "Bordj Badji Mokhtar", nameFr: "Bordj Badji Mokhtar", nameAr: "برج باجي مختار" },
  { code: 51, nameEn: "Ouled Djellal", nameFr: "Ouled Djellal", nameAr: "أولاد جلال" },
  { code: 52, nameEn: "Béni Abbès", nameFr: "Béni Abbès", nameAr: "بني عباس" },
  { code: 53, nameEn: "In Salah", nameFr: "In Salah", nameAr: "عين صالح" },
  { code: 54, nameEn: "In Guezzam", nameFr: "In Guezzam", nameAr: "عين قزام" },
  { code: 55, nameEn: "Touggourt", nameFr: "Touggourt", nameAr: "تقرت" },
  { code: 56, nameEn: "Djanet", nameFr: "Djanet", nameAr: "جانت" },
  { code: 57, nameEn: "El M'Ghair", nameFr: "El M'Ghair", nameAr: "المغير" },
  { code: 58, nameEn: "El Meniaa", nameFr: "El Meniaa", nameAr: "المنيعة" }
];

export const ECOMMERCE_PLATFORMS = [
  { id: 'shopify', label: 'Shopify' },
  { id: 'woocommerce', label: 'WooCommerce / WordPress' },
  { id: 'youcan', label: 'YouCan Shop' },
  { id: 'ecwid', label: 'Ecwid' },
  { id: 'magento', label: 'Adobe Commerce (Magento)' },
  { id: 'custom', label: 'Custom In-House API' },
  { id: 'other', label: 'Other / Social Commerce' }
];

export const MONTHLY_VOLUME_OPTIONS = [
  { id: 'under_100', labelEn: '< 100 orders / month', labelFr: '< 100 commandes / mois', labelAr: 'أقل من 100 طلب / شهرياً' },
  { id: '100_500', labelEn: '100 - 500 orders / month', labelFr: '100 - 500 commandes / mois', labelAr: '100 - 500 طلب / شهرياً' },
  { id: '500_2000', labelEn: '500 - 2,000 orders / month', labelFr: '500 - 2 000 commandes / mois', labelAr: '500 - 2,000 طلب / شهرياً' },
  { id: '2000_10000', labelEn: '2,000 - 10,000 orders / month', labelFr: '2 000 - 10 000 commandes / mois', labelAr: '2,000 - 10,000 طلب / شهرياً' },
  { id: 'over_10000', labelEn: '10,000+ orders / month', labelFr: '10 000+ commandes / mois', labelAr: 'أكثر من 10,000 طلب / شهرياً' }
];

export const BUSINESS_TYPES = [
  { id: 'direct_ecommerce', labelEn: 'Direct-to-Consumer (D2C)', labelFr: 'Boutique en ligne directe (D2C)', labelAr: 'متجر مباشر للمستهلك (D2C)' },
  { id: 'cod_retail', labelEn: 'Cash-on-Delivery Retailer', labelFr: 'Commerce de détail avec paiement à la livraison (COD)', labelAr: 'تجارة الدفع عند الاستلام (COD)' },
  { id: 'marketplace', labelEn: 'Multi-vendor Marketplace', labelFr: 'Place de marché multi-vendeurs', labelAr: 'منصة تجارة إلكترونية متعددة التجار' },
  { id: 'dropshipping', labelEn: 'Dropshipping & Cross-Border', labelFr: 'Dropshipping et commerce transfrontalier', labelAr: 'دروب شيبينغ وتجارة عابرة للحدود' },
  { id: 'b2b', labelEn: 'B2B Wholesale Commerce', labelFr: 'Commerce de gros B2B', labelAr: 'تجارة الجملة بين الشركات (B2B)' },
  { id: 'digital', labelEn: 'Digital Goods & SaaS', labelFr: 'Produits numériques et SaaS', labelAr: 'منتجات رقمية وبرمجيات' }
];
