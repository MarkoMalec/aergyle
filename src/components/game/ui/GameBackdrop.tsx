/**
 * The patterned field the game shell sits on: a map grid with a fine diagonal
 * weave, fixed to the viewport so it stays put while a page scrolls, and faded
 * out in a circle towards the bottom-right corner. Both the pattern and the
 * falloff live in tailwind.config.ts as `bg-game-weave` / `mask-weave-fade`.
 */
export default function GameBackdrop() {
  return (
    <div
      aria-hidden
      className="mask-weave-fade pointer-events-none fixed inset-0 -z-10 bg-game-weave"
    />
  );
}
