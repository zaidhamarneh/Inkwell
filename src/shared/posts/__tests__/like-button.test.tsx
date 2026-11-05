/** @jest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { ActionResult } from "@/shared/actions/types";

import { LikeButton } from "../like-button";

type LikeResult = ActionResult<{ liked: boolean; likeCount: number }>;

const mockSetLike = jest.fn<Promise<LikeResult>, [string, boolean]>();
jest.mock("@/shared/state/posts-context", () => ({
  usePosts: () => ({ setLike: mockSetLike }),
}));

const ok = (liked: boolean, likeCount: number): LikeResult => ({
  ok: true,
  data: { liked, likeCount },
});

const button = () => screen.getByRole("button");
const click = () => fireEvent.click(button());
/** Lets the 400 ms "clicks have stopped" timer fire and promises settle. */
const waitForSend = () =>
  act(async () => {
    jest.advanceTimersByTime(400);
    await Promise.resolve();
  });

beforeEach(() => {
  jest.useFakeTimers();
  mockSetLike.mockResolvedValue(ok(true, 1));
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe("LikeButton", () => {
  it("updates the heart and count immediately on click", () => {
    render(<LikeButton postId="p1" liked={false} likeCount={0} />);
    expect(button().getAttribute("aria-label")).toBe("Like (0 likes)");

    click();

    expect(button().getAttribute("aria-pressed")).toBe("true");
    expect(button().getAttribute("aria-label")).toBe("Unlike (1 like)");
  });

  it("waits until clicking stops for 400 ms before sending", async () => {
    render(<LikeButton postId="p1" liked={false} likeCount={0} />);
    click();

    act(() => jest.advanceTimersByTime(399));
    expect(mockSetLike).not.toHaveBeenCalled();

    await waitForSend();
    expect(mockSetLike).toHaveBeenCalledTimes(1);
    expect(mockSetLike).toHaveBeenCalledWith("p1", true);
  });

  it("merges rapid clicks into one request with the final state", async () => {
    render(<LikeButton postId="p1" liked={false} likeCount={0} />);
    click(); // like
    click(); // unlike
    click(); // like

    await waitForSend();
    expect(mockSetLike).toHaveBeenCalledTimes(1);
    expect(mockSetLike).toHaveBeenCalledWith("p1", true);
  });

  it("sends nothing when the clicks end where they started", async () => {
    render(<LikeButton postId="p1" liked={false} likeCount={4} />);
    click();
    click();

    await waitForSend();
    expect(mockSetLike).not.toHaveBeenCalled();
    expect(button().getAttribute("aria-label")).toBe("Like (4 likes)");
  });

  it("reverts and shows the server's message when the like is rejected (e.g. rate limited)", async () => {
    mockSetLike.mockResolvedValue({
      ok: false,
      error: { code: "RATE_LIMITED", message: "You're liking too fast. Try again in 30s." },
    });
    render(<LikeButton postId="p1" liked={false} likeCount={2} />);
    click();
    expect(button().getAttribute("aria-label")).toBe("Unlike (3 likes)");

    await waitForSend();

    expect(button().getAttribute("aria-label")).toBe("Like (2 likes)");
    expect(screen.getByRole("alert").textContent).toBe(
      "You're liking too fast. Try again in 30s.",
    );
  });

  it("clears the error on the next click", async () => {
    mockSetLike.mockResolvedValueOnce({
      ok: false,
      error: { code: "RATE_LIMITED", message: "Too fast." },
    });
    render(<LikeButton postId="p1" liked={false} likeCount={0} />);
    click();
    await waitForSend();
    expect(screen.queryByRole("alert")).not.toBeNull();

    click();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends only one request at a time; a change made meanwhile is sent after", async () => {
    let resolveFirst: (result: LikeResult) => void = () => {};
    mockSetLike.mockImplementationOnce(
      () => new Promise<LikeResult>((resolve) => (resolveFirst = resolve)),
    );
    mockSetLike.mockResolvedValueOnce(ok(false, 0));

    const { rerender } = render(<LikeButton postId="p1" liked={false} likeCount={0} />);
    click(); // like
    await waitForSend();
    expect(mockSetLike).toHaveBeenCalledTimes(1);

    click(); // unlike, while the like is still in flight
    await waitForSend();
    expect(mockSetLike).toHaveBeenCalledTimes(1); // waits for the first request

    // The server confirms the like (and the refreshed props arrive)…
    await act(async () => {
      resolveFirst(ok(true, 1));
      await Promise.resolve();
    });
    rerender(<LikeButton postId="p1" liked likeCount={1} />);
    await act(async () => {
      await Promise.resolve();
    });

    // …then the pending unlike is sent.
    expect(mockSetLike).toHaveBeenCalledTimes(2);
    expect(mockSetLike).toHaveBeenLastCalledWith("p1", false);
  });

  it("still sends an unsent click when the button unmounts (e.g. navigating away)", () => {
    const { unmount } = render(<LikeButton postId="p1" liked={false} likeCount={0} />);
    click();
    unmount();
    expect(mockSetLike).toHaveBeenCalledWith("p1", true);
  });
});
