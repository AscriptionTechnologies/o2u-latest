import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from '../locales/en.json';
import te from '../locales/te.json';

// Get the detected locale
const detectedLocale = Localization.getLocales()[0]?.languageCode || 'en';

i18n
  .use(initReactI18next)
  .init({
    lng: detectedLocale, // Get the first locale's language code
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      te: { translation: te },
    },
    interpolation: { 
      escapeValue: false,
    },
  });

export default i18n; 