import type { Metadata } from "next";
import Link from "next/link";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Create an account</h1>
        <p className="text-sm text-muted-foreground">Start writing on Inkwell. It only takes a minute.</p>
      </div>

      <RegisterForm />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
