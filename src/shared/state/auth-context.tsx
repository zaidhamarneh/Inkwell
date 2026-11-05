"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, use, useMemo } from "react";

import { apiPost, type ApiResult } from "@/shared/api/client";
import type { AuthUserResponse } from "@/shared/api/types";
import type { LoginInput, RegisterInput } from "@/shared/schemas/auth/auth";

/**
 * Authentication state for the whole app (Context API).
 *
 * - AuthProvider (root layout): the actions — sign in, sign up, sign out.
 *   Available on every page, including /login and /register.
 * - CurrentUserProvider (protected layout): the signed-in user, loaded and
 *   verified on the server for each request.
 *
 * Components use useAuth() for the actions and useCurrentUser() for the user.
 * The session itself stays in an HttpOnly cookie; the server remains the
 * source of truth for who is signed in.
 */

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

type AuthResult = ApiResult<AuthUserResponse["data"]>;

type AuthActions = {
  signIn: (input: LoginInput) => Promise<AuthResult>;
  signUp: (input: RegisterInput) => Promise<AuthResult>;
  signOut: () => Promise<ApiResult<undefined>>;
};

const AuthActionsContext = createContext<AuthActions | null>(null);
const CurrentUserContext = createContext<CurrentUser | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const actions = useMemo<AuthActions>(() => {
    // Whenever the signed-in user changes, drop all cached data (posts,
    // likes, …) so nothing from the previous user stays in memory.
    function switchUser(to: string, mode: "push" | "replace") {
      queryClient.clear();
      if (mode === "push") router.push(to);
      else router.replace(to);
      router.refresh();
    }

    return {
      async signIn(input) {
        const result = await apiPost<AuthUserResponse["data"]>("/auth/login", input);
        if (result.ok) switchUser("/dashboard", "push");
        return result;
      },
      async signUp(input) {
        // The API signs the new user in (sets the session cookie) on success.
        const result = await apiPost<AuthUserResponse["data"]>("/auth/register", input);
        if (result.ok) switchUser("/dashboard", "push");
        return result;
      },
      async signOut() {
        // Revokes the session in the database and clears the cookie.
        const result = await apiPost<undefined>("/auth/logout");
        if (result.ok) switchUser("/login", "replace");
        return result;
      },
    };
  }, [queryClient, router]);

  return <AuthActionsContext value={actions}>{children}</AuthActionsContext>;
}

/** Provides the user the server verified for this request (protected pages). */
export function CurrentUserProvider({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  return <CurrentUserContext value={user}>{children}</CurrentUserContext>;
}

/** signIn / signUp / signOut. Must be used under AuthProvider. */
export function useAuth(): AuthActions {
  const actions = use(AuthActionsContext);
  if (!actions) throw new Error("useAuth must be used within <AuthProvider>");
  return actions;
}

/** The signed-in user. Must be used on a protected page (under CurrentUserProvider). */
export function useCurrentUser(): CurrentUser {
  const user = use(CurrentUserContext);
  if (!user) {
    throw new Error("useCurrentUser must be used within <CurrentUserProvider>");
  }
  return user;
}
