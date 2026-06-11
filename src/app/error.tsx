"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="panel grid min-h-80 place-items-center p-8 text-center">
      <div><WarningCircle size={28} className="mx-auto text-negative" /><h2 className="mt-4 text-lg font-medium">This view could not load</h2><p className="mt-2 text-sm text-muted-foreground">The last valid scan remains intact. Retry the view when ready.</p><Button className="mt-5" onClick={reset}>Try again</Button></div>
    </div>
  );
}
