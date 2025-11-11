import coinIcon from "assets/ui/coins-icon.png";

interface CoinsIconProps {
  size?: number;
  className?: string;
}

export function CoinsIcon({ size = 23, className = "" }: CoinsIconProps) {
  return (
    <img
      src={coinIcon.src}
      alt="Coins"
      width={size}
      height={size}
      className={`inline-block ${className}`}
    />
  );
}