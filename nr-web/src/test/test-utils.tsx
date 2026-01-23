import { ReactElement, ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Custom providers wrapper for tests
 * Add any context providers your app needs here (e.g., Redux, Theme, Router)
 */
interface ProvidersProps {
  children: ReactNode;
}

function AllProviders({ children }: ProvidersProps) {
  return <>{children}</>;
}

/**
 * Custom render function that wraps components with necessary providers
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

/**
 * Render with user event setup for simulating user interactions
 */
function renderWithUser(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return {
    user: userEvent.setup(),
    ...customRender(ui, options),
  };
}

// Re-export everything from testing-library
export * from "@testing-library/react";
export { userEvent };

// Override render with custom render
export { customRender as render, renderWithUser };
