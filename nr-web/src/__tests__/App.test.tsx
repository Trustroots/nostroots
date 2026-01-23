import { describe, it, expect } from "vitest";
import { render, renderWithUser, screen } from "@/test/test-utils";
import App from "../App";

describe("App", () => {
  it("renders the app header", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /nr web app/i })).toBeInTheDocument();
  });

  it("renders the counter component by default", () => {
    render(<App />);
    expect(screen.getByRole("group", { name: /counter/i })).toBeInTheDocument();
  });

  it("renders the toggle button", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /hide counter/i })).toBeInTheDocument();
  });

  it("hides the counter when toggle button is clicked", async () => {
    const { user } = renderWithUser(<App />);

    // Counter should be visible initially
    expect(screen.getByRole("group", { name: /counter/i })).toBeInTheDocument();

    // Click toggle button
    await user.click(screen.getByRole("button", { name: /hide counter/i }));

    // Counter should be hidden
    expect(screen.queryByRole("group", { name: /counter/i })).not.toBeInTheDocument();

    // Button text should change
    expect(screen.getByRole("button", { name: /show counter/i })).toBeInTheDocument();
  });

  it("shows the counter again when toggle button is clicked twice", async () => {
    const { user } = renderWithUser(<App />);

    // Hide counter
    await user.click(screen.getByRole("button", { name: /hide counter/i }));
    expect(screen.queryByRole("group", { name: /counter/i })).not.toBeInTheDocument();

    // Show counter again
    await user.click(screen.getByRole("button", { name: /show counter/i }));
    expect(screen.getByRole("group", { name: /counter/i })).toBeInTheDocument();
  });
});
