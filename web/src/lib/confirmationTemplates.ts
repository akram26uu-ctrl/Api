/**
 * ORDIUM platform-managed WhatsApp confirmation templates.
 * WhatsApp is an Ordium-managed service — merchants pick a template, they do
 * not connect or configure their own WhatsApp accounts.
 * Supported variables: {{customer_name}} {{order_number}} {{amount}} {{store_name}}
 */

export type TemplateLanguage = 'ar' | 'fr' | 'bilingual';

export interface ConfirmationTemplate {
  id: string;
  languages: TemplateLanguage[];
  body: Record<TemplateLanguage, string>;
}

export const CONFIRMATION_TEMPLATES: ConfirmationTemplate[] = [
  {
    id: 'standard',
    languages: ['ar'],
    body: {
      ar: 'مرحباً {{customer_name}} 👋\n\nنود تأكيد طلبك رقم {{order_number}}.\nالمبلغ: {{amount}}\n\nهل ترغب في تأكيد الطلب؟\n{{store_name}}',
      fr: '',
      bilingual: ''
    }
  },
  {
    id: 'arabic_short',
    languages: ['ar'],
    body: {
      ar: 'السلام عليكم {{customer_name}}،\nنتواصل معكم من {{store_name}} لتأكيد طلبكم رقم {{order_number}} بقيمة {{amount}}.\nهل تؤكدون الطلب؟',
      fr: '',
      bilingual: ''
    }
  },
  {
    id: 'french',
    languages: ['fr'],
    body: {
      ar: '',
      fr: 'Bonjour {{customer_name}} 👋\n\nNous souhaitons confirmer votre commande n° {{order_number}}.\nMontant : {{amount}}\n\nSouhaitez-vous confirmer la commande ?\n{{store_name}}',
      bilingual: ''
    }
  },
  {
    id: 'bilingual',
    languages: ['ar', 'fr'],
    body: {
      ar: 'مرحباً {{customer_name}} 👋\nنود تأكيد طلبك رقم {{order_number}}.\nالمبلغ: {{amount}}\nهل ترغب في تأكيد الطلب؟',
      fr: 'Bonjour {{customer_name}} 👋\nNous souhaitons confirmer votre commande n° {{order_number}}.\nMontant : {{amount}}\nSouhaitez-vous confirmer la commande ?',
      bilingual: ''
    }
  }
];

export interface TemplateVariables {
  customer_name: string;
  order_number: string;
  amount: string;
  store_name: string;
}

export const renderTemplate = (template: ConfirmationTemplate, variables: TemplateVariables): string => {
  const bilingual = template.languages.length > 1;
  const parts = (bilingual ? template.languages : [template.languages[0]])
    .map(lang => template.body[lang])
    .filter(Boolean);
  return parts
    .join('\n\n— — —\n\n')
    .replace(/\{\{customer_name\}\}/g, variables.customer_name)
    .replace(/\{\{order_number\}\}/g, variables.order_number)
    .replace(/\{\{amount\}\}/g, variables.amount)
    .replace(/\{\{store_name\}\}/g, variables.store_name);
};

const DEFAULT_TEMPLATE_STORAGE_KEY = 'ordium:default-confirmation-template';

export const getDefaultTemplateId = (): string => {
  try {
    const saved = window.localStorage.getItem(DEFAULT_TEMPLATE_STORAGE_KEY);
    if (saved && CONFIRMATION_TEMPLATES.some(template => template.id === saved)) return saved;
  } catch { /* Storage may be restricted. */ }
  return 'standard';
};

export const setDefaultTemplateId = (id: string): void => {
  try { window.localStorage.setItem(DEFAULT_TEMPLATE_STORAGE_KEY, id); } catch { /* Storage may be restricted. */ }
};
