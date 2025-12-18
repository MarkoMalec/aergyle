"use client";

import { useVocationalActiveAction } from "~/components/game/actions/useVocationalActiveAction";
import { ActionFillBar } from "~/components/game/actions/ActionFillBar";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";
import { formatDuration } from "~/components/game/actions/format";
import { X } from "lucide-react";
import Image from "next/image";

const SkillsLayout = ({ children }: { children: React.ReactNode }) => {
  const { active, viewModel, stop } = useVocationalActiveAction();

  return (
    <div className="flex gap-5">
      <div className="w-3/4">{children}</div>
      <div className="w-2/4">
        {active && viewModel ? (
          <>
            <Separator className="mb-5 text-sm">ACTIVE</Separator>
            <div className="relative rounded-lg border border-gray-700/40 bg-gray-800 p-4">
              <div className="absolute -top-2 right-1">
                <div className="flex items-center gap-1">
                  <Badge className="bg-gray-700/60">
                    {formatDuration(viewModel.sessionRemainingSeconds)}
                  </Badge>
                  <Badge
                    onClick={stop}
                    className="cursor-pointer bg-gray-700/60 p-1"
                  >
                    <X size={13} />
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Image src={viewModel.sprite} alt="" width={1080} height={1080} className="w-14 h-14" />
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-medium">{viewModel.label}</p>
                    </div>
                  </div>
                  <ActionFillBar
                    value={viewModel.progress}
                    sessionAmount={viewModel.sessionAmount}
                    title={viewModel.label}
                    href={viewModel.href}
                    sprite={viewModel.sprite}
                    trackClassName="bg-white/10"
                    variant="simple"
                  />
                  <div className="flex items-center gap-2">
                    <Badge className="bg-gray-700/60 tabular-nums">
                      + {viewModel.sessionAmount}
                    </Badge>
                    <Badge className="bg-gray-700/60">
                      Next item in: {viewModel.nextItemInSeconds}s
                    </Badge>
                    {/* How can I calculate xp per second for this? */}

                    <Badge className="bg-gray-700/60">
                      {viewModel.xpPerSecond} XP/s
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default SkillsLayout;
