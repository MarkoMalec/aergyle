import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "~/components/ui/card";

export default function AuthShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="game-auth">
      <Link href="/" className="game-brand mb-3" aria-label="Aergyle home">
        <Image
          src="/assets/logo/aergyle-logo.png"
          alt=""
          width={52}
          height={42}
        />
        <span className="game-wordmark">Aergyle</span>
      </Link>
      <p className="game-eyebrow mb-7">Your next chapter awaits</p>
      <Card className="game-auth-card">{children}</Card>
      {footer && <p className="game-auth-links">{footer}</p>}
    </main>
  );
}
