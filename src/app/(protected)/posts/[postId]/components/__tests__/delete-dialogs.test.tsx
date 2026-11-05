/** @jest-environment jsdom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DeleteCommentButton } from "../delete-comment-button";
import { PostAuthorActions } from "../post-author-actions";

type Result = { ok: true; data: null | undefined } | { ok: false; error: { code: string; message: string } };

const mockDeleteComment = jest.fn<Promise<Result>, [string]>();
const mockDeletePost = jest.fn<Promise<Result>, [string]>();
jest.mock("@/shared/state/posts-context", () => ({
  usePosts: () => ({ deleteComment: mockDeleteComment, deletePost: mockDeletePost }),
}));

const mockRouter = { replace: jest.fn(), refresh: jest.fn(), push: jest.fn() };
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

afterEach(cleanup);

/** A promise the test resolves itself, to look at the "in progress" state. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const dialog = () => screen.queryByRole("alertdialog");

describe("DeleteCommentButton", () => {
  it("asks for confirmation; Cancel keeps the comment", async () => {
    const user = userEvent.setup();
    render(<DeleteCommentButton commentId="c1" />);

    await user.click(screen.getByRole("button", { name: "Delete comment" }));
    expect(screen.getByText("Delete this comment?")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(mockDeleteComment).not.toHaveBeenCalled();
  });

  it("stays open while deleting, then closes on success", async () => {
    const request = deferred<Result>();
    mockDeleteComment.mockReturnValue(request.promise);
    const user = userEvent.setup();
    render(<DeleteCommentButton commentId="c1" />);

    await user.click(screen.getByRole("button", { name: "Delete comment" }));
    await user.click(screen.getByRole("button", { name: "Delete comment" }));

    expect(mockDeleteComment).toHaveBeenCalledWith("c1");
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(true);
    expect(dialog()).not.toBeNull();

    request.resolve({ ok: true, data: null });
    await waitFor(() => expect(dialog()).toBeNull());
  });

  it("keeps the dialog open and shows the error (e.g. not your comment)", async () => {
    mockDeleteComment.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "You can only edit or delete your own comments." },
    });
    const user = userEvent.setup();
    render(<DeleteCommentButton commentId="c1" />);

    await user.click(screen.getByRole("button", { name: "Delete comment" }));
    await user.click(screen.getByRole("button", { name: "Delete comment" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "You can only edit or delete your own comments.",
    );
    expect(dialog()).not.toBeNull();
    expect(screen.getByRole("button", { name: "Delete comment" }).hasAttribute("disabled")).toBe(false);
  });
});

describe("PostAuthorActions", () => {
  it("links to the edit page", () => {
    render(<PostAuthorActions postId="p1" />);
    expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toBe("/posts/p1/edit");
  });

  it("deletes after confirmation and goes to My feed", async () => {
    mockDeletePost.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    render(<PostAuthorActions postId="p1" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete this post?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Delete post" }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/feed"));
    expect(mockDeletePost).toHaveBeenCalledWith("p1");
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it("Cancel doesn't delete", async () => {
    const user = userEvent.setup();
    render(<PostAuthorActions postId="p1" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(dialog()).toBeNull());
    expect(mockDeletePost).not.toHaveBeenCalled();
  });

  it("shows the error in the dialog and doesn't navigate", async () => {
    mockDeletePost.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "You can only edit or delete your own posts." },
    });
    const user = userEvent.setup();
    render(<PostAuthorActions postId="p1" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete post" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "You can only edit or delete your own posts.",
    );
    expect(dialog()).not.toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
