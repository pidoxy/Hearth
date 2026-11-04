"use client";
import { useState } from "react";
import type { Person } from "@/lib/types";
import { PlusIcon } from "./icons";
import { ItemEditor } from "./item-editor";

export function NewItemButton({ people, defaultDate, label = "New" }: { people: Person[]; defaultDate: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(true)}>
        <PlusIcon size={18} /> {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New item"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-lg sm:rounded-3xl animate-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="h-display mb-5 text-2xl">Add to calendar</h2>
            <ItemEditor people={people} defaultDate={defaultDate} onDone={() => setOpen(false)} submitLabel="Add" />
          </div>
        </div>
      )}
    </>
  );
}
