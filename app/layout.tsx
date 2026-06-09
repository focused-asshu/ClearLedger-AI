import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClearLedger AI | AML Compliance MVP",
  description:
    "Compliance-assistance dashboard for small crypto exchanges and fintech teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
