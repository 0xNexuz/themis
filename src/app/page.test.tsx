import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/api/og/status")) {
      return { json: async () => ({ chain: { online: true, blockNumber: "1,234" }, compute: { sdk: true, configured: false }, storage: { sdk: true, configured: false } }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  }));
});

describe("Themis interface", () => {
  it("renders the product message and opens the live proof console", async () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /where intelligence becomes accountable/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /run a proof/i }));
    expect(screen.getByRole("dialog", { name: /proof console/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /adversarial worker/i })).toBeInTheDocument();
  });
});
