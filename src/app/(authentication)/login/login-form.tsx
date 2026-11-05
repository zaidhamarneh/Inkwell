"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { applyApiError } from "@/shared/api/client";
import { FormInput } from "@/shared/form-helper/form-input";
import { FormInputPassword } from "@/shared/form-helper/form-input-password";
import { loginSchema, type LoginInput } from "@/shared/schemas/auth/auth";
import { useAuth } from "@/shared/state/auth-context";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";

export function LoginForm() {
  const { signIn } = useAuth();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const rootError = form.formState.errors.root?.message;
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: LoginInput) {
    // AuthContext signs in, clears cached data and goes to /dashboard.
    const result = await signIn(values);

    if (!result.ok) {
      applyApiError(result.error, form.setError, ["email", "password"]);
      form.setValue("password", "");
      return;
    }

    // Next keeps this page alive (hidden) after leaving it, so clear the
    // email and password now rather than when the user comes back.
    form.reset();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="grid gap-4"
      >
        <FormInput
          control={form.control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
        />
        <FormInputPassword
          control={form.control}
          name="password"
          label="Password"
          autoComplete="current-password"
        />

        {rootError && (
          <p role="alert" className="text-sm text-destructive">
            {rootError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </Form>
  );
}
