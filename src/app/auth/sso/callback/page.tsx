'use client';

import { Suspense } from 'react';
import { AuthCallback } from '../../../../screens/auth/AuthCallback';

export default function SsoCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallback />
    </Suspense>
  );
}
