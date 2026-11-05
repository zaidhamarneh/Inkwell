"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { callAction } from "@/shared/actions/call-action";
import { editComment } from "@/shared/actions/comment-actions";
import { applyApiError } from "@/shared/api/client";
import { FormTextarea } from "@/shared/form-helper/form-textarea";
import { commentSchema, type CommentInput } from "@/shared/schemas/comment/comment";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";

type EditCommentFormProps = {
  commentId: string;
  content: string;
  /** Called after a successful save or on Cancel. */
  onDone: () => void;
};

/** Inline editor for one of your own comments. The server re-checks ownership. */
export function EditCommentForm({ commentId, content, onDone }: EditCommentFormProps) {
  const form = useForm<CommentInput>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content },
  });

  // The user just clicked Edit, so move focus into the text box (instead of
  // the autoFocus attribute, which fires on any mount).
  const { setFocus } = form;
  useEffect(() => {
    setFocus("content");
  }, [setFocus]);

  const rootError = form.formState.errors.root?.message;
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: CommentInput) {
    const result = await callAction(() => editComment(commentId, values));
    if (!result.ok) {
      applyApiError(result.error, form.setError, ["content"]);
      return;
    }
    // The action refreshes the page, which shows the updated text.
    onDone();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-2 pl-8">
        <FormTextarea
          control={form.control}
          name="content"
          label={<span className="sr-only">Edit comment</span>}
          textareaClassName="min-h-20"
        />

        {rootError && (
          <p role="alert" className="text-sm text-destructive">
            {rootError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
