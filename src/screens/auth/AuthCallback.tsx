/**
 * OAuth/SSO callback landing page.
 *
 * The backend redirects here after the provider round-trip:
 *   /auth/oauth/callback?session=<signupSessionId>&provider=google
 *   /auth/sso/callback?session=<signupSessionId>
 *
 * Resolves GET /v1/signup/result for the session, stores the token via
 * AuthContext.login, and routes by SignupResult.nextStep (mirrors SignupAuth).
 */
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../components/Providers/AuthContext';
import { useSignupOnboarding } from '../../components/Providers/SignupOnboardingContext';
import { useSignupResult } from '../../hooks/useSignup';
import type { SignupResult } from '../../types/signup-onboarding';

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { setSignupSession } = useSignupOnboarding();

  const sessionId = searchParams.get('session');
  const { data, isPending, isError, refetch } = useSignupResult(sessionId);

  useEffect(() => {
    if (!data) return;
    const result: SignupResult = data;

    if (result.token) {
      try {
        login(result.token);
      } catch (e) {
        console.error('AuthCallback: token rejected', e);
        return;
      }
    }
    if (sessionId) {
      setSignupSession(sessionId, result.accountType);
    }

    if (result.nextStep === 'onboarding_welcome') {
      navigate('/onboarding/business-context', { replace: true });
    } else {
      // workspace_home / join_existing_workspace → workspace root
      navigate('/', { replace: true });
    }
  }, [data, sessionId, login, setSignupSession, navigate]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="w-full max-w-[420px] text-center">
        {!sessionId ? (
          <>
            <div className="flex items-center justify-center gap-2 mb-3 text-[#dc2626]">
              <AlertCircle className="w-5 h-5" />
              <span className="text-[15px] font-medium">Missing session</span>
            </div>
            <p className="text-[13px] text-[#666] mb-6">
              This sign-in link is missing its session reference.
            </p>
            <Link to="/login" className="text-[13px] font-medium text-[#5e6ad2] hover:text-[#4c5bc7]">
              Back to sign in
            </Link>
          </>
        ) : isError ? (
          <>
            <div className="flex items-center justify-center gap-2 mb-3 text-[#dc2626]">
              <AlertCircle className="w-5 h-5" />
              <span className="text-[15px] font-medium">Sign-in not completed</span>
            </div>
            <p className="text-[13px] text-[#666] mb-6">
              We couldn't confirm your sign-in yet. The provider may still be processing.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => refetch()}
                className="text-[13px] font-medium text-[#5e6ad2] hover:text-[#4c5bc7]"
              >
                Retry
              </button>
              <Link to="/login" className="text-[13px] font-medium text-[#666] hover:text-[#0d0d0d]">
                Back to sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-[#5e6ad2] mx-auto mb-3" aria-hidden />
            <p className="text-[13px] text-[#666]">
              {isPending ? 'Completing sign-in…' : 'Redirecting…'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
