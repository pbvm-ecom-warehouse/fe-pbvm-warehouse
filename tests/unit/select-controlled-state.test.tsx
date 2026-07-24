import { render, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function TestSelect({ value }: { value: string | undefined }) {
  return (
    <Select value={value} onValueChange={vi.fn()}>
      <SelectTrigger aria-label="Test select">
        <SelectValue placeholder="Chọn" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="A">A</SelectItem>
      </SelectContent>
    </Select>
  );
}

it("keeps Select controlled when a runtime value is temporarily undefined", async () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const view = render(<TestSelect value={undefined} />);

  view.rerender(<TestSelect value="A" />);

  await waitFor(() =>
    expect(
      warning.mock.calls.filter(([message]) =>
        String(message).includes("uncontrolled to controlled"),
      ),
    ).toEqual([]),
  );
  warning.mockRestore();
});
