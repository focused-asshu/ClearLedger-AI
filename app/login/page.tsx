import Link from "next/link";
import { login } from "@/app/auth/actions";
import { isDemoMode } from "@/lib/demo-mode";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ message?: string }> }) {
  if (isDemoMode()) redirect("/dashboard");
  const params = await searchParams;
  const message = params?.message;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-600">ClearLedger AI</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Log in</h1>
        <p className="mt-2 text-sm text-slate-500">Access your organization workspace and persistent transaction history.</p>
        {message ? <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div> : null}
        <form action={login} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input name="email" type="email" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-950 shadow-sm focus:border-cyan-500 focus:outline-none" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input name="password" type="password" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-950 shadow-sm focus:border-cyan-500 focus:outline-none" />
          </label>
          <button type="submit" className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">Log in</button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          Need an account? <Link href="/signup" className="font-semibold text-cyan-700 hover:text-cyan-800">Sign up</Link>
        </p>
      </section>
    </main>
  );
}
