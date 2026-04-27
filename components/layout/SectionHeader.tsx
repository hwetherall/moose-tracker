import Link from "next/link";

export function SectionHeader({
  title,
  subtitle,
  linkText,
  linkHref,
  dense = false
}: {
  title: string;
  subtitle?: React.ReactNode;
  linkText?: string;
  linkHref?: string;
  dense?: boolean;
}) {
  return (
    <div className={`mb-3 flex items-end justify-between gap-4 ${dense ? "border-b border-border-subtle pb-2" : ""}`}>
      <div>
        <h2 className="font-serif text-section text-text-primary">{title}</h2>
        {subtitle && <div className="mt-1 text-compact text-text-secondary">{subtitle}</div>}
      </div>
      {linkHref && linkText && (
        <Link href={linkHref} className="shrink-0 text-compact text-text-secondary hover:text-text-primary">
          {linkText} →
        </Link>
      )}
    </div>
  );
}
