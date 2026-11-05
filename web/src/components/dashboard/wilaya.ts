import { ALGERIAN_WILAYAS } from '../../lib/algeriaData';

/** The payload carries the wilaya as a code or a name; resolve it to "NN · name" when it is a known wilaya. */
export const resolveWilaya = (raw: string | null, lang: string): string | null => {
  if (!raw) return null;
  const v = raw.trim();
  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const found = /^\d{1,2}$/.test(v)
    ? ALGERIAN_WILAYAS.find(w => w.code === Number(v))
    : ALGERIAN_WILAYAS.find(w => [w.nameEn, w.nameFr, w.nameAr].some(n => norm(n) === norm(v)));
  if (!found) return v;
  const name = lang === 'ar' ? found.nameAr : lang === 'fr' ? found.nameFr : found.nameEn;
  return `${String(found.code).padStart(2, '0')} · ${name}`;
};
