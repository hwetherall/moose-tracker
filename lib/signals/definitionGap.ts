import type { SignalCheck } from "./types";

const IN_DEV = new Set(["1-InDev", "1-InDevPrompt"]);

/**
 * Fires when in-dev items have no Definition of Done.
 */
export const definitionGap: SignalCheck = ({ items }) => {
  const missing = items.filter((i) => IN_DEV.has(i.status) && !i.dod);
  if (missing.length === 0) return [];
  return [
    {
      id: "definition-gap",
      severity: "info",
      title: "Definition gap",
      body: `${missing.length} in-dev ${missing.length === 1 ? "item has" : "items have"} no Definition of Done. They will be hard to land cleanly.`,
      affectedItemIds: missing.map((m) => m.id),
      actionLabel: `View ${missing.length} ${missing.length === 1 ? "item" : "items"}`,
      actionHref: "/items?status=1-InDev,1-InDevPrompt"
    }
  ];
};
