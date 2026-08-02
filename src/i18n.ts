/**
 * i18next configuration for the MartechOS web app.
 *
 * Initializes react-i18next with English locale and namespaces: common, onboarding,
 * admin, goals, signup, errors, workspace, studio. Resources are loaded from
 * locales/en/*.json. Used by useTranslation() in components.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from './locales/en/common.json';
import enOnboarding from './locales/en/onboarding.json';
import enAdmin from './locales/en/admin.json';
import enGoals from './locales/en/goals.json';
import enSignup from './locales/en/signup.json';
import enErrors from './locales/en/errors.json';
import enWorkspace from './locales/en/workspace.json';
import enStudio from './locales/en/studio.json';

/** Default namespace for useTranslation() when no namespace is passed. */
const defaultNs = 'common';

/** Default locale (language) for the app. */
export const defaultLocale = 'en';

i18n.use(initReactI18next).init({
  lng: defaultLocale,
  fallbackLng: defaultLocale,
  defaultNS: defaultNs,
  ns: ['common', 'onboarding', 'admin', 'goals', 'signup', 'errors', 'workspace', 'studio'],
  resources: {
    en: {
      common: enCommon as Record<string, unknown>,
      onboarding: enOnboarding as Record<string, unknown>,
      admin: enAdmin as Record<string, unknown>,
      goals: enGoals as Record<string, unknown>,
      signup: enSignup as Record<string, unknown>,
      errors: enErrors as Record<string, unknown>,
      workspace: enWorkspace as Record<string, unknown>,
      studio: enStudio as Record<string, unknown>,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

/** Configured i18n instance; use with useTranslation() or t() in components. */
export default i18n;
