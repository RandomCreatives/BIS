'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending ? 'Please wait…' : children}
    </button>
  );
}
