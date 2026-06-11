import { EmptyState, TextLink } from "@/components/shared";

export default function NotFound() {
  return <><EmptyState title="Setup not found" description="That ticker is not in the current modeled scan universe." /><div className="mt-4 text-center"><TextLink href="/scanner">Return to scanner</TextLink></div></>;
}
