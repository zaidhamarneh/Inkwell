/** @jest-environment jsdom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ApiResult } from "@/shared/api/client";
import type { AuthUserResponse } from "@/shared/api/types";

import { LoginForm } from "../login-form";

type SignInResult = ApiResult<AuthUserResponse["data"]>;
const mockSignIn = jest.fn<Promise<SignInResult>, [unknown]>();
jest.mock("@/shared/state/auth-context", () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

const success: SignInResult = {
  ok: true,
  data: {
    user: {
      id: "u1",
      name: "Ada",
      email: "ada@example.com",
      emailVerified: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  },
};

const email = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Email" });
const password = () => screen.getByLabelText<HTMLInputElement>("Password");
const submit = () => screen.getByRole("button", { name: "Log in" });

afterEach(cleanup);

async function fillAndSubmit(emailValue: string, passwordValue: string) {
  const user = userEvent.setup();
  if (emailValue) await user.type(email(), emailValue);
  if (passwordValue) await user.type(password(), passwordValue);
  await user.click(submit());
}

describe("LoginForm", () => {
  it("validates in the browser before sending anything", async () => {
    render(<LoginForm />);
    await fillAndSubmit("", "");

    expect(await screen.findByText("Enter a valid email")).toBeTruthy();
    expect(screen.getByText("Enter your password")).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("signs in through AuthContext and clears the form afterwards", async () => {
    mockSignIn.mockResolvedValue(success);
    render(<LoginForm />);
    await fillAndSubmit("ada@example.com", "longer123");

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({ email: "ada@example.com", password: "longer123" }),
    );
    // Next keeps this page alive after leaving it; nothing should stay filled in.
    await waitFor(() => expect(email().value).toBe(""));
    expect(password().value).toBe("");
  });

  it("shows a wrong password as a form-level error and clears only the password", async () => {
    mockSignIn.mockResolvedValue({
      ok: false,
      status: 401,
      error: { code: "INVALID_CREDENTIALS", message: "Incorrect email or password." },
    });
    render(<LoginForm />);
    await fillAndSubmit("ada@example.com", "wrongpass1");

    expect((await screen.findByRole("alert")).textContent).toBe("Incorrect email or password.");
    expect(email().value).toBe("ada@example.com");
    expect(password().value).toBe("");
  });

  it("shows the rate-limit message from the server", async () => {
    mockSignIn.mockResolvedValue({
      ok: false,
      status: 429,
      error: {
        code: "RATE_LIMITED",
        message: "Too many login attempts for this account. Try again in 15 min.",
      },
    });
    render(<LoginForm />);
    await fillAndSubmit("ada@example.com", "wrongpass1");

    expect((await screen.findByRole("alert")).textContent).toContain("Too many login attempts");
  });
});
