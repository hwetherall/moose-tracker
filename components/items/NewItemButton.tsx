"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NewItemModal } from "./NewItemModal";

export function NewItemButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-test-id="new-item-button"
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-body text-text-secondary hover:bg-bg-muted hover:text-text-primary"
      >
        <Plus className="h-3 w-3" />
        New
      </button>
      <NewItemModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
