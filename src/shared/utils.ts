export { cn } from "cn"

/** "Ada Lovelace" → "AL", "Haid" → "H"; falls back to `fallback`'s first letter. */
export function getInitials(name: string, fallback = "") {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = (word?: string) => (word ? Array.from(word)[0] : "")

  const initials =
    words.length > 1
      ? first(words[0]) + first(words[words.length - 1])
      : first(words[0]) || first(fallback)

  return (initials || "?").toUpperCase()
}

// Fixed to UTC so the server-rendered date and the one the browser renders
// during hydration always match, whatever the visitor's time zone.
const dateFormat = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

/** "Nov 5, 2026" */
export function formatDate(date: Date) {
  return dateFormat.format(date)
}
