/**
 * Signup auth step. Email/password/username form per Figma SignupFormScreen; uses useSignupEmailPassword, useCreateOnboardingSession.
 * After signup with onboarding_welcome: create onboarding session and go to business-context (full flow); choose-path is shown after activation.
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Workflow,
  Target,
  Zap,
  Shield,
  Users,
  Repeat,
  FileCheck,
  ArrowLeft,
} from 'lucide-react';
import { useSignupOnboarding } from '../../components/Providers/SignupOnboardingContext';
import { useSignupEmailPassword } from '../../hooks/useSignup';
import { useCreateOnboardingSession } from '../../hooks/useOnboarding';
import { useAuth } from '../../components/Providers/AuthContext';
import { ApiClientError } from '../../lib/api-client';
import { useApiErrorMessage } from '../../hooks/useApiErrorMessage';

const WORK_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERSONAL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];

function validateEmail(email: string): boolean {
  if (!WORK_EMAIL_PATTERN.test(email)) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? !PERSONAL_DOMAINS.includes(domain) : false;
}

function validatePassword(password: string): boolean {
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

/** Username (slug): lowercase, alphanumeric + hyphen/underscore, min 3 chars, cannot start with hyphen. */
function validateUsername(username: string): boolean {
  if (username.length < 3) return false;
  if (username !== username.toLowerCase()) return false;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(username)) return false;
  return true;
}

