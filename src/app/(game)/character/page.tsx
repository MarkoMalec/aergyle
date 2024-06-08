import React from "react";
import Inventory from "~/components/game/character/Inventory/Inventory";
import Portrait from "~/components/game/character/Portrait";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

const CharacterPage = async () => {
  return (
    <main>
      <h1 className="mb-20 text-center text-5xl font-bold text-black">
        Character
      </h1>
      <div className="mb-10 flex gap-10">
        <Portrait />
        <Card className="w-full border-none bg-white/5">
          <CardHeader>
            <CardTitle>Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-5 text-white">
              <ul>
                <li>Minimum hit</li>
                <li>Maximum hit</li>
                <li>Chance to Hit</li>
                <li>Accuracy</li>
                <li>Damage Reduction</li>
              </ul>
              <ul>
                <li>Evasion (Melee)</li>
                <li>Evasion (Ranged)</li>
                <li>Evasion (Magic)</li>
              </ul>
              <ul>
                <li>Prayer Points</li>
                <li>Active Prayers</li>
              </ul>
            </ul>
          </CardContent>
        </Card>
      </div>
      <Inventory />
    </main>
  );
};

export default CharacterPage;
