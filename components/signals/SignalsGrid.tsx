import { SignalCard } from "./SignalCard";
import { SectionHeader } from "@/components/layout/SectionHeader";
import type { Signal } from "@/lib/signals";

export function SignalsGrid({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) return null;
  return (
    <section data-test-id="signals-section">
      <SectionHeader
        title="Signals"
        linkText={`See all ${signals.length}`}
        linkHref="/signals"
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {signals.slice(0, 4).map((s) => (
          <SignalCard key={s.id} signal={s} />
        ))}
      </div>
    </section>
  );
}
