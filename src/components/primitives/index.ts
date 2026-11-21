/**
 * Primitive layer (§12.10) — the single source of every basic control.
 *
 * S2 rule: "同名只允许一份实现". The implementations live in the pre-existing
 * `ui/` directory (47 import sites would break on a physical move, and a move
 * is a rename, not a consolidation); this barrel is the layer boundary. New
 * code imports from here, never from `ui/` directly, and a contract test
 * (s2-layering.test.ts) enforces direction: domain → pattern → primitive.
 */
export { Button, buttonVariants } from "@/components/ui/button";
export { Input } from "@/components/ui/input";
export { Textarea } from "@/components/ui/textarea";
export { Label } from "@/components/ui/label";
export { Badge } from "@/components/ui/badge";
export { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
export { Separator } from "@/components/ui/separator";
export { Skeleton } from "@/components/ui/skeleton";
export { Table } from "@/components/ui/table";
export { Tabs } from "@/components/ui/tabs";
export { Tooltip } from "@/components/ui/tooltip";
