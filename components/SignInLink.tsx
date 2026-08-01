'use client';

import { LoginLink } from '@kinde-oss/kinde-auth-nextjs/components';
import { track, type SignInSource } from '@/game/analytics';
import { markSignInStarted } from '@/game/signInTrip';

/**
 * Every sign-in button in the game.
 *
 * Kinde's `LoginLink` used directly at five call sites meant five places to
 * remember to record the press, and analytics that has to be remembered at every
 * call site is analytics that ends up half-wired — the exact failure
 * game/analytics.ts opens by warning about. Going through here makes `from`
 * required, so a sixth sign-in button cannot be added without saying where it
 * is.
 *
 * It also stamps the outbound leg of the round trip. That is the whole reason
 * this is a component rather than a lint rule: pressing sign-in and returning
 * with a session happen in two different page loads, and something has to
 * survive the redirect to connect them.
 */
export default function SignInLink({
  from, className, children,
}: {
  from: SignInSource;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <LoginLink
      className={className}
      onClick={() => {
        track({ name: 'signin_started', from });
        markSignInStarted(from);
      }}
    >
      {children}
    </LoginLink>
  );
}
