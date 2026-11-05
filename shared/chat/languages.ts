// The languages a founder can use with Parallax: their story, and the replies from each future self, the board and the
// moderator. The screens stay in English. Every figure still comes from the engine, so a reply in any language carries
// the same numbers.
export const LANGUAGES = {
  en: 'English',
  zu: 'isiZulu',
  xh: 'isiXhosa',
  af: 'Afrikaans',
  st: 'Sesotho',
  tn: 'Setswana',
} as const;
export type LanguageCode = keyof typeof LANGUAGES;
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as LanguageCode[];

/** The line a prompt gets when the founder chose a language other than English. Empty for English. */
export function replyInLine(code: LanguageCode | undefined): string {
  if (!code || code === 'en') return '';
  return `Write your reply in ${LANGUAGES[code]}, in plain everyday words a South African small-business owner uses. Keep every {{fig:...}} placeholder and every [A1]-style id exactly as written; do not translate them.`;
}
