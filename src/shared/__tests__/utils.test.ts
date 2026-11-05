import { formatDate, getInitials, getReadingMinutes } from "../utils";

describe("getReadingMinutes", () => {
  const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

  it.each([
    ["", 1],
    ["   ", 1],
    [words(1), 1],
    [words(200), 1],
    [words(201), 2],
    [words(1000), 5],
  ])("%#: %i words → %i min", (text, expected) => {
    expect(getReadingMinutes(text)).toBe(expected);
  });

  it("counts words across any whitespace", () => {
    expect(getReadingMinutes(`${words(150)}\n\n\t${words(150)}`)).toBe(2);
  });
});

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
