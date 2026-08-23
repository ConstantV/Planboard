import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateCategory, deactivateCategory } from "../../api/entities";
import type { EntityCategory } from "../../types/api";
import { CategoryManager } from "./CategoryManager";

vi.mock("../../api/entities", () => ({
  createCategory: vi.fn(), updateCategory: vi.fn(), deactivateCategory: vi.fn(),
}));
const timestamp = "2026-08-23T12:00:00Z";
const categories: EntityCategory[] = [
  { id: "root", name: "Materieel", parent_id: null, color: "#112233", is_active: true, path: ["Materieel"], created_at: timestamp, updated_at: timestamp },
  { id: "child", name: "Camera's", parent_id: "root", color: null, is_active: true, path: ["Materieel", "Camera's"], created_at: timestamp, updated_at: timestamp },
];

describe("CategoryManager", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sluit zichzelf en afstammelingen uit als nieuwe ouder", async () => {
    const user = userEvent.setup();
    render(<CategoryManager categories={categories} saving={false} mutate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Materieel bewerken" }));

    const parent = screen.getByLabelText("Bovenliggende categorie");
    expect(within(parent).queryByRole("option", { name: "Materieel" })).not.toBeInTheDocument();
    expect(within(parent).queryByRole("option", { name: "Materieel › Camera's" })).not.toBeInTheDocument();
  });

  it("verplaatst en archiveert categorieën via bevestigde beheeracties", async () => {
    const user = userEvent.setup();
    const mutate = vi.fn(async (operation: () => Promise<unknown>) => { await operation(); return true; });
    vi.mocked(updateCategory).mockResolvedValue(categories[1]);
    vi.mocked(deactivateCategory).mockResolvedValue(categories[1]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CategoryManager categories={categories} saving={false} mutate={mutate} />);

    await user.click(screen.getByRole("button", { name: "Camera's bewerken" }));
    await user.selectOptions(screen.getByLabelText("Bovenliggende categorie"), "");
    await user.click(screen.getByRole("button", { name: "Categorie bijwerken" }));
    expect(updateCategory).toHaveBeenCalledWith("child", { name: "Camera's", parent_id: null, color: null });

    await user.click(screen.getByRole("button", { name: "Camera's archiveren" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(deactivateCategory).toHaveBeenCalledWith("child");
  });
});
