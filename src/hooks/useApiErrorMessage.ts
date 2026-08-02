/**
 * Hook to resolve API errors to user-facing, localized messages.
 *
 * Uses the errors namespace (i18n) to translate messageKey or code; falls back to
 * error.message when no translation is found. Used by forms and toasts to show
 * consistent error text.
 */

import { useTranslation } from 'react-i18next';
import type { ApiError } from '../lib/api-client';

/**
 * Returns a function that maps an API error to a localized message.
 *
 * Resolution order: error.messageKey (as api.{messageKey}), then error.code (as api.{code),
 * then the raw error.message. Use the returned function in submit handlers or when
 * displaying API errors in the UI.
 *
 * @returns A function (error: ApiError) => string for use when displaying errors.
 */
export function useApiErrorMessage(): (error: ApiError) => string {
  const { t } = useTranslation('errors');
  return (error: ApiError) => {
    if (error.messageKey) {
      const msg = t(`api.${error.messageKey}`);
      if (msg !== `api.${error.messageKey}`) return msg;
    }
    const byCode = t(`api.${error.code}`);
    if (byCode !== `api.${error.code}`) return byCode;
    return error.message;
  };
}
