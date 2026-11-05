"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

import { applyApiError } from "@/shared/api/client";
import { FormInput } from "@/shared/form-helper/form-input";
import { FormInputPassword } from "@/shared/form-helper/form-input-password";
import { registerSchema, type RegisterInput } from "@/shared/schemas/auth/auth";
import { useAuth } from "@/shared/state/auth-context";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";

export function RegisterForm() {
  const { signUp } = useAuth();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  // React Hook Form only re-validates the field being edited, so changing
  // "password" wouldn't clear (or raise) the mismatch error on "confirmPassword".
  const password = useWatch({ control: form.control, name: "password" });
  const { getValues, trigger } = form;

  useEffect(() => {
    if (getValues("confirmPassword")) {
      void trigger("confirmPassword");
    }
  }, [password, getValues, trigger]);

  const rootError = form.formState.errors.root?.message;
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: RegisterInput) {
    // AuthContext creates the account (signed in), clears cached data and
    // goes to /dashboard.
    const result = await signUp(values);

    if (!result.ok) {
      applyApiError(result.error, form.setError, [
        "name",
        "email",
        "password",
        "confirmPassword",
      ]);
      return;
    }

    // Next keeps this page alive (hidden) after leaving it; clear it now.
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
          name="name"
          label="Name"
          autoComplete="name"
        />
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
          description="At least 8 characters."
          autoComplete="new-password"
        />
        <FormInputPassword
          control={form.control}
          name="confirmPassword"
          label="Confirm password"
          autoComplete="new-password"
        />

        {rootError && (
          <p role="alert" className="text-sm text-destructive">
            {rootError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </Form>
  );
}
