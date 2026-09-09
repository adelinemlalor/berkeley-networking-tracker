'use client';

/**
 * Combined sign-in / sign-up screen.
 *
 * Both actions go straight to Neon Managed Better Auth over HTTPS. No password ever touches
 * this application's own code beyond the input element, and no session is minted here -- the
 * auth service issues the JWT that later authorises every Data API request.
 */
import { useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { auth } from '@/lib/neon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Mode = 'signin' | 'signup';

export function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSignUp = mode === 'signup';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = isSignUp
        ? await auth.signUp.email({ email, password, name: name.trim() || email })
        : await auth.signIn.email({ email, password });

      // Better Auth reports failures in the response rather than by throwing.
      if (result?.error) {
        setError(result.error.message ?? 'Could not sign you in. Please check your details.');
      }
      // On success the session updates and the root gate swaps in the tracker.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  function switchMode() {
    setMode(isSignUp ? 'signin' : 'signup');
    setError(null);
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="bg-primary text-primary-foreground mb-3 flex size-11 items-center justify-center rounded-xl">
            <Users className="size-5" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Berkeley Networking Tracker</h1>
          <p className="text-muted-foreground mt-1 text-sm text-balance">
            Keep track of the people you want to stay connected with.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isSignUp ? 'Create an account' : 'Sign in'}</CardTitle>
            <CardDescription>
              {isSignUp
                ? 'Your contacts are private to your account.'
                : 'Welcome back. Sign in to see your contacts.'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
              {isSignUp && (
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    placeholder="Adeline Lalor"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={pending}
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@berkeley.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pending}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pending}
                />
                {isSignUp && (
                  <p className="text-muted-foreground text-xs">At least 8 characters.</p>
                )}
              </div>

              {/* Error state */}
              {error && (
                <p
                  role="alert"
                  className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
                >
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {isSignUp ? 'Create account' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-muted-foreground mt-4 text-center text-sm">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={switchMode}
            className="text-foreground font-medium underline underline-offset-4"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </main>
  );
}
