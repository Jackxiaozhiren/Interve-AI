import Link from "next/link";
import { BookOpen, FileText, FlaskConical } from "lucide-react";
import { PageHeader } from "@/app/components/data/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

export default function ResearchPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 2 · Research method"
        title="Research"
        description="How DSA keeps every claim traceable: plan, tools, confidence, sources, and dataset hash."
        actions={<Link href="/analysis" className={cn(buttonVariants({ size: "sm" }))}><FlaskConical className="h-4 w-4" aria-hidden /> Try it →</Link>}
      />
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { icon: BookOpen, t: "Evidence-first", d: "No claim without confidence, sources, and the tool that produced it." },
          { icon: FileText, t: "Reproducible reports", d: "Markdown reports copy verbatim; runs replay end-to-end." },
          { icon: FlaskConical, t: "Measured, not vibes", d: "Benchmarks track task success, evidence, and SQL accuracy V1 vs V2." },
        ].map((c) => (
          <Card key={c.t}>
            <CardHeader><CardTitle className="flex items-center gap-2"><c.icon className="h-4 w-4" aria-hidden />{c.t}</CardTitle></CardHeader>
            <CardContent><p className="text-sm leading-6 text-zinc-600">{c.d}</p></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Reading path</CardTitle>
          <CardDescription>Step 1 Bring → Step 2 Ask → Step 3 Inspect.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/datasets" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>1 · Datasets</Link>
          <Link href="/analysis" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>2 · Analysis</Link>
          <Link href="/runs" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>3 · Runs & replay</Link>
          <Link href="/benchmarks" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Benchmarks</Link>
        </CardContent>
      </Card>
    </div>
  );
}
