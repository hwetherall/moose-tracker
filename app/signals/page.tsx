import { getSignals } from "@/lib/signals";
import { SignalCard } from "@/components/signals/SignalCard";

export const dynamic = "force-dynamic";

const SECTIONS: Array<{ severity: "warning" | "observation" | "info"; title: string }> = [
  { severity: "warning", title: "Warnings" },
  { severity: "observation", title: "Observations" },
  { severity: "info", title: "Information" }
];

export default async function SignalsPage() {
  const signals = await getSignals();

  if (signals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-subtle bg-bg-muted p-8 text-body text-text-tertiary">
        No signals firing right now. Enjoy it.
      </div>
    );
  }

  return (
    <div className="space-y-9">
      {SECTIONS.map((section) => {
        const found = signals.filter((s) => s.severity === section.severity);
        if (found.length === 0) return null;
        return (
          <section key={section.severity}>
            <h2 className="mb-3 font-serif text-section text-text-primary">
              {section.title} <span className="text-text-tertiary">· {found.length}</span>
            </h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {found.map((s) => (
                <SignalCard key={s.id} signal={s} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
