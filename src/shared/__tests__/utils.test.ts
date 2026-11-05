import { formatDate, getInitials } from "../utils";

describe("getInitials", () => {
  it.each([
    ["Haid", "", "H"],
    ["Ada Lovelace", "", "AL"],
    ["  zaid  al hamarneh ", "", "ZH"],
    ["élodie durand", "", "ÉD"],
    ["", "zaid@example.com", "Z"],
    ["", "", "?"],
  ])("%j (fallback %j) → %s", (name, fallback, expected) => {
    expect(getInitials(name, fallback)).toBe(expected);
  });
});

describe("formatDate", () => {
  it("formats in UTC so server and browser agree", () => {
    expect(formatDate(new Date("2026-11-05T23:30:00Z"))).toBe("Nov 5, 2026");
    expect(formatDate(new Date("2026-01-01T00:00:00Z"))).toBe("Jan 1, 2026");
  });
});
