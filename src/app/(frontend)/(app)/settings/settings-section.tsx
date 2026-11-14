import type { ReactNode } from "react";
import { Skeleton } from "@/ui/primitives/skeleton";
import { Surface } from "@/app/_components/product";

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Surface className="grid gap-5">
      <header className="grid gap-1.5">
        <h2 className="text-base font-medium">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </header>
      {children}
    </Surface>
  );
}

export function SettingsLoading({ label }: { label: string }) {
  return (
    <div role="status" className="grid gap-4">
      <span className="sr-only">{label}</span>
      <Surface className="grid gap-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-32" />
      </Surface>
      <Surface className="grid gap-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-11 w-full" />
      </Surface>
    </div>
  );
}
