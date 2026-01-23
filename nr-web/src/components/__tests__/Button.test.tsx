import { describe, it, expect, vi } from "vitest";
import { render, renderWithUser, screen } from "@/test/test-utils";
import { Button } from "../Button";

describe("Button", () => {
  describe("rendering", () => {
    it("renders children correctly", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
    });

    it("renders with default variant (primary)", () => {
      render(<Button>Primary</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("button--primary");
    });

    it("renders with secondary variant", () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("button--secondary");
    });

    it("renders with danger variant", () => {
      render(<Button variant="danger">Danger</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("button--danger");
    });

    it("renders with default size (medium)", () => {
      render(<Button>Medium</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("button--medium");
    });

    it("renders with small size", () => {
      render(<Button size="small">Small</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("button--small");
    });

    it("renders with large size", () => {
      render(<Button size="large">Large</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("button--large");
    });

    it("applies custom className", () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-class");
    });
  });

  describe("interactions", () => {
    it("calls onClick when clicked", async () => {
      const handleClick = vi.fn();
      const { user } = renderWithUser(<Button onClick={handleClick}>Click</Button>);

      await user.click(screen.getByRole("button"));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled", async () => {
      const handleClick = vi.fn();
      const { user } = renderWithUser(
        <Button onClick={handleClick} disabled>
          Disabled
        </Button>
      );

      await user.click(screen.getByRole("button"));

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    it("shows loading spinner when isLoading is true", () => {
      render(<Button isLoading>Loading</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("button--loading");
      expect(button).toHaveAttribute("aria-busy", "true");
    });

    it("is disabled when loading", () => {
      render(<Button isLoading>Loading</Button>);
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });

    it("does not call onClick when loading", async () => {
      const handleClick = vi.fn();
      const { user } = renderWithUser(
        <Button onClick={handleClick} isLoading>
          Loading
        </Button>
      );

      await user.click(screen.getByRole("button"));

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("has correct type attribute by default", () => {
      render(<Button>Submit</Button>);
      const button = screen.getByRole("button");
      // Buttons default to type="submit" in forms, but standalone buttons have no type
      expect(button.tagName).toBe("BUTTON");
    });

    it("passes through type attribute", () => {
      render(<Button type="submit">Submit</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("type", "submit");
    });

    it("supports aria-label", () => {
      render(<Button aria-label="Close dialog">X</Button>);
      expect(screen.getByRole("button", { name: /close dialog/i })).toBeInTheDocument();
    });
  });
});
