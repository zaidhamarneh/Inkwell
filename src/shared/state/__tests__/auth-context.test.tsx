/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";

import { apiPost } from "@/shared/api/client";

import {
  AuthProvider,
  CurrentUserProvider,
  useAuth,
  useCurrentUser,
} from "../auth-context";

const mockRouter = { push: jest.fn(), replace: jest.fn(), refresh: jest.fn() };
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
jest.mock("@/shared/api/client", () => ({ apiPost: jest.fn() }));
const mockApiPost = jest.mocked(apiPost);

const user = {
  id: "u1",
  name: "Ada",
  email: "ada@example.com",
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function setup() {
  const queryClient = new QueryClient();
  // Something cached from the current user, to check sign-in/out clears it.
  queryClient.setQueryData(["posts", "list"], { items: ["private"] });
  const clear = jest.spyOn(queryClient, "clear");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(() => useAuth(), { wrapper });
  return { auth: result, queryClient, clear };
}

afterEach(cleanup);

describe("AuthContext actions", () => {
  it("signIn: calls the login API, clears cached data and goes to /dashboard", async () => {
    mockApiPost.mockResolvedValue({ ok: true, data: { user } });
    const { auth, queryClient, clear } = setup();

    await act(() => auth.current.signIn({ email: "ada@example.com", password: "longer123" }));

    expect(mockApiPost).toHaveBeenCalledWith("/auth/login", {
      email: "ada@example.com",
      password: "longer123",
    });
    expect(clear).toHaveBeenCalled();
    expect(queryClient.getQueryData(["posts", "list"])).toBeUndefined();
    expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it("signIn failure: returns the error and doesn't navigate or clear anything", async () => {
    const error = { code: "INVALID_CREDENTIALS" as const, message: "Incorrect email or password." };
    mockApiPost.mockResolvedValue({ ok: false, status: 401, error });
    const { auth, clear } = setup();

    const result = await act(() => auth.current.signIn({ email: "a@b.co", password: "x" }));

    expect(result).toEqual({ ok: false, status: 401, error });
    expect(clear).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("signUp: calls the register API and goes to /dashboard", async () => {
    mockApiPost.mockResolvedValue({ ok: true, data: { user } });
    const { auth, clear } = setup();
    const input = {
      name: "Ada",
      email: "ada@example.com",
      password: "longer123",
      confirmPassword: "longer123",
    };

    await act(() => auth.current.signUp(input));

    expect(mockApiPost).toHaveBeenCalledWith("/auth/register", input);
    expect(clear).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
  });

  it("signOut: calls the logout API, clears the previous user's data and replaces with /login", async () => {
    mockApiPost.mockResolvedValue({ ok: true, data: undefined });
    const { auth, queryClient } = setup();

    await act(() => auth.current.signOut());

    expect(mockApiPost).toHaveBeenCalledWith("/auth/logout");
    expect(queryClient.getQueryData(["posts", "list"])).toBeUndefined();
    expect(mockRouter.replace).toHaveBeenCalledWith("/login");
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("signOut failure: stays put and keeps the data", async () => {
    mockApiPost.mockResolvedValue({
      ok: false,
      status: 0,
      error: { code: "INTERNAL_ERROR", message: "Couldn't reach the server." },
    });
    const { auth, queryClient } = setup();

    const result = await act(() => auth.current.signOut());

    expect(result.ok).toBe(false);
    expect(queryClient.getQueryData(["posts", "list"])).toEqual({ items: ["private"] });
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe("useCurrentUser", () => {
  it("returns the user from CurrentUserProvider", () => {
    function Name() {
      return <span>{useCurrentUser().name}</span>;
    }
    render(
      <CurrentUserProvider user={{ id: "u1", name: "Ada", email: "ada@example.com" }}>
        <Name />
      </CurrentUserProvider>,
    );
    expect(screen.getByText("Ada")).toBeTruthy();
  });

  it("throws a clear error outside the provider", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useCurrentUser())).toThrow(/CurrentUserProvider/);
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
