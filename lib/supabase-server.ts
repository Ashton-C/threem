import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cookie-backed Supabase client for route handlers — sees the signed-in
// user, and RLS applies (unlike lib/supabase.ts, which is service-role).
export async function createUserClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component — middleware handles refresh
          }
        },
      },
    }
  );
}
