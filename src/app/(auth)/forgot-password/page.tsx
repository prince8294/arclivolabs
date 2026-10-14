import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { ROUTES } from '@/lib/constants/routes';

export const metadata: Metadata = {
  title: 'Forgot password',
  description:
    'Password recovery is not available yet. Contact Arclivo Labs administration.',
};

/**
 * /forgot-password
 *
 * Honest placeholder only: no OTP, no email, no reset tokens yet.
 * Do not add fake recovery behavior to this page in a later edit
 * without implementing the actual workflow.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Forgot your password?
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Self-service password recovery is not available yet. Contact Arclivo
          Labs administration to have your credentials reset.
        </p>
      </div>

      <Link
        href={ROUTES.LOGIN}
        className="inline-flex items-center gap-2 self-start rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to sign in
      </Link>
    </div>
  );
}
