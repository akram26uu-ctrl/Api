/**
 * Isolates Latin runs (API, Webhooks, Shopify, VPN…) inside right-to-left prose so that a token
 * glued to an Arabic prefix ("وWebhooks") keeps its own direction instead of reordering the line.
 * In LTR languages the text is returned unchanged.
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

const LATIN_RUN = /([A-Za-z][A-Za-z0-9_./:+#&-]*(?:[ -][A-Za-z0-9][A-Za-z0-9_./:+#&-]*)*)/g;

export function bidiIsolate(text: string, isRTL: boolean): React.ReactNode {
  if (!isRTL || !/[A-Za-z]/.test(text)) return text;
  const parts = text.split(LATIN_RUN);
  return parts.map((part, index) => {
    if (index % 2 === 1) return <bdi key={index} dir="ltr">{part}</bdi>;
    // A conjunction glued to a Latin word ("وWebhooks") reads as one mangled token; separate it with a space.
    const text = index < parts.length - 1 && /(^|\s)و$/.test(part) ? `${part} ` : part;
    return <React.Fragment key={index}>{text}</React.Fragment>;
  });
}

export const Bidi: React.FC<{ children: string }> = ({ children }) => {
  const { isRTL } = useLanguage();
  return <>{bidiIsolate(children, isRTL)}</>;
};
