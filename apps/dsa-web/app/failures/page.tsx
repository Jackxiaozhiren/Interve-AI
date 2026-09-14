import { PageHeader } from "@/app/components/data/PageHeader";
import { StubEmptyState } from "@/app/components/data/StateBlocks";
import { Card } from "@/app/components/ui/card";

export default function FailuresPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 3 · Inspect the evidence"
        title="Failures"
        description="Failed runs triage. Placeholder shell — inspect live traces under Analysis."
      />
      <Card className="p-0"><StubEmptyState backHref="/analysis" backLabel="Go to Analysis" /></Card>
    </div>
  );
}
