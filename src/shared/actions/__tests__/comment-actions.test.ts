import { refresh } from "next/cache";

import { getServerSession } from "@/shared/auth/session";
import {
  createComment,
  deleteComment as deleteCommentRow,
  getCommentOwnership,
  updateComment,
} from "@/shared/repositories/comment-repository";
import type { CommentItem } from "@/shared/repositories/types";

import { addComment, deleteComment, editComment } from "../comment-actions";

jest.mock("next/cache", () => ({ refresh: jest.fn() }));
jest.mock("@/shared/auth/session", () => ({ getServerSession: jest.fn() }));
// Repositories are mocked; the real ownership check (ownership.ts) runs on top.
jest.mock("@/shared/repositories/comment-repository", () => ({
  createComment: jest.fn(),
  updateComment: jest.fn(),
  deleteComment: jest.fn(),
  getCommentOwnership: jest.fn(),
}));
jest.mock("@/shared/repositories/post-repository", () => ({ getPostAuthorId: jest.fn() }));

const signInAs = (id: string | null) =>
  jest
    .mocked(getServerSession)
    .mockResolvedValue((id ? { user: { id } } : null) as never);

const comment: CommentItem = {
  id: "c1",
  content: "Hi",
  author: { id: "ben", name: "Ben" },
  createdAt: new Date(),
  updatedAt: new Date(),
  isMine: true,
};

describe("addComment", () => {
  it("rejects signed-out users (401) without touching the database", async () => {
    signInAs(null);
    await expect(addComment("p1", { content: "Hi" })).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });
    expect(createComment).not.toHaveBeenCalled();
  });

  it("validates the content", async () => {
    signInAs("ben");
    await expect(addComment("p1", { content: "   " })).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", fieldErrors: { content: ["Write a comment"] } },
    });
    expect(createComment).not.toHaveBeenCalled();
  });

  it("returns 404 when the post was deleted", async () => {
    signInAs("ben");
    jest.mocked(createComment).mockResolvedValue(null);
    await expect(addComment("p1", { content: "Hi" })).resolves.toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("lets any signed-in user comment on someone else's post", async () => {
    signInAs("ben");
    jest.mocked(createComment).mockResolvedValue(comment);
    await expect(addComment("adas-post", { content: " Hi " })).resolves.toEqual({
      ok: true,
      data: { comment },
    });
    expect(createComment).toHaveBeenCalledWith("adas-post", "ben", "Hi");
    expect(refresh).toHaveBeenCalled();
  });
});

describe("editComment", () => {
  it("rejects signed-out users", async () => {
    signInAs(null);
    await expect(editComment("c1", { content: "x" })).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("forbids editing someone else's comment (403)", async () => {
    signInAs("ada");
    jest.mocked(getCommentOwnership).mockResolvedValue({ authorId: "ben", postId: "p1" });
    await expect(editComment("c1", { content: "hijack" })).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(updateComment).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing comment", async () => {
    signInAs("ada");
    jest.mocked(getCommentOwnership).mockResolvedValue(null);
    await expect(editComment("missing", { content: "x" })).resolves.toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });

  it("checks ownership before validating, so non-authors always get 403", async () => {
    signInAs("ada");
    jest.mocked(getCommentOwnership).mockResolvedValue({ authorId: "ben", postId: "p1" });
    await expect(editComment("c1", { content: "" })).resolves.toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("lets the author edit", async () => {
    signInAs("ben");
    jest.mocked(getCommentOwnership).mockResolvedValue({ authorId: "ben", postId: "p1" });
    jest.mocked(updateComment).mockResolvedValue({ ...comment, content: "Edited" });
    await expect(editComment("c1", { content: "Edited" })).resolves.toMatchObject({
      ok: true,
      data: { comment: { content: "Edited" } },
    });
    expect(updateComment).toHaveBeenCalledWith("c1", "ben", "Edited");
    expect(refresh).toHaveBeenCalled();
  });

  it("returns 404 if the comment disappears between the check and the update", async () => {
    signInAs("ben");
    jest.mocked(getCommentOwnership).mockResolvedValue({ authorId: "ben", postId: "p1" });
    jest.mocked(updateComment).mockResolvedValue(null);
    await expect(editComment("c1", { content: "Edited" })).resolves.toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });
});

describe("deleteComment", () => {
  it("rejects signed-out users", async () => {
    signInAs(null);
    await expect(deleteComment("c1")).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(deleteCommentRow).not.toHaveBeenCalled();
  });

  it("forbids deleting someone else's comment (403)", async () => {
    signInAs("ada");
    jest.mocked(getCommentOwnership).mockResolvedValue({ authorId: "ben", postId: "p1" });
    await expect(deleteComment("c1")).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(deleteCommentRow).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing comment", async () => {
    signInAs("ada");
    jest.mocked(getCommentOwnership).mockResolvedValue(null);
    await expect(deleteComment("missing")).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("rejects an invalid id", async () => {
    signInAs("ada");
    await expect(deleteComment("")).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("lets the author delete", async () => {
    signInAs("ben");
    jest.mocked(getCommentOwnership).mockResolvedValue({ authorId: "ben", postId: "p1" });
    jest.mocked(deleteCommentRow).mockResolvedValue(true);
    await expect(deleteComment("c1")).resolves.toEqual({ ok: true, data: null });
    expect(deleteCommentRow).toHaveBeenCalledWith("c1", "ben");
    expect(refresh).toHaveBeenCalled();
  });
});
