import { Skeleton } from "~/components/ui/skeleton";

const LoadingSkeleton = () => (
  <>
    <main>
      <h1 className="mb-12">
        <Skeleton className="w-[72px] max-w-full" />
      </h1>
      <div className="mb-10 flex gap-10">
        <div className="relative">
          <Skeleton className="rounded shadow-lg w-[400px] h-[400px]" />
          <div className="absolute left-2 top-2">
            <div className="relative h-12 w-12">
              <Skeleton className="absolute w-full h-full" />
              <div className="absolute flex items-center justify-center">
                <div className="flex h-10 w-10 items-center justify-center">
                  <span>
                    <Skeleton className="w-[16px] max-w-full" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex w-full gap-5">
          <div className="ml-16 flex w-full gap-10">
            <div className="flex flex-col justify-end space-y-2">
              <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                <small>
                  <Skeleton className="w-[48px] max-w-full" />
                </small>
              </div>
            </div>
            <div className="w-full max-w-[280px] space-y-2">
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                  <div className="flex h-[62px] w-[62px] items-center justify-center">
                    <div className="relative h-full w-full">
                      <Skeleton className="rounded w-[102px] h-[102px]" />
                    </div>
                  </div>
                </div>
                <div className="flex w-full justify-between">
                  <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                    <div className="flex h-[62px] w-[62px] items-center justify-center">
                      <div className="relative h-full w-full">
                        <Skeleton className="rounded w-[102px] h-[102px]" />
                      </div>
                    </div>
                  </div>
                  <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                    <div className="flex h-[62px] w-[62px] items-center justify-center">
                      <div className="relative h-full w-full">
                        <Skeleton className="rounded w-[102px] h-[102px]" />
                      </div>
                    </div>
                  </div>
                  <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                    <div className="flex h-[62px] w-[62px] items-center justify-center">
                      <div className="relative h-full w-full">
                        <Skeleton className="rounded w-[102px] h-[102px]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                  <small>
                    <Skeleton className="w-[56px] max-w-full" />
                  </small>
                </div>
                <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                  <div className="flex h-[62px] w-[62px] items-center justify-center">
                    <div className="relative h-full w-full">
                      <Skeleton className="rounded w-[102px] h-[102px]" />
                    </div>
                  </div>
                </div>
                <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                  <small>
                    <Skeleton className="w-[56px] max-w-full" />
                  </small>
                </div>
              </div>
              <div className="flex justify-between">
                <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                  <div className="flex h-[62px] w-[62px] items-center justify-center">
                    <div className="relative h-full w-full">
                      <Skeleton className="rounded w-[102px] h-[102px]" />
                    </div>
                  </div>
                </div>
                <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                  <div className="flex h-[62px] w-[62px] items-center justify-center">
                    <div className="relative h-full w-full">
                      <Skeleton className="rounded w-[102px] h-[102px]" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                  <small>
                    <Skeleton className="w-[56px] max-w-full" />
                  </small>
                </div>
                <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                  <div className="flex h-[62px] w-[62px] items-center justify-center">
                    <div className="relative h-full w-full">
                      <Skeleton className="rounded w-[102px] h-[102px]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-between gap-2">
              <div className="flex justify-between">
                <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                  <div className="flex h-[62px] w-[62px] items-center justify-center">
                    <div className="relative h-full w-full">
                      <Skeleton className="rounded w-[102px] h-[102px]" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                  <div className="flex h-[62px] w-[62px] items-center justify-center">
                    <div className="relative h-full w-full">
                      <Skeleton className="rounded w-[102px] h-[102px]" />
                    </div>
                  </div>
                </div>
                <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                  <div className="flex h-[62px] w-[62px] items-center justify-center">
                    <div className="relative h-full w-full">
                      <Skeleton className="rounded w-[102px] h-[102px]" />
                    </div>
                  </div>
                </div>
                <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
                  <div className="flex h-[62px] w-[62px] items-center justify-center">
                    <div className="relative h-full w-full">
                      <Skeleton className="rounded w-[102px] h-[102px]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <div className="flex h-[62px] w-[62px] items-center justify-center">
              <div className="relative h-full w-full">
                <Skeleton className="rounded w-[102px] h-[102px]" />
                <div className="absolute -left-1 -top-2 flex items-center justify-center border px-2">
                  <Skeleton className="w-[32px] max-w-full" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <div className="flex h-[62px] w-[62px] items-center justify-center">
              <div className="relative h-full w-full">
                <Skeleton className="rounded w-[102px] h-[102px]" />
              </div>
            </div>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <div className="flex h-[62px] w-[62px] items-center justify-center">
              <div className="relative h-full w-full">
                <Skeleton className="rounded w-[102px] h-[102px]" />
                <div className="absolute -left-1 -top-2 flex items-center justify-center border px-2">
                  <Skeleton className="w-[32px] max-w-full" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <div className="flex h-[62px] w-[62px] items-center justify-center">
              <div className="relative h-full w-full">
                <Skeleton className="rounded w-[102px] h-[102px]" />
                <div className="absolute -left-1 -top-2 flex items-center justify-center border px-2">
                  <Skeleton className="w-[32px] max-w-full" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <div className="flex h-[62px] w-[62px] items-center justify-center">
              <div className="relative h-full w-full">
                <Skeleton className="rounded w-[102px] h-[102px]" />
              </div>
            </div>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <div className="flex h-[62px] w-[62px] items-center justify-center">
              <div className="relative h-full w-full">
                <Skeleton className="rounded w-[102px] h-[102px]" />
              </div>
            </div>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <div className="flex h-[62px] w-[62px] items-center justify-center">
              <div className="relative h-full w-full">
                <Skeleton className="rounded w-[102px] h-[102px]" />
              </div>
            </div>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <div className="flex h-[62px] w-[62px] items-center justify-center">
              <div className="relative h-full w-full">
                <Skeleton className="rounded w-[102px] h-[102px]" />
              </div>
            </div>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
          <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg relative">
            <small></small>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div>
            <Skeleton className="w-[96px] max-w-full" />
          </div>
          <div className="relative">
            <div className="flex h-[62px] w-[62px] items-center justify-center shadow-lg border-2 border-red-500/30 relative">
              <small></small>
            </div>
            <div className="absolute flex items-center justify-center">
              <Skeleton className="w-[24px] h-[24px]" />
            </div>
          </div>
        </div>
      </div>
      <div className="my-8 w-full border border-white/10 p-2">
        <div className="p-2">
          <h3 className="tracking-tight mb-4">
            <Skeleton className="w-[120px] max-w-full" />
          </h3>
          <div className="shrink-0 bg-border h-[1px] w-full mb-4"></div>
          <div className="flex flex-col justify-between gap-6 md:flex-row">
            <div className="mb-4">
              <h3 className="mb-2">
                <Skeleton className="w-[72px] max-w-full" />
              </h3>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[48px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[32px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[32px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[32px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[152px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[40px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[136px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[40px] max-w-full" />
                  </span>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <h3 className="mb-2">
                <Skeleton className="w-[72px] max-w-full" />
              </h3>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[168px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[14px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[168px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[14px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[14px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[144px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[24px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[14px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[144px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[24px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[120px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[48px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[120px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[48px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[14px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[96px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[40px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[64px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[16px] max-w-full" />
                  </span>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <h3 className="mb-2">
                <Skeleton className="w-[72px] max-w-full" />
              </h3>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[24px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[40px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[32px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[96px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[24px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[120px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[48px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[128px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[32px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[120px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[32px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[24px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[96px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[32px] max-w-full" />
                  </span>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <h3 className="mb-2">
                <Skeleton className="w-[80px] max-w-full" />
              </h3>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[120px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[48px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[120px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[32px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[14px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[160px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[32px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[136px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[32px] max-w-full" />
                  </span>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <h3 className="mb-2">
                <Skeleton className="w-[56px] max-w-full" />
              </h3>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[104px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[14px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[112px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[48px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[32px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[16px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[72px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[48px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[14px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[120px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[48px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[72px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[32px] max-w-full" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <span>
                      <Skeleton className="w-[16px] max-w-full" />
                    </span>
                    <span>
                      <Skeleton className="w-[48px] max-w-full" />
                    </span>
                  </div>
                  <span>
                    <Skeleton className="w-[14px] max-w-full" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <Skeleton className="w-[1608px] max-w-full" />
      </div>
      <div className="my-8 flex gap-4">
        <div className="border p-6 shadow-sm">
          <h3 className="mb-4">
            <Skeleton className="w-[240px] max-w-full" />
          </h3>
          <form className="space-y-4">
            <div className="space-y-2">
              <label className="leading-none">
                <Skeleton className="w-[88px] max-w-full" />
              </label>
              <div className="flex h-9 w-full items-center justify-between border px-3 py-2 shadow-sm [&amp;&gt;span]:line-clamp-1">
                <span>
                  <Skeleton className="w-[136px] max-w-full" />
                </span>
                <Skeleton className="w-[15px] h-[15px]" />
              </div>
              <p>
                <Skeleton className="w-[256px] max-w-full" />
              </p>
            </div>
            <div className="space-y-2">
              <label className="leading-none">
                <Skeleton className="w-[104px] max-w-full" />
              </label>
              <div className="flex h-9 w-full items-center justify-between border px-3 py-2 shadow-sm [&amp;&gt;span]:line-clamp-1">
                <span>
                  <Skeleton className="w-[48px] max-w-full" />
                </span>
                <Skeleton className="w-[15px] h-[15px]" />
              </div>
              <p>
                <Skeleton className="w-[320px] max-w-full" />
              </p>
            </div>
            <div className="inline-flex items-center justify-center transition-colors h-9 px-4 py-2 w-full">
              <Skeleton className="w-[168px] max-w-full" />
            </div>
          </form>
        </div>
      </div>
    </main>
  </>
);

export default LoadingSkeleton;