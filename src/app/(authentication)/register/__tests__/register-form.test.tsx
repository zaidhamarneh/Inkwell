/** @jest-environment jsdom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ApiResult } from "@/shared/api/client";
import type { AuthUserResponse } from "@/shared/api/types";

import { RegisterForm } from "../register-form";

type SignUpResult = ApiResult<AuthUserResponse["data"]>;
const mockSignUp = jest.fn<Promise<SignUpResult>, [unknown]>();
jest.mock("@/shared/state/auth-context", () => ({
  useAuth: () => ({ signUp: mockSignUp }),
}));

const field = (label: string) => screen.getByLabelText<HTMLInputElement>(label, { selector: "input" });
const mismatch = () => screen.queryByText("Passwords do not match");

afterEach(cleanup);

async function fill(values: { name?: string; email?: string; password?: string; confirm?: string }) {
  const user = userEvent.setup();
  if (values.name) await user.type(field("Name"), values.name);
  if (values.email) await user.type(screen.getByRole("textbox", { name: "Email" }), values.email);
  if (values.password) await user.type(field("Password"), values.password);
  if (values.confirm) await user.type(field("Confirm password"), values.confirm);
  return user;
}

describe("RegisterForm", () => {
  it("shows a mismatch under Confirm password and doesn't submit", async () => {
    render(<RegisterForm />);
    const user = await fill({
      name: "Ada",
      email: "ada@example.com",
      password: "longer123",
      confirm: "different1",
    });
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords do not match")).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("clears the mismatch when the FIRST password is changed to match (regression)", async () => {
    render(<RegisterForm />);
    const user = await fill({
      name: "Ada",
      email: "ada@example.com",
      password: "longer123",
      confirm: "different1",
    });
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Passwords do not match")).toBeTruthy();

    await user.clear(field("Password"));
    await user.type(field("Password"), "different1");

    await waitFor(() => expect(mismatch()).toBeNull());
  });

  it("puts 'email already taken' from the server under the Email field", async () => {
    mockSignUp.mockResolvedValue({
      ok: false,
      status: 409,
      error: {
        code: "EMAIL_TAKEN",
        message: "An account with this email already exists.",
        fieldErrors: { email: ["An account with this email already exists."] },
      },
    });
    render(<RegisterForm />);
    const user = await fill({
      name: "Ada",
      email: "ada@example.com",
      password: "longer123",
      confirm: "longer123",
    });
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("An account with this email already exists.")).toBeTruthy();
    const emailInput = screen.getByRole("textbox", { name: "Email" });
    expect(emailInput.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(emailInput);
    expect(screen.queryByRole("alert")).toBeNull(); // not a form-level error
  });

  it("signs up through AuthContext and clears the form", async () => {
    mockSignUp.mockResolvedValue({
      ok: true,
      data: {
        user: {
          id: "u1",
          name: "Ada",
          email: "ada@example.com",
          emailVerified: false,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      },
    });
    render(<RegisterForm />);
    const user = await fill({
      name: "Ada",
      email: "ada@example.com",
      password: "longer123",
      confirm: "longer123",
    });
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith({
        name: "Ada",
        email: "ada@example.com",
        password: "longer123",
        confirmPassword: "longer123",
      }),
    );
    await waitFor(() => expect(field("Name").value).toBe(""));
    expect(field("Password").value).toBe("");
  });
});
