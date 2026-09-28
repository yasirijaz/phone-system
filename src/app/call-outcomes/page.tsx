'use client';

import { Suspense } from 'react';
import CallOutcomesPage from './call-outcomes-content';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CallOutcomesPage />
    </Suspense>
  );
}
