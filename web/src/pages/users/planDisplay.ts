import type { User } from "@/services/users";

/**
 * Small read-only helpers for rendering a user row. They all reach into the
 * same place — the one ACTIVE subscription among however many a user has
 * accumulated — so they belong together rather than scattered through the page.
 */

/** The one subscription that is currently in force, if any. */
function activeSubscription(user: User) {
  return user.subscriptions?.find(s => s.status === "ACTIVE");
}

export function activePlan(user: User) {
  return activeSubscription(user)?.plan?.name ?? "No Plan";
}

/** True when the active plan was granted by an admin rather than paid for. */
export function isFreePlan(user: User) {
  return activeSubscription(user)?.activated_by === "free";
}

export function activeExpiry(user: User) {
  const expiry = activeSubscription(user)?.expiry_date;
  if (!expiry) return "—";
  return formatDate(expiry) ?? "—";
}

export function formatDate(d?: string) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** "1 user" / "3 users" — for the bulk-action copy. */
export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Turns a wallet ledger row's type into something an admin can read. */
export function walletTxLabel(type: string) {
  switch (type) {
    case "TOPUP": return "Money added";
    case "PURCHASE_DEBIT": return "Product purchased";
    case "SALE_CREDIT": return "Product sold";
    case "WITHDRAWAL": return "Withdrawal";
    default: return type;
  }
}
