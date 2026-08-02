/**
 * react-router-dom compatibility layer over next/navigation.
 *
 * The auth + Brand Center screens were ported from a Vite SPA that used
 * react-router-dom. Instead of editing every screen, tsconfig maps the
 * 'react-router-dom' specifier to this module, which re-implements the small
 * API surface those screens use (Link, useNavigate, useSearchParams,
 * useLocation, Navigate) on top of the Next.js app router.
 */
'use client';

import NextLink from 'next/link';
import { useRouter, usePathname, useSearchParams as useNextSearchParams } from 'next/navigation';
import { useCallback, useEffect, type AnchorHTMLAttributes, type ReactNode } from 'react';

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  replace?: boolean;
  children?: ReactNode;
}

export function Link({ to, replace, children, ...rest }: LinkProps) {
  return (
    <NextLink href={to} replace={replace} {...rest}>
      {children}
    </NextLink>
  );
}

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown; // accepted for compatibility; not supported by next/navigation
}

export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        if (to < 0) router.back();
        else router.forward();
        return;
      }
      if (options?.replace) router.replace(to);
      else router.push(to);
    },
    [router]
  );
}

export type SetSearchParams = (
  next: URLSearchParams | Record<string, string>,
  options?: { replace?: boolean }
) => void;

export function useSearchParams(): [URLSearchParams, SetSearchParams] {
  const nextParams = useNextSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const params = new URLSearchParams(nextParams?.toString() ?? '');
  const setParams: SetSearchParams = useCallback(
    (next, options) => {
      const sp = next instanceof URLSearchParams ? next : new URLSearchParams(next);
      const qs = sp.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (options?.replace === false) router.push(url);
      else router.replace(url);
    },
    [pathname, router]
  );
  return [params, setParams];
}

export interface Location {
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
  key: string;
}

export function useLocation(): Location {
  const pathname = usePathname();
  const nextParams = useNextSearchParams();
  const search = nextParams && nextParams.toString() ? `?${nextParams.toString()}` : '';
  return { pathname: pathname ?? '/', search, hash: '', state: null, key: 'compat' };
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [router, to, replace]);
  return null;
}
