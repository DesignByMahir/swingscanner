import { PageHeader } from "@/components/shared";
import { SetupCoachView } from "@/components/setup-coach-view";

export const metadata = { title: "Setup Coach" };

export default function SetupCoachPage() {
  return (
    <>
      <PageHeader eyebrow="Local Gemma analyst" title="Setup coach" description="Choose any candidate from the latest completed scan and question its trigger, thesis, risks, and invalidation in one place." />
      <SetupCoachView />
    </>
  );
}
