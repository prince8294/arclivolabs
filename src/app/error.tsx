'use client';

import { useEffect } from 'react';

import Button from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-destructive">
        Something went wrong
      </p>
      <h1 className="mt-2 text-2xl font-semibold">The requested page could not be loaded.</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Your data was not cleared. Try the request again, or return later if the problem continues.
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
