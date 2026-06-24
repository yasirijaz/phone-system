import { Suspense } from 'react';
import CallProgressBarContent from './call-progress-bar-content';

export default function CallProgressBarPage() {
  return (
    <Suspense fallback={null}>
      <CallProgressBarContent />
    </Suspense>
  );
}
