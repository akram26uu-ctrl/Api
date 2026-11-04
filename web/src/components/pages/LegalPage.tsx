import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { LEGAL_DOCS, LEGAL_META, LegalDocId } from '../../content/legal';

interface LegalPageProps {
  doc: LegalDocId;
  onNavigate: (path: string) => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ doc, onNavigate }) => {
  const { language, t } = useLanguage();
  const content = LEGAL_DOCS[doc][language];
  const other: LegalDocId = doc === 'terms' ? 'privacy' : 'terms';
  const date = new Intl.DateTimeFormat(language === 'ar' ? 'ar-DZ' : language, { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(`${LEGAL_META.effectiveDate}T00:00:00Z`));

  return (
    <article className="py-16 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-start">
        <header className="mb-10 space-y-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{content.title}</h1>
          <p className="text-sm text-[#8A97AB]">{t('legal.effective', 'Effective date')}: <time dateTime={LEGAL_META.effectiveDate}>{date}</time></p>
          <p className="text-base text-[#C5CEDB] leading-relaxed">{content.intro}</p>
        </header>

        <div className="space-y-8">
          {content.sections.map(section => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-lg font-semibold text-white">{section.heading}</h2>
              {section.paragraphs?.map(p => <p key={p} className="text-[15px] text-[#A5B1C3] leading-relaxed">{p}</p>)}
              {section.items && (
                <ul className="list-disc ps-5 space-y-2 marker:text-[#52D9E8]">
                  {section.items.map(item => <li key={item} className="text-[15px] text-[#A5B1C3] leading-relaxed">{item}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        <footer className="mt-12 pt-6 border-t border-white/[0.07] flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <a href={`mailto:${LEGAL_META.contactEmail}`} className="min-h-11 inline-flex items-center text-[#52D9E8] hover:text-[#67E8F9]" dir="ltr">{LEGAL_META.contactEmail}</a>
          <button type="button" onClick={() => onNavigate(`/${other}`)} className="min-h-11 text-[#A5B1C3] hover:text-white">
            {other === 'privacy' ? t('auth.privacy_link', 'Privacy Policy') : t('auth.terms_link', 'Terms of Service')}
          </button>
        </footer>
      </div>
    </article>
  );
};
