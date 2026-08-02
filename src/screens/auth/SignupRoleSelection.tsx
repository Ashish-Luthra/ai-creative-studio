import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Workflow, Building2, Users } from 'lucide-react';
import { useSignupRoleSelection } from '../../hooks/useSignup';
import { useSignupOnboarding } from '../../components/Providers/SignupOnboardingContext';
import type { AccountType } from '../../types/signup-onboarding';
import { Alert, cn } from '@martechos/ui';

export function SignupRoleSelection() {
  const navigate = useNavigate();
  const { t } = useTranslation('signup');
  const { setSignupSession } = useSignupOnboarding();
  const { mutateAsync: submitRole, isPending, error } = useSignupRoleSelection();

  const handleRoleSelect = async (role: AccountType) => {
    try {
      const res = await submitRole({ accountType: role });
      setSignupSession(res.signupSessionId, res.accountType);
      navigate('/signup/auth');
    } catch (e) {
      // Error surfaced via error state
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 bg-[#fafafa]">
      <div className="w-full max-w-[800px]">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(to bottom right, #5e6ad2, #4c5bc7)' }}
            >
              <Workflow className="w-7 h-7 text-white" />
            </div>
            <div className="text-[22px] font-semibold text-gray-900">{t('appName')}</div>
          </div>
          <h1 className="text-[36px] font-semibold text-gray-900 mb-4 leading-tight">
            {t('welcomeTitle')}
          </h1>
          <p className="text-base text-gray-600 leading-relaxed max-w-[600px] mx-auto">
            {t('welcomeSubtitle')}
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <Alert variant="destructive">
              {error instanceof Error ? error.message : t('roleSelectionFailed')}
            </Alert>
          </div>
        )}

        <div className="mb-12">
          <div className="text-sm font-medium text-gray-900 mb-4 text-center">{t('whoAreYou')}</div>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleRoleSelect('brand')}
              disabled={isPending}
              className={cn(
                'group relative bg-white border-2 rounded-xl p-8 text-left transition-all',
                'border-gray-200 hover:border-[#5e6ad2] hover:bg-[#fafbff]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label={t('selectBrand')}
            >
              <div className="mb-6">
                <div className="w-14 h-14 rounded-lg bg-[#f0f0ff] flex items-center justify-center mb-4 group-hover:bg-[#e5e6ff] transition-colors">
                  <Building2 className="w-7 h-7 text-[#5e6ad2]" />
                </div>
                <div className="text-xl font-semibold text-gray-900 mb-2">{t('brandLabel')}</div>
                <div className="text-sm text-gray-600 leading-relaxed mb-6">
                  {t('brandDescription')}
                </div>
              </div>
              <ul className="space-y-2 list-none">
                {[t('brandBullets.centralized'), t('brandBullets.workflows'), t('brandBullets.collaboration')].map(
                  (item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#5e6ad2] flex-shrink-0 mt-0.5" aria-hidden />
                      <span className="text-[13px] text-gray-600">{item}</span>
                    </li>
                  )
                )}
              </ul>
              <div
                className="absolute top-8 right-8 w-6 h-6 rounded-full border-2 border-gray-200 group-hover:border-[#5e6ad2] transition-colors"
                aria-hidden
              />
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('agency')}
              disabled={isPending}
              className={cn(
                'group relative bg-white border-2 rounded-xl p-8 text-left transition-all',
                'border-gray-200 hover:border-[#5e6ad2] hover:bg-[#fafbff]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label={t('selectAgency')}
            >
              <div className="mb-6">
                <div className="w-14 h-14 rounded-lg bg-[#f0f0ff] flex items-center justify-center mb-4 group-hover:bg-[#e5e6ff] transition-colors">
                  <Users className="w-7 h-7 text-[#5e6ad2]" />
                </div>
                <div className="text-xl font-semibold text-gray-900 mb-2">{t('agencyLabel')}</div>
                <div className="text-sm text-gray-600 leading-relaxed mb-6">
                  {t('agencyDescription')}
                </div>
              </div>
              <ul className="space-y-2 list-none">
                {[t('agencyBullets.multiClient'), t('agencyBullets.delivery'), t('agencyBullets.tools')].map(
                  (item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#5e6ad2] flex-shrink-0 mt-0.5" aria-hidden />
                      <span className="text-[13px] text-gray-600">{item}</span>
                    </li>
                  )
                )}
              </ul>
              <div
                className="absolute top-8 right-8 w-6 h-6 rounded-full border-2 border-gray-200 group-hover:border-[#5e6ad2] transition-colors"
                aria-hidden
              />
            </button>
          </div>
        </div>

        <p className="text-center text-[13px] text-gray-500">{t('customizeAfterSignup')}</p>
      </div>
    </div>
  );
}
