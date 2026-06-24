// Single source for author/version credit strings, shown on the Welcome screen
// footer ("Made by …") and in the Help panel's About section. Kept here so the two
// places can't drift. Muted/secondary styling only — never a banner or watermark.
export const APP_NAME = "Home Design Visualizer";
export const AUTHOR_NAME = "Jonathan Rubashkin";
export const APP_VERSION = "v1.0";

// Optional links. Leave a value empty ("") to omit it:
//  - AUTHOR_URL empty → the author name renders as plain muted text (no link).
//  - FEEDBACK_LINK empty → the "Send feedback" line is omitted entirely.
// A FEEDBACK_LINK that looks like an email becomes a mailto:; otherwise it's used
// as-is (opens in a new tab).
export const AUTHOR_URL = "";
export const FEEDBACK_LINK = "ezdesign.homes@gmail.com";

// Master switch for the feedback/email line (the "Send feedback" link in the Help
// panel's About section, and anywhere else it might appear). Hidden for now but
// kept in the code — flip this to `true` to restore it everywhere. The link string
// and markup are intentionally retained above/below; only this gate is off.
export const SHOW_FEEDBACK = false;

// True when a link string is a bare email address (no scheme), so callers know to
// prefix mailto: and skip target="_blank".
export function isEmail(link: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(link);
}

export function feedbackHref(link: string): string {
  return isEmail(link) ? `mailto:${link}` : link;
}
