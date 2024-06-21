import React from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { Loader2Icon } from "lucide-react";

const EquipmentSkeleton = () => {
  return (
    <div className="ml-16 flex w-full gap-10">
      <div className="flex flex-col justify-end space-y-2">
        <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>
      </div>
      <div className="w-full max-w-[280px] space-y-2">
        <div className="flex flex-col items-center justify-center space-y-2">
          <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>
          {/* ROW 2 */}
          <div className="flex w-full justify-between">
            <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>

            <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>

            <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>
          </div>
        </div>
        {/* ROW 3 */}
        <div className="flex justify-between">
          <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>

          <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>

          <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>
        </div>

        <div className="flex justify-between">
          <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>

          <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>
        </div>
        <div className="flex justify-between">
          <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>

          <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>
        </div>
      </div>
      <div className="flex flex-col justify-between gap-2">
        <div className="flex justify-between">
          <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>
        </div>
        <div className="space-y-2">
          <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>

          <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>

          <Skeleton className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"><Loader2Icon className="animate-spin stroke-white" /></Skeleton>
        </div>
      </div>
    </div>
  );
};

export default EquipmentSkeleton;
