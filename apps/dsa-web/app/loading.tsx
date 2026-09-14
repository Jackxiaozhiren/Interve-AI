import { PageSkeleton } from "@/app/components/data/StateBlocks";
import { Card } from "@/app/components/ui/card";

// Source: shadcn/ui Skeleton convention
export default function Loading() {
  return (
    <Card className="p-5">
      <PageSkeleton rows={4} />
    </Card>
  );
}
