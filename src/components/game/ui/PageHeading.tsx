import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

export default function PageHeading({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("game-page-heading", className)}>
      <div>
        <p className="game-eyebrow">{eyebrow}</p>
        <h1 className="game-page-title">{title}</h1>
        {description && <p className="game-page-description">{description}</p>}
      </div>
      {children}
    </div>
  );
}
