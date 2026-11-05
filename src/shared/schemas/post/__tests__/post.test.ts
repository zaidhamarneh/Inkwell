import { POST_CONTENT_MAX, POST_TITLE_MAX, postSchema } from "../post";

describe("postSchema", () => {
  it("accepts a title and content, trimmed", () => {
    expect(postSchema.parse({ title: "  Hi  ", content: "  Body " })).toEqual({
      title: "Hi",
      content: "Body",
    });
  });

  it("requires both title and content (same schema for create and edit)", () => {
    const result = postSchema.safeParse({ title: "Only a title" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => [i.path.join("."), i.message])).toEqual([
      ["content", "Write something"],
    ]);
  });

  it("rejects whitespace-only values", () => {
    const result = postSchema.safeParse({ title: "   ", content: "\n\n" });
    expect(result.error?.issues.map((i) => i.message)).toEqual(["Enter a title", "Write something"]);
  });

  it("enforces the maximum lengths", () => {
    expect(postSchema.safeParse({ title: "x".repeat(POST_TITLE_MAX), content: "ok" }).success).toBe(true);
    expect(postSchema.safeParse({ title: "x".repeat(POST_TITLE_MAX + 1), content: "ok" }).success).toBe(false);
    expect(postSchema.safeParse({ title: "ok", content: "x".repeat(POST_CONTENT_MAX + 1) }).success).toBe(false);
  });
});
