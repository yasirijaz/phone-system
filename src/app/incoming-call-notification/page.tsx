import { Suspense } from 'react';
import IncomingCallNotificationContent from './incoming-call-notification-content';

export default function IncomingCallNotificationPage() {
  return (
    <Suspense fallback={null}>
      <IncomingCallNotificationContent />
    </Suspense>
  );
}
