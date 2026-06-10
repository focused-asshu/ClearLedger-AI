"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function redirectWithMessage(path: "/login" | "/signup", message: string): never {
  const destination = `${path}?message=${encodeURIComponent(message)}` as `/login?message=${string}` | `/signup?message=${string}`;
  redirect(destination);
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirectWithMessage("/login", "Email and password are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirectWithMessage("/login", error.message);
  }

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const organizationName = String(formData.get("organizationName") ?? "").trim();

  if (!email || !password || !organizationName) {
    redirectWithMessage("/signup", "Email, password, and organization name are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        organization_name: organizationName,
      },
    },
  });

  if (error) {
    redirectWithMessage("/signup", error.message);
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
