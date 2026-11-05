import { getCommentOwnership } from "@/shared/repositories/comment-repository";
import { getPostAuthorId } from "@/shared/repositories/post-repository";

import { assertCommentAuthor, assertPostAuthor, checkOwnership } from "../ownership";

jest.mock("@/shared/repositories/post-repository", () => ({ getPostAuthorId: jest.fn() }));
jest.mock("@/shared/repositories/comment-repository", () => ({ getCommentOwnership: jest.fn() }));

const mockPostAuthor = jest.mocked(getPostAuthorId);
const mockCommentOwner = jest.mocked(getCommentOwnership);

describe("checkOwnership", () => {
  it("owner, forbidden or not found", () => {
    expect(checkOwnership("u1", "u1")).toBe("owner");
    expect(checkOwnership("u1", "u2")).toBe("forbidden");
    expect(checkOwnership(null, "u1")).toBe("not_found");
  });
});

describe("assertPostAuthor", () => {
  it("passes for the author", async () => {
    mockPostAuthor.mockResolvedValue("author");
    await expect(assertPostAuthor("p1", "author")).resolves.toBeUndefined();
  });

  it("throws 403 when someone else tries to edit or delete the post", async () => {
    mockPostAuthor.mockResolvedValue("author");
    await expect(assertPostAuthor("p1", "intruder")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "You can only edit or delete your own posts.",
    });
  });

  it("throws 404 when the post doesn't exist", async () => {
    mockPostAuthor.mockResolvedValue(null);
    await expect(assertPostAuthor("missing", "anyone")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});

describe("assertCommentAuthor", () => {
  it("passes for the author and returns the post id", async () => {
    mockCommentOwner.mockResolvedValue({ authorId: "author", postId: "p1" });
    await expect(assertCommentAuthor("c1", "author")).resolves.toEqual({ postId: "p1" });
  });

  it("throws 403 when someone else tries to edit or delete the comment", async () => {
    mockCommentOwner.mockResolvedValue({ authorId: "author", postId: "p1" });
    await expect(assertCommentAuthor("c1", "intruder")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "You can only edit or delete your own comments.",
    });
  });

  it("throws 404 when the comment doesn't exist", async () => {
    mockCommentOwner.mockResolvedValue(null);
    await expect(assertCommentAuthor("missing", "anyone")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});