/** Signup email/password form. Submits signup then creates onboarding session. @component */
export function SignupAuth() {
  const navigate = useNavigate();
  const { t } = useTranslation('signup');
  const getApiErrorMessage = useApiErrorMessage();
  const { signupSessionId, accountType, setOnboardingSession, clearSignup } = useSignupOnboarding();
  const { login } = useAuth();
  const { mutateAsync: signupEmailPassword, isPending: signupPending } = useSignupEmailPassword();
  const { mutateAsync: createOnboardingSession } = useCreateOnboardingSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false, username: false });
  const [localError, setLocalError] = useState<string | null>(null);
  const [validationCode, setValidationCode] = useState<string | null>(null);
  const [loadingMethod, setLoadingMethod] = useState<string | null>(null);

  const isPending = signupPending;

  const handleSocialOrSSO = (method: string) => {
    setLoadingMethod(method);
    setLocalError(null);
    const label = method === 'sso' ? 'SSO' : method.charAt(0).toUpperCase() + method.slice(1);
    setLocalError(`${label} sign-up is coming soon. Please use email and password below.`);
    setTimeout(() => setLoadingMethod(null), 400);
  };

  useEffect(() => {
    if (!signupSessionId || !accountType) {
      navigate('/signup/role', { replace: true });
    }
  }, [signupSessionId, accountType, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setValidationCode(null);

    if (!validateEmail(email)) {
      setValidationCode('INVALID_EMAIL');
      setTouched((t) => ({ ...t, email: true }));
      return;
    }
    if (!validatePassword(password)) {
      setValidationCode('WEAK_PASSWORD');
      setTouched((t) => ({ ...t, password: true }));
      return;
    }
    const slug = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!slug || slug.length < 3) {
      setValidationCode('INVALID_SLUG');
      setLocalError(t('auth.usernameRequired'));
      setTouched((t) => ({ ...t, username: true }));
      return;
    }
    if (!validateUsername(slug)) {
      setTouched((t) => ({ ...t, username: true }));
      return;
    }
    if (!signupSessionId || !accountType) return;

    try {
      const result = await signupEmailPassword({
        signupSessionId,
        accountType,
        email,
        password,
        slug,
      });

      if (result.validationState?.code) {
        setValidationCode(result.validationState.code);
        if (result.validationState.message) setLocalError(result.validationState.message);
        return;
      }

      if (result.token) {
        login(result.token);
      }

      if (result.nextStep === 'onboarding_welcome') {
        try {
          const session = await createOnboardingSession({
            userId: result.userId,
            accountType,
            authProvider: 'email_password',
            signupSessionId,
          });
          setOnboardingSession(session.id);
          navigate('/onboarding/business-context', { replace: true });
        } catch (sessionErr) {
          setLocalError(sessionErr instanceof Error ? sessionErr.message : t('auth.signUpFailed'));
        }
        return;
      }

      if (result.nextStep === 'workspace_home' && result.token) {
        clearSignup();
        navigate('/', { replace: true });
        return;
      }

      if (result.nextStep === 'join_existing_workspace') {
        clearSignup();
        navigate('/', { replace: true });
        return;
      }

      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError && err.error?.code) {
        setValidationCode(err.error.code);
        setLocalError(getApiErrorMessage(err.error));
      } else {
        setLocalError(err instanceof Error ? err.message : t('auth.signUpFailed'));
      }
    }
  };

  const slug = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const showEmailError = touched.email && (validationCode === 'INVALID_EMAIL' || !email || !validateEmail(email));
  const showPasswordError =
    touched.password && (validationCode === 'WEAK_PASSWORD' || !password || !validatePassword(password));
  const showUsernameError = touched.username && (slug.length === 0 || !validateUsername(slug));
  const globalError = validationCode && !['INVALID_EMAIL', 'WEAK_PASSWORD', 'INVALID_SLUG'].includes(validationCode);
  const isUsernameValid = slug.length >= 3 && validateUsername(slug);
  const errorMessage = (): string => {
    if (localError) return localError;
    switch (validationCode) {
      case 'INVALID_EMAIL':
        return t('auth.errors.invalidEmail');
      case 'WEAK_PASSWORD':
        return t('auth.errors.weakPassword');
      case 'INVALID_SLUG':
        return t('auth.usernameRequired');
      case 'SLUG_ALREADY_IN_USE':
        return t('auth.errors.slugAlreadyInUse', 'This username is already taken.');
      case 'ACCOUNT_ALREADY_EXISTS':
        return t('auth.errors.accountAlreadyExists');
      case 'SSO_DOMAIN_NOT_FOUND':
        return t('auth.errors.ssoDomainNotFound');
      case 'AUTH_FAILED':
        return t('auth.errors.authFailed');
      default:
        return t('auth.errors.generic');
    }
  };

  if (!signupSessionId || !accountType) return null;

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-8 py-6">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-6">
              <Link
                to="/signup/role"
                className="flex items-center gap-2 text-[13px] text-[#666] hover:text-[#0d0d0d] transition-colors"
                aria-label={t('backToRoleSelection')}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t('back')}</span>
              </Link>
              <div className="w-px h-6 bg-gray-200" aria-hidden />
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: 'linear-gradient(to bottom right, #5e6ad2, #4c5bc7)' }}
                >
                  <Workflow className="w-5 h-5 text-white" />
                </div>
                <span className="text-[17px] font-semibold text-gray-900">{t('appName')}</span>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-[#f0f0ff] rounded-md">
              <span className="text-xs font-medium text-[#5e6ad2]">
                {accountType === 'brand' ? t('brandTeam') : t('agency')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div
          className="flex-1 flex flex-col justify-between py-12 px-6 sm:px-8 lg:px-12 border-b lg:border-b-0 lg:border-r border-gray-200 min-h-[400px] bg-[#fafafa]"
        >
          <div className="max-w-[560px]">
            {accountType === 'brand' && (
              <>
                <h1 className="text-2xl sm:text-[32px] font-semibold text-gray-900 mb-3 leading-tight">
                  {t('brandHeadline')}
                </h1>
                <p className="text-[15px] text-gray-600 leading-relaxed mb-8">
                  {t('brandSubline')}
                </p>
                {[
                  { titleKey: 'brandBullet1Title', descKey: 'brandBullet1Desc', Icon: Target },
                  { titleKey: 'brandBullet2Title', descKey: 'brandBullet2Desc', Icon: Zap },
                  { titleKey: 'brandBullet3Title', descKey: 'brandBullet3Desc', Icon: Shield },
                ].map(({ titleKey, descKey, Icon }) => (
                  <div
                    key={titleKey}
                    className="bg-white border border-gray-200 rounded-lg p-4 mb-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-md bg-[#f0f0ff] flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-[#5e6ad2]" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 mb-1">{t(titleKey)}</div>
                        <div className="text-[13px] text-gray-600 leading-relaxed">{t(descKey)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {accountType === 'agency' && (
              <>
                <h1 className="text-2xl sm:text-[32px] font-semibold text-gray-900 mb-3 leading-tight">
                  {t('agencyHeadline')}
                </h1>
                <p className="text-[15px] text-gray-600 leading-relaxed mb-8">
                  {t('agencySubline')}
                </p>
                {[
                  { titleKey: 'agencyBullet1Title', descKey: 'agencyBullet1Desc', Icon: Repeat },
                  { titleKey: 'agencyBullet2Title', descKey: 'agencyBullet2Desc', Icon: Users },
                  { titleKey: 'agencyBullet3Title', descKey: 'agencyBullet3Desc', Icon: FileCheck },
                ].map(({ titleKey, descKey, Icon }) => (
                  <div
                    key={titleKey}
                    className="bg-white border border-gray-200 rounded-lg p-4 mb-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-md bg-[#f0f0ff] flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-[#5e6ad2]" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 mb-1">{t(titleKey)}</div>
                        <div className="text-[13px] text-gray-600 leading-relaxed">{t(descKey)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-[13px] text-gray-600 mt-6">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden />
            <span>{t('builtForTeams')}</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-6 sm:px-8 lg:px-12 py-12">
          <div className="w-full max-w-[400px] mx-auto">
            <h2 className="text-[20px] font-semibold text-[#0d0d0d] mb-2">{t('auth.createAccount')}</h2>
            <p className="text-[13px] text-[#666] mb-6">{t('auth.chooseMethod')}</p>

            {globalError && (
              <div className="mb-6 p-3 bg-[#fee2e2] border border-[#fecaca] rounded-md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#991b1b] flex-shrink-0 mt-0.5" aria-hidden />
                  <span className="text-[12px] text-[#991b1b] leading-relaxed">{errorMessage()}</span>
                </div>
              </div>
            )}

            {/* Social / SSO buttons */}
            <div className="space-y-2 mb-6">
              <button
                type="button"
                onClick={() => handleSocialOrSSO('google')}
                disabled={isPending}
                className="w-full h-9 px-4 bg-white border border-[#e5e5e5] rounded-md text-[13px] font-medium text-[#0d0d0d] hover:bg-[#fafafa] hover:border-[#0d0d0d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loadingMethod === 'google' ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span>{t('auth.continueWithGoogle')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSocialOrSSO('microsoft')}
                disabled={isPending}
                className="w-full h-9 px-4 bg-white border border-[#e5e5e5] rounded-md text-[13px] font-medium text-[#0d0d0d] hover:bg-[#fafafa] hover:border-[#0d0d0d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loadingMethod === 'microsoft' ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 23 23" aria-hidden>
                    <path fill="#f35325" d="M0 0h11v11H0z" />
                    <path fill="#81bc06" d="M12 0h11v11H12z" />
                    <path fill="#05a6f0" d="M0 12h11v11H0z" />
                    <path fill="#ffba08" d="M12 12h11v11H12z" />
                  </svg>
                )}
                <span>{t('auth.continueWithMicrosoft')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSocialOrSSO('sso')}
                disabled={isPending}
                className="w-full h-9 px-4 bg-white border border-[#e5e5e5] rounded-md text-[13px] font-medium text-[#0d0d0d] hover:bg-[#fafafa] hover:border-[#0d0d0d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loadingMethod === 'sso' ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  <Users className="w-4 h-4" aria-hidden />
                )}
                <span>{t('auth.continueWithSSO')}</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e5e5e5]" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-white text-[11px] text-[#999] uppercase tracking-wide">{t('auth.orSignUpWithEmail')}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="signup-email" className="block text-[13px] font-medium text-[#0d0d0d] mb-1.5">
                  {t('auth.workEmail')}
                </label>
                <div className="relative">
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                    placeholder={t('auth.workEmailPlaceholder')}
                    disabled={isPending}
                    className={`w-full h-9 px-3 pr-9 bg-white border rounded-md text-[13px] placeholder:text-[#999] focus:outline-none transition-colors disabled:bg-[#fafafa] disabled:cursor-not-allowed ${
                      showEmailError
                        ? 'border-[#dc2626] focus:border-[#dc2626]'
                        : email && validateEmail(email)
                        ? 'border-[#10b981] focus:border-[#10b981]'
                        : 'border-[#e5e5e5] focus:border-[#0d0d0d]'
                    }`}
                    autoComplete="email"
                    aria-invalid={showEmailError}
                  />
                  {email && validateEmail(email) && !showEmailError && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#10b981]" aria-hidden />
                  )}
                  {showEmailError && (
                    <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#dc2626]" aria-hidden />
                  )}
                </div>
                {showEmailError ? (
                  <p id="email-error" className="mt-1.5 text-[11px] text-[#dc2626]">{t('auth.workEmailError')}</p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-[#666]">{t('auth.workEmailHint')}</p>
                )}
              </div>
              <div>
                <label htmlFor="signup-password" className="block text-[13px] font-medium text-[#0d0d0d] mb-1.5">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    placeholder={t('auth.passwordPlaceholder')}
                    disabled={isPending}
                    className={`w-full h-9 px-3 pr-9 bg-white border rounded-md text-[13px] placeholder:text-[#999] focus:outline-none transition-colors disabled:bg-[#fafafa] disabled:cursor-not-allowed ${
                      showPasswordError
                        ? 'border-[#dc2626] focus:border-[#dc2626]'
                        : password && validatePassword(password)
                        ? 'border-[#10b981] focus:border-[#10b981]'
                        : 'border-[#e5e5e5] focus:border-[#0d0d0d]'
                    }`}
                    autoComplete="new-password"
                    aria-invalid={showPasswordError}
                  />
                  {password && validatePassword(password) && !showPasswordError && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#10b981]" aria-hidden />
                  )}
                  {showPasswordError && (
                    <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#dc2626]" aria-hidden />
                  )}
                </div>
                {showPasswordError ? (
                  <p id="password-error" className="mt-1.5 text-[11px] text-[#dc2626]">{t('auth.passwordError')}</p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-[#666]">{t('auth.passwordHint')}</p>
                )}
              </div>
              <div>
                <label htmlFor="signup-username" className="block text-[13px] font-medium text-[#0d0d0d] mb-1.5">
                  {t('auth.username')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="signup-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                    placeholder={t('auth.usernamePlaceholder')}
                    disabled={isPending}
                    className={`w-full h-9 px-3 pr-9 bg-white border rounded-md text-[13px] placeholder:text-[#999] focus:outline-none transition-colors disabled:bg-[#fafafa] disabled:cursor-not-allowed ${
                      showUsernameError
                        ? 'border-[#dc2626] focus:border-[#dc2626]'
                        : isUsernameValid
                        ? 'border-[#10b981] focus:border-[#10b981]'
                        : 'border-[#e5e5e5] focus:border-[#0d0d0d]'
                    }`}
                    autoComplete="username"
                    aria-invalid={showUsernameError}
                  />
                  {isUsernameValid && !showUsernameError && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#10b981]" aria-hidden />
                  )}
                  {showUsernameError && (
                    <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#dc2626]" aria-hidden />
                  )}
                </div>
                {isUsernameValid ? (
                  <p className="mt-1.5 text-[11px] text-[#10b981]">{t('auth.usernameHintAvailable')}</p>
                ) : showUsernameError ? (
                  <p id="username-error" className="mt-1.5 text-[11px] text-[#dc2626]">
                    {slug.length === 0
                      ? t('auth.usernameRequired')
                      : slug.length < 3
                      ? t('auth.usernameErrorMin')
                      : !/^[a-z0-9-]+$/.test(slug)
                      ? t('auth.usernameErrorFormat')
                      : t('auth.usernameErrorHyphen')}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-[#666]">{t('auth.usernameHint')}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={isPending || !email || !password || !validateEmail(email) || !validatePassword(password) || !slug || slug.length < 3 || !validateUsername(slug)}
                className="w-full h-9 px-4 bg-[#0d0d0d] text-white rounded-md text-[13px] font-medium hover:bg-[#262626] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                    <span>{t('auth.creatingAccount')}</span>
                  </>
                ) : (
                  <span>{t('auth.createAccountButton')}</span>
                )}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-[#e5e5e5]">
              <p className="text-[12px] text-[#666] leading-relaxed mb-3">
                {t('auth.afterSignupNote')}
              </p>
              <p className="text-[11px] text-[#999] leading-relaxed">
                {t('auth.productionGated')}
              </p>
            </div>

            <p className="mt-6 text-center">
              <span className="text-[13px] text-[#666]">{t('auth.alreadyHaveAccount')} </span>
              <Link to="/signin" className="text-[13px] text-[#5e6ad2] hover:underline font-medium">
                {t('auth.signIn')}
              </Link>
            </p>

            <p className="mt-6 text-[11px] text-[#999] leading-relaxed text-center">
              {t('auth.termsNote')}{' '}
              <a href="/terms" className="text-[#666] hover:text-[#0d0d0d] underline">{t('auth.termsLink')}</a> and{' '}
              <a href="/privacy" className="text-[#666] hover:text-[#0d0d0d] underline">{t('auth.privacyLink')}</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
