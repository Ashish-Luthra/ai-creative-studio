/**
 * Registers global API client callbacks (e.g. 403 Forbidden) so the app shows
 * user-friendly messages in one place. Mount inside ToastProvider.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../lib/api-client';
import { useToast } from './Providers/ToastContext';

export function ApiClientGlobalHandlers() {
  const { t } = useTranslation('errors');
  const { showError } = useToast();
  const forbiddenTitle = t('api.FORBIDDEN');

  useEffect(() => {
    apiClient.setOnForbidden((err) => {
      const message = err.error?.message && err.error.message !== forbiddenTitle
        ? err.error.message
        : undefined;
      showError(forbiddenTitle, message, err.error?.correlationId);
    });
    return () => apiClient.setOnForbidden(null);
  }, [showError, forbiddenTitle]);

  return null;
}
