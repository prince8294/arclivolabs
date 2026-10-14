import Link from 'next/link';
import { AnchorHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';
import { buttonVariants, type ButtonSize, type ButtonVariant } from './button';

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** A `next/link` rendered with the exact Button styles. */
export default function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(buttonVariants(variant, size), className)} {...props} />
  );
}
