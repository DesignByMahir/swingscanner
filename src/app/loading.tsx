import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="border-b pb-6"><Skeleton className="h-3 w-28" /><Skeleton className="mt-4 h-9 w-72" /><Skeleton className="mt-3 h-4 w-full max-w-xl" /></div>
      <div className="grid gap-5 xl:grid-cols-2"><Skeleton className="h-[420px] rounded-xl" /><Skeleton className="h-[420px] rounded-xl" /></div>
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
