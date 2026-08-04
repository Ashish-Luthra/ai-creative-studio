'use client';

import { Suspense } from 'react';
import { SignupRoleSelection } from '../../../screens/auth/SignupRoleSelection';

export default function SignupRolePage() {
  return (
    <Suspense fallback={null}>
      <SignupRoleSelection />
    </Suspense>
  );
}
