'use client';

import { Suspense } from 'react';
import { SignupAuth } from '../../../screens/auth/SignupAuth';

export default function SignupAuthPage() {
  return (
    <Suspense fallback={null}>
      <SignupAuth />
    </Suspense>
  );
}
