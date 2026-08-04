import { useState } from 'react';
import { apiClient, ApiClientError } from '../../lib/api-client';
import { useRequestMagicLink } from '../../hooks/useMagicLink';
import type {
  AccountType,
  OAuthStartResponse,
  SignupRoleSelectionResponse,
} from '../../types/signup-onboarding';

interface LoginScreenProps {
  onSignUp?: () => void;
  /** Optional override; when omitted the built-in OAuth start flow runs. */
  onGoogleAuth?: () => void;
  onMicrosoftAuth?: () => void;
  /** Optional override; when omitted the built-in SSO start flow runs. */
  onSSOAuth?: () => void;
}

/** sessionStorage keys shared with SignupOnboardingContext. */
const SIGNUP_SESSION_KEY = 'martechos_signup_session_id';
const SIGNUP_ACCOUNT_TYPE_KEY = 'martechos_signup_account_type';
// Login intentionally has no brand/agency role step: the backend requires an
// accountType to open a signup session, so 'brand' is sent as a placeholder.
// The real value is captured by the post-login workspace setup popup.
const DEFAULT_ACCOUNT_TYPE: AccountType = 'brand';

/**
 * Returns the current signup session (from sessionStorage) or creates one via
 * POST /v1/signup/role-selection and persists it for the rest of the flow.
 */
