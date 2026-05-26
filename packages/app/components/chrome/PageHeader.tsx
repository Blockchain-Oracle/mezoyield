import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: ReactNode;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header className="space-y-2">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-mezo">
        {eyebrow}
      </p>
      <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
        {title}
      </h1>
      {description && (
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      )}
    </header>
  );
}
