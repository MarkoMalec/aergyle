import type { ItemRarity } from "~/generated/prisma/enums";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";

/** The items an expedition or dungeon run brought back. */
export function RewardHaul({
  rewards,
}: {
  rewards: ReadonlyArray<{
    itemId: number;
    name: string;
    sprite: string;
    rarity: ItemRarity;
    quantity: number;
  }>;
}) {
  return (
    <div className="gathering-haul-grid">
      {rewards.map((reward) => (
        <div className="gathering-haul-item" key={reward.itemId}>
          <ItemArtwork
            src={reward.sprite}
            name={reward.name}
            rarity={reward.rarity}
            size={60}
            itemId={reward.itemId}
          />
          <div className="min-w-0">
            <strong>{reward.name}</strong>
            <span>×{reward.quantity}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
