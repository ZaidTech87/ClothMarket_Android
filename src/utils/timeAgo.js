// Direct port of web's PostCard.jsx getTimeAgo/getFullDate helpers.
// Backend's JacksonConfig disables WRITE_DATES_AS_TIMESTAMPS, so
// createdAt always arrives as an ISO string in practice - the array
// branch is kept only for defensive parity with the web version.
function toDate(dateInput) {
  if (!dateInput) return null;
  let d;
  if (Array.isArray(dateInput)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = dateInput;
    d = new Date(year, month - 1, day, hour, minute, second);
  } else {
    d = new Date(dateInput);
  }
  return isNaN(d.getTime()) ? null : d;
}

export function getTimeAgo(dateInput) {
  const postDate = toDate(dateInput);
  if (!postDate) return "";

  const now = new Date();
  const diffMs = now - postDate;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  const timeStr = postDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  if (diffSeconds < 60) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return `Yesterday at ${timeStr}`;
  if (diffDays < 7) {
    const day = postDate.toLocaleDateString("en-IN", { weekday: "long" });
    return `${day} at ${timeStr}`;
  }
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${diffYears}y ago`;
}

export function getFullDate(dateInput) {
  const d = toDate(dateInput);
  if (!d) return "";
  return d.toLocaleString("en-IN");
}
