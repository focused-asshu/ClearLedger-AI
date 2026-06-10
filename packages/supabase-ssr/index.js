import { createClient } from "@supabase/supabase-js";

function createCookieStorage(cookies) {
  return {
    getItem(key) {
      const match = cookies.getAll().find((cookie) => cookie.name === key);
      return match?.value ?? null;
    },
    setItem(key, value) {
      cookies.setAll([{ name: key, value, options: { path: "/", sameSite: "lax" } }]);
    },
    removeItem(key) {
      cookies.setAll([{ name: key, value: "", options: { path: "/", sameSite: "lax", maxAge: 0 } }]);
    },
  };
}

export function createServerClient(supabaseUrl, supabaseKey, options) {
  const storage = createCookieStorage(options.cookies);
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage,
      storageKey: `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`,
    },
    global: {
      headers: { "X-Client-Info": "clearledger-local-ssr" },
    },
  });
}

export function createBrowserClient(supabaseUrl, supabaseKey) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`,
    },
    global: {
      headers: { "X-Client-Info": "clearledger-local-ssr" },
    },
  });
}
