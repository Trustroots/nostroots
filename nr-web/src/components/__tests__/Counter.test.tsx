import { describe, it, expect, vi } from "vitest";
import { render, renderWithUser, screen } from "@/test/test-utils";
import { Counter } from "../Counter";

describe("Counter", () => {
  describe("rendering", () => {
    it("renders with default initial value of 0", () => {
      render(<Counter />);
      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("renders with custom initial value", () => {
      render(<Counter initialValue={10} />);
      expect(screen.getByText("10")).toBeInTheDocument();
    });

    it("renders increment and decrement buttons", () => {
      render(<Counter />);
      expect(screen.getByRole("button", { name: /increment/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /decrement/i })).toBeInTheDocument();
    });

    it("renders reset button", () => {
      render(<Counter />);
      expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    });

    it("has correct accessibility attributes", () => {
      render(<Counter />);
      expect(screen.getByRole("group", { name: /counter/i })).toBeInTheDocument();
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  describe("incrementing", () => {
    it("increments the count by 1 by default", async () => {
      const { user } = renderWithUser(<Counter />);

      await user.click(screen.getByRole("button", { name: /increment/i }));

      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("increments by custom step", async () => {
      const { user } = renderWithUser(<Counter step={5} />);

      await user.click(screen.getByRole("button", { name: /increment/i }));

      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("does not increment past max value", async () => {
      const { user } = renderWithUser(<Counter initialValue={9} max={10} />);

      await user.click(screen.getByRole("button", { name: /increment/i }));

      expect(screen.getByText("10")).toBeInTheDocument();

      // Button should be disabled at max
      expect(screen.getByRole("button", { name: /increment/i })).toBeDisabled();
    });
  });

  describe("decrementing", () => {
    it("decrements the count by 1 by default", async () => {
      const { user } = renderWithUser(<Counter initialValue={5} />);

      await user.click(screen.getByRole("button", { name: /decrement/i }));

      expect(screen.getByText("4")).toBeInTheDocument();
    });

    it("decrements by custom step", async () => {
      const { user } = renderWithUser(<Counter initialValue={10} step={5} />);

      await user.click(screen.getByRole("button", { name: /decrement/i }));

      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("does not decrement past min value", async () => {
      const { user } = renderWithUser(<Counter initialValue={1} min={0} />);

      await user.click(screen.getByRole("button", { name: /decrement/i }));

      expect(screen.getByText("0")).toBeInTheDocument();

      // Button should be disabled at min
      expect(screen.getByRole("button", { name: /decrement/i })).toBeDisabled();
    });
  });

  describe("resetting", () => {
    it("resets to initial value", async () => {
      const { user } = renderWithUser(<Counter initialValue={5} />);

      // Increment a few times
      await user.click(screen.getByRole("button", { name: /increment/i }));
      await user.click(screen.getByRole("button", { name: /increment/i }));
      expect(screen.getByText("7")).toBeInTheDocument();

      // Reset
      await user.click(screen.getByRole("button", { name: /reset/i }));

      expect(screen.getByText("5")).toBeInTheDocument();
    });
  });

  describe("onChange callback", () => {
    it("calls onChange when incrementing", async () => {
      const handleChange = vi.fn();
      const { user } = renderWithUser(<Counter onChange={handleChange} />);

      await user.click(screen.getByRole("button", { name: /increment/i }));

      expect(handleChange).toHaveBeenCalledWith(1);
    });

    it("calls onChange when decrementing", async () => {
      const handleChange = vi.fn();
      const { user } = renderWithUser(<Counter initialValue={5} onChange={handleChange} />);

      await user.click(screen.getByRole("button", { name: /decrement/i }));

      expect(handleChange).toHaveBeenCalledWith(4);
    });

    it("calls onChange when resetting", async () => {
      const handleChange = vi.fn();
      const { user } = renderWithUser(<Counter initialValue={5} onChange={handleChange} />);

      await user.click(screen.getByRole("button", { name: /increment/i }));
      await user.click(screen.getByRole("button", { name: /reset/i }));

      expect(handleChange).toHaveBeenLastCalledWith(5);
    });

    it("does not call onChange when value would exceed limits", async () => {
      const handleChange = vi.fn();
      const { user } = renderWithUser(
        <Counter initialValue={10} max={10} onChange={handleChange} />
      );

      // Try to increment past max - button should be disabled
      const incrementButton = screen.getByRole("button", { name: /increment/i });
      expect(incrementButton).toBeDisabled();

      // handleChange should not have been called
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("handles negative initial values", () => {
      render(<Counter initialValue={-5} />);
      expect(screen.getByText("-5")).toBeInTheDocument();
    });

    it("clamps initial value to min/max range", async () => {
      const { user } = renderWithUser(<Counter initialValue={0} min={0} max={5} />);

      // Decrement should be disabled at min
      expect(screen.getByRole("button", { name: /decrement/i })).toBeDisabled();

      // Increment to max
      for (let i = 0; i < 5; i++) {
        await user.click(screen.getByRole("button", { name: /increment/i }));
      }

      // Increment should now be disabled
      expect(screen.getByRole("button", { name: /increment/i })).toBeDisabled();
      expect(screen.getByText("5")).toBeInTheDocument();
    });
  });
});
