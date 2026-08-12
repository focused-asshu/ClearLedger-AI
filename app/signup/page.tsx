import Link from "next/link";
import { signup } from "@/app/auth/actions";
import { isDemoMode } from "@/lib/demo-mode";
import { redirect } from "next/navigation";

export default async function SignupPage({ searchParams }: { searchParams?: Promise<{ message?: string }> }) {
  if (isDemoMode()) redirect("/dashboard");
  const params = await searchParams;
  const message = params?.message;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-600">ClearLedger AI</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Create workspace</h1>
        <p className="mt-2 text-sm text-slate-500">Sign up with email and password. A private organization workspace is created automatically.</p>
        {message ? <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div> : null}
        <form action={signup} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Organization name
            <input name="organizationName" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-950 shadow-sm focus:border-cyan-500 focus:outline-none" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input name="email" type="email" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-950 shadow-sm focus:border-cyan-500 focus:outline-none" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input name="password" type="password" minLength={6} required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-950 shadow-sm focus:border-cyan-500 focus:outline-none" />
          </label>
          <button type="submit" className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">Create account</button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="font-semibold text-cyan-700 hover:text-cyan-800">Log in</Link>
        </p>
      </section>
    </main>
  );
}
