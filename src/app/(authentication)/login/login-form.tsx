"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { apiPost, applyApiError } from "@/shared/api/client";
import type { AuthUserResponse } from "@/shared/api/types";
import { FormInput } from "@/shared/form-helper/form-input";
import { FormInputPassword } from "@/shared/form-helper/form-input-password";
import { loginSchema, type LoginInput } from "@/shared/schemas/auth/auth";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";

export function LoginForm() {
  const router = useRouter();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const rootError = form.formState.errors.root?.message;
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: LoginInput) {
    const result = await apiPost<AuthUserResponse["data"]>(
      "/auth/login",
      values,
    );

    if (!result.ok) {
      applyApiError(result.error, form.setError, ["email", "password"]);
      form.setValue("password", "");
      return;
    }

    form.reset();
    router.push("/dashboard");
    router.refresh();
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
