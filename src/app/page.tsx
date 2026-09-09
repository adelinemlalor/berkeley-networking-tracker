'use client';

/**
 * The application's only route.
 *
 * The session lives in the browser, so the server cannot know who is signed in at render
 * time. Rather than render a page and then bounce the user to /sign-in -- which flashes the
 * wrong screen on every load -- this gate waits for the session to resolve and then shows
 * either the sign-in screen or the tracker.
 */
import { Loader2 } from 'lucide-react';
import { auth } from '@/lib/neon';
import { SignInScreen } from '@/components/sign-in-screen';
import { ContactsScreen } from '@/components/contacts-screen';

export default function Home() {
  const { data: session, isPending } = auth.useSession();

  // Loading state: we do not yet know whether anyone is signed in.
  if (isPending) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div
          className="text-muted-foreground flex items-center gap-2 text-sm"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading your account…
        </div>
      </main>
    );
  }

  return session ? <ContactsScreen session={session} /> : <SignInScreen />;
}
