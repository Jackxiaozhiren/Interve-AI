import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ErrorState } from "@/app/components/data/StateBlocks";

describe("ErrorState de-tagging", () => {
  it("strips HTML tags from the message", () => {
    render(<ErrorState message="<b>API</b> 500: <img src=x onerror=boom>down" />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("API 500: down");
    expect(alert.querySelector("img")).toBeNull();
    expect(alert.querySelector("b")).toBeNull();
  });

  it("never injects script elements", () => {
    render(<ErrorState message="<script>alert(1)</script>failed" />);
    expect(screen.getByRole("alert").querySelector("script")).toBeNull();
  });

  it("falls back when the message is empty", () => {
    render(<ErrorState message="" />);
    expect(screen.getByRole("alert").textContent).toContain("Request failed");
  });

  it("wires the Retry button", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="boom" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
