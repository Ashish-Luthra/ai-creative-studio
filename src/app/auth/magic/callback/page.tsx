'use client';

import { Suspense } from 'react';
import { MagicLinkCallback } from '../../../../screens/auth/MagicLinkCallback';

export default function MagicLinkCallbackPage() {
  return (
    <Suspense fallback={null}>
      <MagicLinkCallback />
    </Suspense>
  );
}
