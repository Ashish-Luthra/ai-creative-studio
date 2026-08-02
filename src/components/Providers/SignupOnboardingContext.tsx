/**
 * React context for signup and onboarding session state.
 *
 * Persists signup session ID, account type, and onboarding session ID in sessionStorage
 * so that refresh and navigation keep the user in the correct flow. Used by signup
 * and onboarding routes to resolve session IDs and account type without prop drilling.
 *
 * Flows:
 * - setSignupSession: after signup auth, store signup session + account type.
 * - setOnboardingSession: after creating an onboarding session, store its id.
 * - clearSignup / clearOnboarding / clearAll: reset state and storage (e.g. logout, start over).
 */

import React, { createContext, useContext, useCallback, useState, useMemo } from 'react';
import type { AccountType } from '../../types/signup-onboarding';

const ONBOARDING_SESSION_KEY = 'martechos_onboarding_session_id';
const SIGNUP_SESSION_KEY = 'martechos_signup_session_id';
const SIGNUP_ACCOUNT_TYPE_KEY = 'martechos_signup_account_type';

/** Internal state shape: session IDs and account type, all persisted to sessionStorage. */
interface SignupOnboardingState {
  signupSessionId: string | null;
  accountType: AccountType | null;
  onboardingSessionId: string | null;
}

/**
 * Context value: state plus setters and clear helpers.
 *
 * @property setSignupSession - Store signup session id and account type (brand | agency).
 * @property setOnboardingSession - Store onboarding session id after creation.
 * @property clearSignup - Clear signup session and account type only.
 * @property clearOnboarding - Clear onboarding session id only.
 * @property clearAll - Clear all signup and onboarding state.
 */
interface SignupOnboardingContextType extends SignupOnboardingState {
  setSignupSession: (signupSessionId: string, accountType: AccountType) => void;
  setOnboardingSession: (sessionId: string) => void;
  clearSignup: () => void;
  clearOnboarding: () => void;
  clearAll: () => void;
}

const initialState: SignupOnboardingState = {
  signupSessionId: typeof window !== 'undefined' ? sessionStorage.getItem(SIGNUP_SESSION_KEY) : null,
  accountType: (typeof window !== 'undefined'
    ? sessionStorage.getItem(SIGNUP_ACCOUNT_TYPE_KEY)
    : null) as AccountType | null,
  onboardingSessionId: typeof window !== 'undefined' ? sessionStorage.getItem(ONBOARDING_SESSION_KEY) : null,
};

const SignupOnboardingContext = createContext<SignupOnboardingContextType | undefined>(undefined);

/**
 * Provides signup and onboarding session state to the tree. Must wrap any route or
 * component that uses useSignupOnboarding. Hydrates state from sessionStorage on mount.
 *
 * @param props.children - Child tree (typically router outlet).
 */
export function SignupOnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SignupOnboardingState>(initialState);

  const setSignupSession = useCallback((signupSessionId: string, accountType: AccountType) => {
    sessionStorage.setItem(SIGNUP_SESSION_KEY, signupSessionId);
    sessionStorage.setItem(SIGNUP_ACCOUNT_TYPE_KEY, accountType);
    setState((s) => ({ ...s, signupSessionId, accountType }));
  }, []);

  const setOnboardingSession = useCallback((sessionId: string) => {
    sessionStorage.setItem(ONBOARDING_SESSION_KEY, sessionId);
    setState((s) => ({ ...s, onboardingSessionId: sessionId }));
  }, []);

  const clearSignup = useCallback(() => {
    sessionStorage.removeItem(SIGNUP_SESSION_KEY);
    sessionStorage.removeItem(SIGNUP_ACCOUNT_TYPE_KEY);
    setState((s) => ({ ...s, signupSessionId: null, accountType: null }));
  }, []);

  const clearOnboarding = useCallback(() => {
    sessionStorage.removeItem(ONBOARDING_SESSION_KEY);
    setState((s) => ({ ...s, onboardingSessionId: null }));
  }, []);

  const clearAll = useCallback(() => {
    sessionStorage.removeItem(SIGNUP_SESSION_KEY);
    sessionStorage.removeItem(SIGNUP_ACCOUNT_TYPE_KEY);
    sessionStorage.removeItem(ONBOARDING_SESSION_KEY);
    setState({
      signupSessionId: null,
      accountType: null,
      onboardingSessionId: null,
    });
  }, []);

  const value = useMemo<SignupOnboardingContextType>(
    () => ({
      ...state,
      setSignupSession,
      setOnboardingSession,
      clearSignup,
      clearOnboarding,
      clearAll,
    }),
    [state, setSignupSession, setOnboardingSession, clearSignup, clearOnboarding, clearAll]
  );

  return (
    <SignupOnboardingContext.Provider value={value}>
      {children}
    </SignupOnboardingContext.Provider>
  );
}

/**
 * Consumes the signup/onboarding context. Use only inside SignupOnboardingProvider.
 *
 * @returns SignupOnboardingContextType (session ids, account type, setters, clear helpers).
 * @throws Error if used outside SignupOnboardingProvider.
 */
export function useSignupOnboarding() {
  const ctx = useContext(SignupOnboardingContext);
  if (ctx === undefined) {
    throw new Error('useSignupOnboarding must be used within SignupOnboardingProvider');
  }
  return ctx;
}
