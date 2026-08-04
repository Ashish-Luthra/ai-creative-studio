'use client';

import { Suspense } from 'react';
import { AuthCallback } from '../../../../screens/auth/AuthCallback';

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallback />
    </Suspense>
  );
}
