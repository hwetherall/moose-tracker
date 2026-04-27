import type { SignalCheck } from "./types";

const ACTIVE = new Set(["1-InDev", "1-InDevPrompt", "2-ReadyForDev"]);

/**
 * Fires when active items have no Responsible owner.
 */
export const ownershipGap: SignalCheck = ({ items }) => {
  const missing = items.filter((i) => ACTIVE.has(i.status) && i.r_emails.length === 0);
  if (missing.length === 0) return [];
  return [
    {
      id: "ownership-gap",
      severity: "warning",
      title: "Ownership gap",
      body: `${missing.length} active ${missing.length === 1 ? "item has" : "items have"} no Responsible owner.`,
      affectedItemIds: missing.map((m) => m.id),
      actionLabel: `View ${missing.length} ${missing.length === 1 ? "item" : "items"}`,
      actionHref: "/items?status=1-InDev,1-InDevPrompt,2-ReadyForDev"
    }
  ];
};
