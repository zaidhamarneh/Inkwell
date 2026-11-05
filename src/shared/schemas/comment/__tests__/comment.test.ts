import { COMMENT_MAX, commentSchema } from "../comment";

describe("commentSchema", () => {
  it("accepts and trims a comment", () => {
    expect(commentSchema.parse({ content: "  Nice post " })).toEqual({ content: "Nice post" });
  });

  it("rejects empty, whitespace-only and missing content", () => {
    for (const input of [{ content: "" }, { content: "   " }, {}]) {
      const result = commentSchema.safeParse(input);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Write a comment");
    }
  });

  it("enforces the maximum length", () => {
    expect(commentSchema.safeParse({ content: "x".repeat(COMMENT_MAX) }).success).toBe(true);
    expect(commentSchema.safeParse({ content: "x".repeat(COMMENT_MAX + 1) }).success).toBe(false);
  });
});
