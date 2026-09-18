import { Skeleton } from "~/components/ui/skeleton";

const SkillLoading = () => (
  <>
    <div className="flex gap-5">
      <div className="w-3/4">
        <main className="space-y-6">
          <div>
            <h1>
              <Skeleton className="w-[88px] max-w-full" />
            </h1>
            <Skeleton className="w-[104px] max-w-full" />
          </div>
          <div className="space-y-4">
            <div className="border border-border">
              <div className="space-y-3 p-3">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-[64px] w-[64px]" />
                  <div className="space-y-1">
                    <h3 className="tracking-tight">
                      <Skeleton className="w-[56px] max-w-full" />
                    </h3>
                    <div>
                      <Skeleton className="w-[240px] max-w-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="border border-border">
              <div className="space-y-3 p-3">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-[64px] w-[64px]" />
                  <div className="space-y-1">
                    <h3 className="tracking-tight">
                      <Skeleton className="w-[72px] max-w-full" />
                    </h3>
                    <div>
                      <Skeleton className="w-[240px] max-w-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <div className="w-2/4">
        <div className="mb-5 flex items-center">
          <div className="h-[1px] w-full bg-border"></div>
          <span className="mx-2">
            <Skeleton className="w-[104px] max-w-full" />
          </span>
          <div className="h-[1px] w-full bg-border"></div>
        </div>
        <div className="mb-6 border border-border p-4">
          <div className="space-y-1">
            <div>
              <Skeleton className="w-[88px] max-w-full" />
            </div>
            <div>
              <Skeleton className="w-[40px] max-w-full" />
            </div>
            <div>
              <Skeleton className="w-[112px] max-w-full" />
            </div>
            <div>
              <Skeleton className="w-[24px] max-w-full" />
            </div>
            <div className="h-2">
              <div className="h-full"></div>
            </div>
          </div>
        </div>
        <div className="mb-5 flex items-center">
          <div className="h-[1px] w-full bg-border"></div>
          <span className="mx-2">
            <Skeleton className="w-[48px] max-w-full" />
          </span>
          <div className="h-[1px] w-full bg-border"></div>
        </div>
        <div className="relative border border-border p-4">
          <div className="absolute -top-2 right-1">
            <div className="flex items-center gap-1">
              <div className="inline-flex items-center border border-transparent px-2.5 py-0.5 transition-colors">
                <Skeleton className="w-[64px] max-w-full" />
              </div>
              <div className="inline-flex items-center border border-transparent p-1 transition-colors">
                <Skeleton className="h-[13px] w-[13px]" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-[64px] w-[64px]" />
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Skeleton className="w-[72px] max-w-full" />
                </div>
              </div>
              <a className="relative block">
                <div className="relative">
                  <div className="h-2"></div>
                  <div className="absolute left-0 top-0 h-full"></div>
                </div>
              </a>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center border border-transparent px-2.5 py-0.5 transition-colors">
                  <Skeleton className="w-[40px] max-w-full" />
                </div>
                <div className="inline-flex items-center border border-transparent px-2.5 py-0.5 transition-colors">
                  <Skeleton className="w-[128px] max-w-full" />
                </div>
                <div className="inline-flex items-center border border-transparent px-2.5 py-0.5 transition-colors">
                  <Skeleton className="w-[72px] max-w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);

export default SkillLoading;