async function ensureSignupSession(): Promise<{ signupSessionId: string; accountType: AccountType }> {
  const existingId = sessionStorage.getItem(SIGNUP_SESSION_KEY);
  const existingType = sessionStorage.getItem(SIGNUP_ACCOUNT_TYPE_KEY) as AccountType | null;
  if (existingId) {
    return { signupSessionId: existingId, accountType: existingType ?? DEFAULT_ACCOUNT_TYPE };
  }
  const res = await apiClient.post<SignupRoleSelectionResponse>(
    '/v1/signup/role-selection',
    { accountType: DEFAULT_ACCOUNT_TYPE },
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  sessionStorage.setItem(SIGNUP_SESSION_KEY, res.signupSessionId);
  sessionStorage.setItem(SIGNUP_ACCOUNT_TYPE_KEY, res.accountType);
  return { signupSessionId: res.signupSessionId, accountType: res.accountType };
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export function LoginScreen({ onGoogleAuth, onSSOAuth }: LoginScreenProps) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [authBusy, setAuthBusy] = useState<'google' | 'sso' | null>(null);
  const [authError, setAuthError] = useState('');
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const requestMagicLink = useRequestMagicLink();

  /** Google OAuth: ensure signup session → start OAuth → follow provider redirect. */
  const handleGoogleAuth = async () => {
    if (onGoogleAuth) { onGoogleAuth(); return; }
    if (authBusy) return;
    setAuthBusy('google');
    setAuthError('');
    try {
      const { signupSessionId, accountType } = await ensureSignupSession();
      const res = await apiClient.post<OAuthStartResponse>(
        '/v1/signup/auth/oauth/start',
        { signupSessionId, accountType, authProvider: 'google' },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } }
      );
      window.location.assign(res.redirectUrl);
    } catch (err) {
      setAuthError('Could not start Google sign-in. Try again.');
      setAuthBusy(null);
    }
  };

  /** SSO: ensure signup session → start SSO → follow IdP redirect. */
  const handleSSOAuth = async () => {
    if (onSSOAuth) { onSSOAuth(); return; }
    if (authBusy) return;
    setAuthBusy('sso');
    setAuthError('');
    try {
      const { signupSessionId, accountType } = await ensureSignupSession();
      const res = await apiClient.post<OAuthStartResponse>(
        '/v1/signup/auth/sso/start',
        { signupSessionId, accountType },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } }
      );
      window.location.assign(res.redirectUrl);
    } catch (err) {
      setAuthError('Could not start SSO sign-in. Try again.');
      setAuthBusy(null);
    }
  };

  const switchToLogin = () => { setMode('login'); setStep('email'); setEmail(''); setEmailError(''); };
  const switchToSignup = () => { setMode('signup'); setStep('email'); setEmail(''); setEmailError(''); };

  const magicLinkErrorMessage = (err: unknown): string =>
    err instanceof ApiClientError && err.error.code === 'MAGIC_LINK_RATE_LIMITED'
      ? 'Too many links requested. Try again in a minute.'
      : "Couldn't send the link. Try again.";

  /** Send the magic login link (both signup and login modes are passwordless). */
  const handleNext = async () => {
    if (!email || !email.includes('@')) {
      setEmailError('Please enter a valid work email.');
      return;
    }
    if (requestMagicLink.isPending) return;
    setEmailError('');
    try {
      await requestMagicLink.mutateAsync({ email: email.trim() });
      setResendState('idle');
      setStep('sent');
    } catch (err) {
      setEmailError(magicLinkErrorMessage(err));
    }
  };

  const handleResend = async () => {
    if (resendState === 'sending') return;
    setResendState('sending');
    try {
      await requestMagicLink.mutateAsync({ email: email.trim() });
      setResendState('sent');
    } catch {
      setResendState('idle');
    }
  };

  return (
    <div
      className="relative flex h-screen w-full items-center justify-center overflow-hidden"
      style={{ background: '#f0f0f0' }}
    >
      {/* Figma SVG background */}
      <div className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
        <svg width="100%" height="100%" viewBox="0 0 1440 1024" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g clipPath="url(#lbg_clip0)">
            <rect width="1440" height="1024" fill="url(#lbg_paint0)"/>
            <path d="M745.999 313.75C883.955 313.75 1008.84 276.04 1099.22 215.09C1189.6 154.139 1245.45 69.9723 1245.45 -22.9498C1245.45 -115.872 1189.6 -200.038 1099.22 -260.99C1008.84 -321.94 883.955 -359.65 745.999 -359.65C608.043 -359.65 483.164 -321.94 392.783 -260.99C302.4 -200.038 246.549 -115.872 246.549 -22.9498C246.549 69.9723 302.4 154.139 392.783 215.09C483.164 276.04 608.044 313.75 745.999 313.75Z" stroke="url(#lbg_paint1)" strokeOpacity="0.5" strokeWidth="0.7"/>
            <path d="M739.701 324.249C871.476 324.249 990.76 357.77 1077.09 411.947C1163.42 466.126 1216.75 540.931 1216.75 623.499C1216.75 706.068 1163.42 780.872 1077.09 835.052C990.76 889.229 871.476 922.749 739.701 922.749C607.926 922.749 488.643 889.229 402.314 835.052C315.981 780.872 262.65 706.068 262.65 623.499C262.651 540.931 315.981 466.126 402.314 411.947C488.643 357.77 607.926 324.249 739.701 324.249Z" stroke="url(#lbg_paint2)" strokeOpacity="0.5" strokeWidth="0.7"/>
            <path d="M741.45 314.45C923.79 314.45 1088.85 348.526 1208.31 403.604C1327.8 458.696 1401.55 534.734 1401.55 618.6C1401.55 702.466 1327.8 778.504 1208.31 833.596C1088.85 888.674 923.79 922.75 741.45 922.75C559.111 922.75 394.05 888.674 274.588 833.596C155.096 778.504 81.3496 702.466 81.3496 618.6C81.3496 534.734 155.096 458.696 274.588 403.604C394.05 348.526 559.111 314.45 741.45 314.45Z" stroke="url(#lbg_paint3)" strokeOpacity="0.5" strokeWidth="0.7"/>
            <g filter="url(#lbg_filter0)">
              <rect x="-244" y="-96" width="886" height="632" rx="316" fill="url(#lbg_paint4)" fillOpacity="0.64"/>
            </g>
            <g filter="url(#lbg_filter1)">
              <rect x="872" y="594" width="568" height="430" rx="215" fill="url(#lbg_paint5)" fillOpacity="0.8"/>
            </g>

            {/* Vector3 — sparkle stars, upper-right near top ellipse */}
            <g transform="translate(1091, 206)">
              <path d="M9.30161 5.20606L9.86371 6.76706C10.4881 8.49956 11.8524 9.86386 13.5849 10.4883L15.1459 11.0504C15.2866 11.1015 15.2866 11.301 15.1459 11.3514L13.5849 11.9135C11.8524 12.5379 10.4881 13.9022 9.86371 15.6347L9.30161 17.1957C9.25051 17.3364 9.05101 17.3364 9.00061 17.1957L8.43851 15.6347C7.81411 13.9022 6.44981 12.5379 4.71731 11.9135L3.15631 11.3514C3.01561 11.3003 3.01561 11.1008 3.15631 11.0504L4.71731 10.4883C6.44981 9.86386 7.81411 8.49956 8.43851 6.76706L9.00061 5.20606C9.05101 5.06466 9.25051 5.06466 9.30161 5.20606Z" fill="#505154"/>
              <path d="M16.3282 1.45447L16.6131 2.24477C16.9295 3.12187 17.6204 3.81277 18.4975 4.12917L19.2878 4.41407C19.3592 4.43997 19.3592 4.54077 19.2878 4.56667L18.4975 4.85157C17.6204 5.16797 16.9295 5.85887 16.6131 6.73597L16.3282 7.52627C16.3023 7.59767 16.2015 7.59767 16.1756 7.52627L15.8907 6.73597C15.5743 5.85887 14.8834 5.16797 14.0063 4.85157L13.216 4.56667C13.1446 4.54077 13.1446 4.43997 13.216 4.41407L14.0063 4.12917C14.8834 3.81277 15.5743 3.12187 15.8907 2.24477L16.1756 1.45447C16.2015 1.38237 16.303 1.38237 16.3282 1.45447Z" fill="#505154"/>
              <path d="M16.3282 14.8756L16.6131 15.6659C16.9295 16.543 17.6204 17.2339 18.4975 17.5503L19.2878 17.8352C19.3592 17.8611 19.3592 17.9619 19.2878 17.9878L18.4975 18.2727C17.6204 18.5891 16.9295 19.28 16.6131 20.1571L16.3282 20.9474C16.3023 21.0188 16.2015 21.0188 16.1756 20.9474L15.8907 20.1571C15.5743 19.28 14.8834 18.5891 14.0063 18.2727L13.216 17.9878C13.1446 17.9619 13.1446 17.8611 13.216 17.8352L14.0063 17.5503C14.8834 17.2339 15.5743 16.543 15.8907 15.6659L16.1756 14.8756C16.2015 14.8042 16.303 14.8042 16.3282 14.8756Z" fill="#505154"/>
            </g>


            {/* Vector_6 — cross/plus, on upper-right ellipse */}
            <g transform="translate(952, 348)">
              <path d="M6.50507 8.66877V3.58749C6.50507 2.37937 7.48445 1.39999 8.69257 1.39999C9.90069 1.39999 10.8801 2.37937 10.8801 3.58749V4.31874" stroke="black" strokeOpacity="0.5" strokeWidth="2.8" strokeLinecap="round"/>
              <path d="M10.8801 8.69257V13.7955C10.8801 15.0036 9.90069 15.983 8.69257 15.983C7.48445 15.983 6.50507 15.0036 6.50507 13.7955V13.0554" stroke="black" strokeOpacity="0.5" strokeWidth="2.8" strokeLinecap="round"/>
              <path d="M8.69169 10.8794H3.58175C2.37681 10.8794 1.40002 9.90001 1.40002 8.69189C1.40002 7.48377 2.37681 6.50439 3.58175 6.50439H4.31253" stroke="black" strokeOpacity="0.5" strokeWidth="2.8" strokeLinecap="round"/>
              <path d="M8.69257 6.50439H13.7926C15.003 6.50439 15.9842 7.48377 15.9842 8.69189C15.9842 9.90001 15.003 10.8794 13.7926 10.8794H13.0917" stroke="black" strokeOpacity="0.5" strokeWidth="2.8" strokeLinecap="round"/>
            </g>

            {/* Vector2 — hub/network, left side of first ellipse curve */}
            <g transform="translate(272, 360)">
              <path d="M9.29123 2.79773C9.19611 3.70275 9.67567 4.52739 10.4865 4.89415L10.1792 7.81805C9.68911 7.76654 9.25445 7.86163 8.88247 8.03369L4.29158 2.55379C4.31353 2.34494 4.40549 2.14345 4.42744 1.9346C4.52987 0.959968 3.8403 0.11325 2.86022 0.0102403C1.88015 -0.0927699 1.0296 0.592075 0.927164 1.56671C0.824726 2.54134 1.5143 3.38806 2.49438 3.49107C2.70439 3.51314 2.99173 3.47296 3.20906 3.42541L7.73727 8.82834C7.34334 9.20925 7.14479 9.75146 7.08625 10.3084L4.14603 9.99936C3.95381 9.13453 3.24228 8.49667 2.33221 8.40101C1.14212 8.27593 0.136928 9.08529 0.0125396 10.2688C-0.111849 11.4523 0.703101 12.4529 1.89319 12.578C2.80326 12.6737 3.63186 12.1977 3.99969 11.3917L7.28994 11.7375C7.69218 12.6244 8.54371 13.277 9.52379 13.38C11.0639 13.5419 12.4557 12.4212 12.6167 10.8897C12.7264 9.84542 12.2615 8.88154 11.4654 8.37555L11.8093 5.10357C12.6086 4.90604 13.3191 4.20648 13.4142 3.30146C13.5313 2.1876 12.7237 1.11732 11.5336 0.992232C10.4208 0.80489 9.40831 1.68387 9.29123 2.79773Z" fill="black" fillOpacity="0.6"/>
            </g>

            {/* Vector4 — lightning bolt, left side on bottom ellipse */}
            <g transform="translate(287, 672)">
              <path d="M12.4265 27.9063C12.0102 27.8567 11.5736 27.7927 11.4566 27.7639C11.2844 27.7231 11.1112 27.6867 10.9372 27.6546C10.7384 27.6161 10.5412 27.57 10.3459 27.5163C9.43932 27.2567 9.37436 27.2355 8.69084 26.9563C8.062 26.7002 6.90341 26.102 6.50708 25.8297C6.3986 25.7545 6.29711 25.694 6.28158 25.694C6.26627 25.694 6.01255 25.5157 5.7177 25.2979C3.84323 23.9119 2.43595 22.2295 1.41909 20.1572C1.24411 19.8013 1.10128 19.4855 1.10128 19.4558C1.10128 19.4266 1.06979 19.3455 1.03129 19.2773C0.951893 19.1355 0.838812 18.83 0.747604 18.5143C0.708388 18.3802 0.662768 18.248 0.6109 18.1182C0.568249 18.0177 0.533909 17.8953 0.533909 17.8459C0.533909 17.7963 0.491257 17.6351 0.439201 17.4865C0.387144 17.339 0.345149 17.1649 0.345149 17.0997C0.345149 17.0351 0.304247 16.8113 0.253722 16.6024C0.130798 16.0868 0 14.7511 0 14.0025C0 13.2548 0.130798 11.9191 0.253722 11.4036C0.304028 11.1945 0.345149 10.9666 0.345149 10.8967C0.345149 10.8266 0.376864 10.6892 0.415141 10.5908C0.454512 10.4929 0.504819 10.317 0.528003 10.2001C0.552063 10.0833 0.606745 9.88179 0.651146 9.75113L0.780194 9.374C0.874902 9.09148 0.96283 8.85244 1.00482 8.75936C1.02888 8.70735 1.12272 8.49497 1.21415 8.2874C1.362 7.952 1.67894 7.31944 1.8642 6.98841C1.93178 6.86714 1.95737 6.82694 2.32308 6.256C2.90249 5.34966 3.89266 4.22198 4.81437 3.41811C5.13917 3.13472 6.22427 2.31184 6.27305 2.31184C6.28661 2.31184 6.38897 2.25045 6.50118 2.17528C6.7958 1.97819 7.08474 1.81082 7.46138 1.62226C7.59659 1.55546 7.73047 1.48604 7.86296 1.41403C7.9253 1.37819 8.04232 1.32444 8.64316 1.05569C8.77549 0.99669 8.9181 0.942939 9.32908 0.799384C9.41963 0.76792 9.60161 0.701277 9.73154 0.652552C9.86233 0.604045 10.0161 0.563841 10.0734 0.563841C10.1298 0.563841 10.2783 0.52451 10.4032 0.476003C10.5279 0.427278 10.7543 0.371779 10.9072 0.352988C11.0594 0.335071 11.2617 0.292463 11.3567 0.259032C11.4507 0.226694 11.7088 0.184742 11.9299 0.16617C12.2182 0.140158 12.5056 0.106277 12.7919 0.0645669C13.3799 -0.0215223 14.6581 -0.0215223 15.2399 0.0645669C15.5147 0.103961 15.7905 0.136383 16.0669 0.1618C16.2754 0.179061 16.5411 0.222543 16.6581 0.258377C16.7752 0.293337 16.9777 0.337037 17.1076 0.352988C17.2375 0.370249 17.4563 0.424 17.5936 0.473381C17.7314 0.523636 17.8876 0.563841 17.9414 0.563841C17.9952 0.563841 18.1063 0.593775 18.1875 0.631357C18.2695 0.668065 18.4429 0.729464 18.5737 0.76792C18.7037 0.80725 18.9265 0.884818 19.0702 0.942065C19.2129 0.999093 19.4042 1.07426 19.4957 1.10834C19.6641 1.17171 20.9086 1.79378 21.0779 1.89975C22.4517 2.75562 23.1584 3.31476 24.1086 4.29539C25.2543 5.47835 26.0148 6.60494 26.7888 8.26336C26.8435 8.38048 26.9271 8.55375 26.975 8.64748C27.022 8.74231 27.0614 8.85331 27.0614 8.89439C27.0614 8.93591 27.1007 9.06045 27.1493 9.17167C27.281 9.47385 27.3936 9.81777 27.4468 10.0806C27.473 10.2095 27.5218 10.3691 27.555 10.4348C27.5885 10.5004 27.6277 10.6671 27.6432 10.8036C27.6585 10.94 27.7038 11.1637 27.7423 11.2994C27.9654 12.071 28.0763 14.344 27.9413 15.3493C27.9013 15.648 27.856 16.0092 27.8407 16.1517C27.8149 16.3957 27.6858 17.0265 27.5756 17.4507L27.4619 17.8997C27.2475 18.7643 26.7178 19.996 26.071 21.1354C25.8146 21.5877 24.9553 22.8109 24.793 22.9542C24.7783 22.9669 24.7057 23.0526 24.6322 23.1428C24.5587 23.2341 24.3229 23.4893 24.1095 23.7096C23.1687 24.68 22.41 25.28 21.0779 26.1063C20.92 26.2044 19.5803 26.8582 19.3299 26.9598C19.1999 27.0118 18.983 27.0996 18.848 27.1543C18.7139 27.2082 18.5643 27.2535 18.5173 27.2543C18.4703 27.255 18.3465 27.2969 18.2421 27.3472C18.138 27.3974 18.0055 27.4394 17.9466 27.4403C17.8885 27.4412 17.7185 27.4822 17.5689 27.5316C17.4195 27.5819 17.2117 27.6358 17.1074 27.6518C17.0033 27.6682 16.7804 27.7125 16.6111 27.7501C16.442 27.7877 15.9309 27.8611 15.4766 27.9131C14.4632 28.0312 13.4393 28.0289 12.4265 27.9063ZM13.4551 25.1751C13.5207 25.124 13.5883 25.0221 13.6063 24.9507C13.6456 24.7927 20.0005 12.0657 20.1201 11.9062C20.221 11.7714 20.2304 11.5555 20.1381 11.4795C20.0895 11.4386 19.481 11.4257 17.8568 11.4283C16.6384 11.431 15.6142 11.4318 15.5807 11.431C15.5313 11.4292 15.521 10.616 15.526 7.13262C15.5295 4.7691 15.5184 2.81374 15.5013 2.78665C15.4842 2.75911 15.4175 2.73705 15.3526 2.73705C15.2611 2.73705 15.2185 2.77638 15.1623 2.91359C15.0562 3.1688 14.7631 3.74827 13.3364 6.51558C13.04 7.08986 12.7443 7.66452 12.4494 8.23954C12.1966 8.73379 11.7976 9.50969 11.5642 9.96351C10.9361 11.1835 10.3092 12.4041 9.68363 13.6254C8.60466 15.7308 8.47408 15.9819 8.42771 16.0374C8.33804 16.1458 8.28926 16.3957 8.33979 16.4897C8.38572 16.5758 8.47736 16.5793 10.7552 16.5758C12.0572 16.5742 13.1312 16.581 13.1423 16.5911C13.1723 16.6219 13.1612 24.7433 13.1303 24.9369C13.11 25.0641 13.1235 25.1314 13.1817 25.1895C13.2823 25.2902 13.3099 25.2894 13.4551 25.1751Z" fill="#A3B4C8" fillOpacity="0.6"/>
            </g>
          </g>
          <defs>
            <filter id="lbg_filter0" x="-454" y="-306" width="1306" height="1052" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix"/>
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
              <feGaussianBlur stdDeviation="105" result="effect1_foregroundBlur"/>
            </filter>
            <filter id="lbg_filter1" x="592" y="314" width="1128" height="990" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix"/>
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
              <feGaussianBlur stdDeviation="140" result="effect1_foregroundBlur"/>
            </filter>
            <linearGradient id="lbg_paint0" x1="720" y1="0" x2="720" y2="1024" gradientUnits="userSpaceOnUse">
              <stop stopColor="white"/>
              <stop offset="0.024" stopColor="#FAFAFA"/>
              <stop offset="1" stopColor="#EAEAEA"/>
            </linearGradient>
            <linearGradient id="lbg_paint1" x1="745.999" y1="314.1" x2="745.999" y2="-360" gradientUnits="userSpaceOnUse">
              <stop/><stop offset="0.24" stopColor="white"/>
            </linearGradient>
            <linearGradient id="lbg_paint2" x1="739.701" y1="323.9" x2="739.701" y2="923.1" gradientUnits="userSpaceOnUse">
              <stop/><stop offset="0.24" stopColor="white"/>
            </linearGradient>
            <linearGradient id="lbg_paint3" x1="741.45" y1="314.1" x2="741.45" y2="923.1" gradientUnits="userSpaceOnUse">
              <stop/><stop offset="0.24" stopColor="white"/>
            </linearGradient>
            <linearGradient id="lbg_paint4" x1="73.6" y1="154.9" x2="347.6" y2="582.7" gradientUnits="userSpaceOnUse">
              <stop stopColor="#418AFE"/>
              <stop offset="1" stopColor="#2773FF"/>
            </linearGradient>
            <linearGradient id="lbg_paint5" x1="1156" y1="594" x2="1156" y2="1024" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8FBAFE"/>
              <stop offset="1" stopColor="#BAD3FF"/>
            </linearGradient>
            <clipPath id="lbg_clip0">
              <rect width="1440" height="1024" fill="white"/>
            </clipPath>
          </defs>
        </svg>
      </div>

      <div className="relative z-10 flex flex-col gap-[22px] w-[360px]">
        {/* Allyvate logo */}
        <div className="flex justify-center">
          <img src="/allyvate-wordmark-black.png" alt="Allyvate" className="h-10 w-auto object-contain" />
        </div>
        {/* ── Form card ── */}
        <div
          className="w-full rounded-[24px] p-6 flex flex-col gap-4 min-h-[480px]"
          style={{ background: 'rgba(235,235,235,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.7), 0 4px 24px rgba(0,0,0,0.10)' }}
        >
          {mode === 'signup' && step === 'email' ? (
            <>
              <h2 className="text-[20px] font-bold text-[#0d1117]">Sign up</h2>

              <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-semibold text-[#1a1a1a]">Work email</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleNext()}
                  className="w-full h-12 rounded-xl px-4 text-[14px] text-[#1a1a1a] placeholder:text-[#aaa] outline-none transition-colors"
                  style={{ background: 'rgba(255,255,255,0.9)', border: emailError ? '1.5px solid #7f1d1d' : '1.5px solid #d1d5db' }}
                />
                {emailError && <p className="text-[12px] text-[#991b1b]">{emailError}</p>}
              </div>

              <button
                onClick={handleNext}
                disabled={requestMagicLink.isPending}
                className="w-full h-12 rounded-full text-white text-[15px] font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
                style={{ background: '#4b5563' }}
              >
                {requestMagicLink.isPending ? 'Sending…' : 'Sign up'}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#d1d5db]" />
                <span className="text-[12px] font-semibold text-[#9ca3af] tracking-widest">OR</span>
                <div className="flex-1 h-px bg-[#d1d5db]" />
              </div>

              <button
                onClick={handleGoogleAuth}
                className="w-full h-12 rounded-xl flex items-center justify-center gap-3 text-[14px] font-medium text-[#1a1a1a] hover:bg-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #d1d5db' }}
              >
                <GoogleG />
                Continue with Google
              </button>

              <button
                onClick={handleSSOAuth}
                className="w-full h-12 rounded-xl flex items-center justify-center gap-3 text-[14px] font-medium text-[#1a1a1a] hover:bg-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #d1d5db' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                Continue with SSO
              </button>
              {authError && <p className="text-[12px] text-[#991b1b] text-center">{authError}</p>}
            </>

          ) : step === 'sent' ? (
            <>
              <div className="flex justify-center pt-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.9)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </div>
              </div>

              <div className="flex flex-col gap-2 text-center">
                <p className="text-[15px] font-medium text-[#1a1a1a] leading-snug">{"We've sent a link to"}</p>
                <p className="text-[15px] font-bold text-[#0d1117] break-all">{email}</p>
              </div>

              <div className="flex-1" />

              <p className="text-center text-[13px] text-[#6b7280] leading-relaxed">
                {"Didn't receive it?"}{' '}
                <span
                  className="font-semibold text-[#0d1117] cursor-pointer hover:underline"
                  onClick={handleResend}
                >
                  {resendState === 'sending' ? 'Sending…' : resendState === 'sent' ? 'Sent!' : 'Resend'}
                </span>
                {' '}or{' '}
                <span className="font-semibold text-[#0d1117] cursor-pointer hover:underline" onClick={() => { setStep('email'); setEmail(''); setResendState('idle'); }}>
                  Change email
                </span>
              </p>
            </>

          ) : (
            <>
              <h2 className="text-[20px] font-bold text-[#0d1117]">Log in</h2>

              <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-semibold text-[#1a1a1a]">Work email</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleNext()}
                  autoFocus
                  className="w-full h-12 rounded-xl px-4 text-[14px] text-[#1a1a1a] placeholder:text-[#aaa] outline-none transition-colors"
                  style={{ background: 'rgba(255,255,255,0.9)', border: emailError ? '1.5px solid #7f1d1d' : '1.5px solid #d1d5db' }}
                />
                {emailError && <p className="text-[12px] text-[#991b1b]">{emailError}</p>}
                <p className="text-[12px] text-[#6b7280]">{"We'll email you a one-time login link."}</p>
              </div>

              <button
                onClick={handleNext}
                disabled={requestMagicLink.isPending}
                className="w-full h-12 rounded-full text-white text-[15px] font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
                style={{ background: '#4b5563' }}
              >
                {requestMagicLink.isPending ? 'Sending…' : 'Log in'}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#d1d5db]" />
                <span className="text-[12px] font-semibold text-[#9ca3af] tracking-widest">OR</span>
                <div className="flex-1 h-px bg-[#d1d5db]" />
              </div>

              <button
                onClick={handleGoogleAuth}
                className="w-full h-12 rounded-xl flex items-center justify-center gap-3 text-[14px] font-medium text-[#1a1a1a] hover:bg-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #d1d5db' }}
              >
                <GoogleG />
                Continue with Google
              </button>

              <button
                onClick={handleSSOAuth}
                className="w-full h-12 rounded-xl flex items-center justify-center gap-3 text-[14px] font-medium text-[#1a1a1a] hover:bg-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #d1d5db' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                Continue with SSO
              </button>
              {authError && <p className="text-[12px] text-[#991b1b] text-center">{authError}</p>}
            </>
          )}

          <div className="flex-1" />
          {mode === 'signup' ? (
            <p className="text-center text-[13px] text-[#6b7280]">
              {"Already have an account?"}{' '}
              <span className="font-semibold text-[#0d1117] cursor-pointer hover:underline" onClick={switchToLogin}>Log in</span>
            </p>
          ) : (
            <p className="text-center text-[13px] text-[#6b7280]">
              {"Don't have an account?"}{' '}
              <span className="font-semibold text-[#0d1117] cursor-pointer hover:underline" onClick={switchToSignup}>Sign up</span>
            </p>
          )}
        </div>

        {/* Below-card text */}
        <p className="text-center text-[11px] text-[#9ca3af] leading-relaxed px-2">
          By signing up, you agree to the{' '}
          <span className="underline cursor-pointer hover:text-[#555]">Terms of Service</span>
          {' '}and{' '}
          <span className="underline cursor-pointer hover:text-[#555]">Privacy Policy</span>
        </p>

      </div>
    </div>
  );
}
