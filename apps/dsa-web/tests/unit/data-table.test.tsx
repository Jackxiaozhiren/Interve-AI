import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  DataTable,
  type DataTableColumn,
} from "@/app/components/data/DataTable";

interface Row {
  id: string;
  name: string;
  score: number;
}

const columns: DataTableColumn<Row>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
    render: (r) => r.name,
  },
  {
    key: "score",
    header: "Score",
    sortable: true,
    render: (r) => String(r.score),
    sortValue: (r) => r.score,
  },
];

const rows: Row[] = [
  { id: "b", name: "Beta", score: 70 },
  { id: "a", name: "Alpha", score: 92 },
  { id: "c", name: "Gamma", score: 61 },
];

function cellTexts(): string[] {
  return screen.getAllByRole("cell").map((c) => c.textContent ?? "");
}

describe("DataTable sorting", () => {
  it("renders rows in input order before sorting", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(cellTexts()).toEqual(["Beta", "70", "Alpha", "92", "Gamma", "61"]);
  });

  it("sorts ascending then descending on header click (string column)", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Sort by Name" }));
    expect(cellTexts()).toEqual(["Alpha", "92", "Beta", "70", "Gamma", "61"]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by Name" }));
    expect(cellTexts()).toEqual(["Gamma", "61", "Beta", "70", "Alpha", "92"]);
  });

  it("sorts numerically via sortValue", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Sort by Score" }));
    expect(cellTexts()).toEqual(["Gamma", "61", "Beta", "70", "Alpha", "92"]);
  });

  it("renders the empty state when rows are empty", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyTitle="No datasets yet"
        emptyDescription="Upload one to begin."
      />,
    );
    expect(screen.getByText("No datasets yet")).toBeTruthy();
    expect(screen.getByText("Upload one to begin.")).toBeTruthy();
    expect(screen.queryAllByRole("cell")).toHaveLength(0);
  });
});
