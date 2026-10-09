// Keep provider codes unchanged; only display labels are formatted for users.
// Common/Pro lists follow the bundled voice catalog. Clone follows the public
// do-tts-clone language enum, checked on 2026-10-08.
export const languageNames = {
  en:'English', 'zh-CN':'Chinese — Simplified', es:'Spanish', fr:'French',
  de:'German', it:'Italian', pt:'Portuguese', pl:'Polish', tr:'Turkish',
  ru:'Russian', nl:'Dutch', cs:'Czech', ar:'Arabic', hu:'Hungarian',
  ko:'Korean', ja:'Japanese', vi:'Vietnamese', hi:'Hindi',
  id:'Indonesian', th:'Thai'
};
export const ttsLanguages = {
  'tts-common':['en','zh-CN','ar','pt','es'],
  'tts-pro':['en','zh-CN','hi','id','pt','es','th'],
  'tts-clone':['en','zh-CN','es','fr','de','it','pt','pl','tr','ru','nl','cs','ar','hu','ko','ja','vi']
};
export const languageLabel = code => `${languageNames[code] || code} (${code})`;
