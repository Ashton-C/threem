"use client";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-browser";

const AUTH_READY =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function AuthPanel({
  onUser,
}: {
  onUser: (u: User | null) => void;
}) {
  const supabase = useMemo(() => (AUTH_READY ? createClient() : null), []);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      onUser(data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
      onUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  if (!supabase) return null; // env not configured yet — auth hidden

  if (user)
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden text-fog sm:inline">{user.email}</span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-full border border-edge px-3 py-1 text-xs text-fog transition hover:border-fog hover:text-paper"
        >
          sign out
        </button>
      </div>
    );

  if (sent)
    return <p className="text-sm text-fog">Magic link sent — check your email.</p>;

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!email.trim() || busy) return;
        setBusy(true);
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        setBusy(false);
        if (!error) setSent(true);
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        className="w-44 rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm text-paper placeholder-fog outline-none transition focus:border-fog"
      />
      <button
        type="submit"
        disabled={busy}
        className="whitespace-nowrap rounded-lg border border-edge px-3 py-1.5 text-sm text-fog transition hover:border-fog hover:text-paper disabled:opacity-40"
      >
        {busy ? "…" : "magic link"}
      </button>
    </form>
  );
}
