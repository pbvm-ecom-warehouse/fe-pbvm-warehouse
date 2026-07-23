import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

describe("Table scrollable mode", () => {
  it("adds an internal scroll region and sticky header", () => {
    render(
      <Table scrollable aria-label="Danh sách">
        <TableHeader>
          <TableRow>
            <TableHead>Tên</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ly PET</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("table").parentElement).toHaveClass(
      "overflow-auto",
      "max-h-[clamp(20rem,60dvh,42rem)]",
    );
    expect(document.querySelector('[data-slot="table-header"]')).toHaveClass(
      "sticky",
    );
  });
});
