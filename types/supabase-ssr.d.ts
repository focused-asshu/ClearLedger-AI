declare module "@supabase/ssr" {
  import type { CookieOptions, SupabaseClient } from "@supabase/supabase-js";

  export interface CookieMethodsServer {
    getAll(): Array<{ name: string; value: string }>;
    setAll(cookies: Array<{ name: string; value: string; options?: CookieOptions }>): void;
  }

  export function createBrowserClient<Database = unknown>(
    supabaseUrl: string,
    supabaseKey: string,
  ): SupabaseClient<Database>;

  export function createServerClient<Database = unknown>(
    supabaseUrl: string,
    supabaseKey: string,
    options: { cookies: CookieMethodsServer },
  ): SupabaseClient<Database>;
}
