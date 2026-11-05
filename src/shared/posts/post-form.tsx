"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { applyApiError } from "@/shared/api/client";
import type { ApiErrorBody } from "@/shared/api/types";
import { FormInput } from "@/shared/form-helper/form-input";
import { FormTextarea } from "@/shared/form-helper/form-textarea";
import {
  POST_CONTENT_MAX,
  postSchema,
  type PostInput,
} from "@/shared/schemas/post/post";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";

type PostFormProps = {
  defaultValues?: PostInput;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  /** Saves the post. Return an error to show it on the form, or null on success. */
  onSubmit: (values: PostInput) => Promise<ApiErrorBody["error"] | null>;
};

/** Title + content fields shared by the new-post and edit-post pages. */
export function PostForm({
  defaultValues = { title: "", content: "" },
  submitLabel,
  pendingLabel,
  cancelHref,
  onSubmit,
}: PostFormProps) {
  const form = useForm<PostInput>({
    resolver: zodResolver(postSchema),
    defaultValues,
  });

  const rootError = form.formState.errors.root?.message;
  const isSubmitting = form.formState.isSubmitting;

  async function submit(values: PostInput) {
    const error = await onSubmit(values);
    if (error) applyApiError(error, form.setError, ["title", "content"]);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} noValidate className="grid gap-5">
        <FormInput
          control={form.control}
          name="title"
          label="Title"
          placeholder="Give your post a title"
          autoComplete="off"
        />
        <FormTextarea
          control={form.control}
          name="content"
          label="Content"
          placeholder="Write your post…"
          description={`Plain text. Line breaks are kept. Up to ${POST_CONTENT_MAX.toLocaleString("en")} characters.`}
          textareaClassName="min-h-72 leading-relaxed"
        />

        {rootError && (
          <p role="alert" className="text-sm text-destructive">
            {rootError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? pendingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
