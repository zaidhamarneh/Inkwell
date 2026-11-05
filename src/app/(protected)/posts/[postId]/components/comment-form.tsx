"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { addComment } from "@/shared/actions/comment-actions";
import { callAction } from "@/shared/actions/call-action";
import { applyApiError } from "@/shared/api/client";
import { FormTextarea } from "@/shared/form-helper/form-textarea";
import { commentSchema, type CommentInput } from "@/shared/schemas/comment/comment";
import { useTRPC } from "@/shared/trpc/client";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";

export function CommentForm({ postId }: { postId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const form = useForm<CommentInput>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "" },
  });

  const rootError = form.formState.errors.root?.message;
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: CommentInput) {
    const result = await callAction(() => addComment(postId, values));
    if (!result.ok) {
      applyApiError(result.error, form.setError, ["content"]);
      return;
    }
    // The server action refreshes this page (the comment list). Post cards
    // elsewhere show a comment count from tRPC, so mark those as stale too.
    form.reset();
    void queryClient.invalidateQueries(trpc.posts.list.pathFilter());
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
