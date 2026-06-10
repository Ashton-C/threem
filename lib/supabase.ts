import "server-only"; // build fails if this service-role client is ever imported client-side
import { createClient } from "@supabase/supabase-js";

export const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
