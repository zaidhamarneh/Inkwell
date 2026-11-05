import { loginSchema, registerSchema } from "../auth";

const fieldErrors = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]),
  );

describe("loginSchema", () => {
  it("accepts an email and password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });

  it("rejects a bad email and an empty password", () => {
    const result = loginSchema.safeParse({ email: "nope", password: "" });
    expect(fieldErrors(result)).toEqual({
      email: "Enter a valid email",
      password: "Enter your password",
    });
  });

  it("gives readable messages for missing fields", () => {
    expect(fieldErrors(loginSchema.safeParse({}))).toEqual({
      email: "Enter a valid email",
      password: "Enter your password",
    });
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "Ada",
    email: "ada@example.com",
    password: "longer123",
    confirmPassword: "longer123",
  };

  it("accepts matching passwords", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("trims the name and rejects a blank one", () => {
    expect(fieldErrors(registerSchema.safeParse({ ...valid, name: "   " }))).toEqual({
      name: "Enter your name",
    });
  });

  it("enforces password length 8–128", () => {
    expect(
      fieldErrors(registerSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" })),
    ).toEqual({ password: "Password must be at least 8 characters" });

    const long = "x".repeat(129);
    expect(
      fieldErrors(registerSchema.safeParse({ ...valid, password: long, confirmPassword: long })),
    ).toEqual({ password: "Password must be at most 128 characters" });
  });

  it("reports mismatched passwords on confirmPassword", () => {
    expect(
      fieldErrors(registerSchema.safeParse({ ...valid, confirmPassword: "different1" })),
    ).toEqual({ confirmPassword: "Passwords do not match" });
  });

  it("reports an empty confirmPassword once (not as a mismatch too)", () => {
    expect(fieldErrors(registerSchema.safeParse({ ...valid, confirmPassword: "" }))).toEqual({
      confirmPassword: "Confirm your password",
    });
  });

  it("reports the mismatch alongside other errors", () => {
    const result = registerSchema.safeParse({
      name: "",
      email: "bad",
      password: "longer123",
      confirmPassword: "other1234",
    });
    expect(fieldErrors(result)).toEqual({
      name: "Enter your name",
      email: "Enter a valid email",
      confirmPassword: "Passwords do not match",
    });
  });
});
