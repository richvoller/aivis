import { Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NoBrand } from "@/components/no-brand";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentBrand } from "@/lib/current-brand";
import { getFanOutQueries } from "@/lib/queries";

export default async function FanOutPage() {
  const brand = await getCurrentBrand();
  if (!brand) {
    return (
      <>
        <PageHeader title="Fan-Out Queries" />
        <NoBrand />
      </>
    );
  }

  const queries = await getFanOutQueries(brand.id);

  return (
    <>
      <PageHeader
        title="Fan-Out Queries"
        description="The internal research queries LLMs generate before answering — keyword targeting opportunities."
      />

      {queries.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No fan-out queries yet"
          description="Collect responses to surface the queries LLMs run behind the scenes."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Query</TableHead>
                  <TableHead className="w-32">Occurrences</TableHead>
                  <TableHead className="w-32">Prompts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queries.map((q) => (
                  <TableRow key={q.query}>
                    <TableCell className="font-medium">{q.query}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{q.count}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{q.promptCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
