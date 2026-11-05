"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { applyApiError } from "@/shared/api/client";
import { FormTextarea } from "@/shared/form-helper/form-textarea";
import { commentSchema, type CommentInput } from "@/shared/schemas/comment/comment";
import { usePosts } from "@/shared/state/posts-context";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";

export function CommentForm({ postId }: { postId: string }) {
  const { addComment } = usePosts();
  const form = useForm<CommentInput>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "" },
  });

  const rootError = form.formState.errors.root?.message;
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: CommentInput) {
    // PostsContext saves it; the page and the cards' comment counts refresh.
    const result = await addComment(postId, values);
    if (!result.ok) {
      applyApiError(result.error, form.setError, ["content"]);
      return;
    }
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-3">
        <FormTextarea
          control={form.control}
          name="content"
          label={<span className="sr-only">Add a comment</span>}
          placeholder="Add a comment…"
          textareaClassName="min-h-20"
        />

        {rootError && (
          <p role="alert" className="text-sm text-destructive">
            {rootError}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
