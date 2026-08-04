/**
 * Magic-link callback landing page.
 *
 * The emailed login link points here: /auth/magic/callback?magicToken=<raw>
 * (param is magicToken, not token — AuthContext globally intercepts ?token= as a
 * direct-JWT OAuth callback and strips it from the URL).
 *
 * Verifies the single-use token via verifyMagicLinkOnce (POST
 * /v1/auth/magic-link/verify, shared one-shot promise so StrictMode remounts
 * cannot consume the token twice), stores the returned JWT via
 * AuthContext.login, and routes by nextStep (mirrors AuthCallback). No
 * automatic retry; failures direct the user back to /login for a fresh link.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../components/Providers/AuthContext';
import { verifyMagicLinkOnce } from '../../hooks/useMagicLink';
import { ApiClientError } from '../../lib/api-client';

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError && error.error.code === 'MAGIC_LINK_EXPIRED') {
    return 'This login link has expired. Request a new one from the sign-in page.';
  }
  return 'This login link is invalid or was already used. Request a new one from the sign-in page.';
}

export function MagicLinkCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<unknown>(null);

  const token = searchParams.get('magicToken');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyMagicLinkOnce(token)
      .then((result) => {
        if (cancelled) return;
        try {
          login(result.token);
        } catch (e) {
          console.error('MagicLinkCallback: token rejected', e);
          setError(e);
          return;
        }
        if (result.nextStep === 'onboarding_welcome') {
          navigate('/onboarding/business-context', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [token, login, navigate]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="w-full max-w-[420px] text-center">
        {!token ? (
          <>
            <div className="flex items-center justify-center gap-2 mb-3 text-[#dc2626]">
              <AlertCircle className="w-5 h-5" />
              <span className="text-[15px] font-medium">Missing token</span>
            </div>
            <p className="text-[13px] text-[#666] mb-6">
              This login link is missing its token. Copy the full link from the email.
            </p>
            <Link to="/login" className="text-[13px] font-medium text-[#5e6ad2] hover:text-[#4c5bc7]">
              Back to sign in
            </Link>
          </>
        ) : error ? (
          <>
            <div className="flex items-center justify-center gap-2 mb-3 text-[#dc2626]">
              <AlertCircle className="w-5 h-5" />
              <span className="text-[15px] font-medium">Sign-in not completed</span>
            </div>
            <p className="text-[13px] text-[#666] mb-6">{errorMessage(error)}</p>
            <Link to="/login" className="text-[13px] font-medium text-[#5e6ad2] hover:text-[#4c5bc7]">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-[#5e6ad2] mx-auto mb-3" aria-hidden />
            <p className="text-[13px] text-[#666]">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}
