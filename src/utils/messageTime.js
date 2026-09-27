// Direct port of the two date formatters used by web's Messages.jsx
// (inbox row timestamp: today -> time, yesterday -> "Yesterday", older
// -> "12 Jan") and Chat.jsx (message bubble timestamp: always a time).
export function formatChatTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

export function formatMessageTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
