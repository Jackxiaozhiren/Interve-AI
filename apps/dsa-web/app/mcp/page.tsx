import { PageHeader } from "@/app/components/data/PageHeader";
import { StubEmptyState } from "@/app/components/data/StateBlocks";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";

export default function McpPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 2 · Ask your question"
        title="MCP"
        description="Model Context Protocol tools backing every traced call. Placeholder shell."
      />
      <Card>
        <CardHeader><CardTitle>Tool surface (planned)</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-zinc-600">
            <li>sql_query · dataset read with call_id + duration</li>
            <li>evidence_link · claim → source + confidence</li>
            <li>report_build · Markdown + artifacts</li>
          </ul>
        </CardContent>
      </Card>
      <Card className="p-0"><StubEmptyState backHref="/analysis" backLabel="Go to Analysis" /></Card>
    </div>
  );
}
