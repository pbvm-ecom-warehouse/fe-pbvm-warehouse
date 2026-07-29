import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EntityDetailDialog } from "@/features/admin-shell/components/entity-detail-dialog";

describe("EntityDetailDialog", () => {
  it("keeps the header fixed and scrolls only the detail body", () => {
    render(
      <EntityDetailDialog
        open
        title="Chi tiết phiếu"
        description="Thông tin nội bộ"
        onOpenChange={vi.fn()}
      >
        <div>Nội dung dài</div>
      </EntityDetailDialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Chi tiết phiếu" });
    expect(dialog).toHaveClass("overflow-hidden");
    expect(dialog).toHaveClass("h-[calc(100dvh-1rem)]");
    expect(
      dialog.querySelector('[data-slot="entity-detail-body"]'),
    ).toHaveClass("overflow-y-auto");
    expect(
      dialog.querySelector('[data-slot="entity-detail-header"]'),
    ).toHaveClass("shrink-0");
  });

  it("closes through the accessible close button and restores focus", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button onClick={() => setOpen(true)} type="button">
            Mở chi tiết
          </button>
          <EntityDetailDialog
            open={open}
            title="Chi tiết phiếu"
            description="Thông tin nội bộ"
            onOpenChange={setOpen}
          >
            Nội dung
          </EntityDetailDialog>
        </>
      );
    }

    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Mở chi tiết" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
