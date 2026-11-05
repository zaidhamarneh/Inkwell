"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { signIn } from "@/shared/auth/auth-client";
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
    const { error } = await signIn.email(values);

    if (error) {
      form.setError("root", {
        message:
          error.status === 401
            ? "Incorrect email or password."
            : (error.message ?? "Something went wrong. Please try again."),
      });
      form.setValue("password", "");
      return;
    }

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
