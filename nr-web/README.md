# NR Web

A web application built with React, Vite, and TypeScript.

## Tech Stack

- **Build Tool**: [Vite](https://vitejs.dev/) - Fast, modern build tool
- **Framework**: [React 18](https://react.dev/) with TypeScript
- **Testing**: [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- **Linting**: ESLint with TypeScript support

## Getting Started

### Prerequisites

- Node.js 18+ (see `.nvmrc` for exact version)
- pnpm 9+

### Installation

From the workspace root:

```bash
pnpm install
```

### Development

```bash
# Start development server
pnpm --filter nr-web dev

# Or from the nr-web directory
cd nr-web
pnpm dev
```

### Building

```bash
pnpm --filter nr-web build
```

## Testing

This project uses **Vitest** as the test framework with **React Testing Library** for component testing.

### Running Tests

```bash
# Run tests in watch mode
pnpm --filter nr-web test

# Run tests once (CI mode)
pnpm --filter nr-web test:run

# Run tests with coverage
pnpm --filter nr-web test:coverage

# Run tests with UI
pnpm --filter nr-web test:ui
```

### Test Structure

```
src/
├── __tests__/           # App-level tests
│   └── App.test.tsx
├── components/
│   ├── __tests__/       # Component tests
│   │   ├── Button.test.tsx
│   │   └── Counter.test.tsx
│   ├── Button.tsx
│   └── Counter.tsx
├── hooks/
│   ├── __tests__/       # Hook tests
│   │   └── useLocalStorage.test.ts
│   └── useLocalStorage.ts
├── utils/
│   ├── __tests__/       # Utility tests
│   │   └── format.test.ts
│   └── format.ts
└── test/
    ├── setup.ts         # Global test setup
    └── test-utils.tsx   # Custom render functions
```

### Test Configuration

The test configuration is in `vitest.config.ts` and includes:

- **Environment**: `happy-dom` (faster than jsdom)
- **Globals**: `describe`, `it`, `expect` available without imports
- **Setup**: Automatic cleanup after each test
- **Coverage**: V8 provider with HTML, JSON, and text reports

### Writing Tests

#### Component Tests

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, renderWithUser, screen } from "@/test/test-utils";
import { MyComponent } from "../MyComponent";

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(<MyComponent />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("handles user interactions", async () => {
    const handleClick = vi.fn();
    const { user } = renderWithUser(<MyComponent onClick={handleClick} />);

    await user.click(screen.getByRole("button"));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

#### Hook Tests

```tsx
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMyHook } from "../useMyHook";

describe("useMyHook", () => {
  it("returns initial value", () => {
    const { result } = renderHook(() => useMyHook("initial"));
    expect(result.current.value).toBe("initial");
  });

  it("updates value", () => {
    const { result } = renderHook(() => useMyHook("initial"));

    act(() => {
      result.current.setValue("updated");
    });

    expect(result.current.value).toBe("updated");
  });
});
```

#### Utility Tests

```ts
import { describe, it, expect } from "vitest";
import { myUtility } from "../myUtility";

describe("myUtility", () => {
  it("transforms input correctly", () => {
    expect(myUtility("input")).toBe("expected output");
  });
});
```

### Custom Test Utilities

The `@/test/test-utils.tsx` file provides:

- `render()` - Custom render function with providers
- `renderWithUser()` - Render with userEvent setup for interaction testing
- All exports from `@testing-library/react`

### Mocking

The test setup (`src/test/setup.ts`) includes mocks for:

- `window.matchMedia`
- `ResizeObserver`
- `IntersectionObserver`

### Test Patterns

1. **Arrange-Act-Assert**: Structure tests with clear setup, action, and assertion phases
2. **Test behavior, not implementation**: Focus on what the user sees and does
3. **Use accessible queries**: Prefer `getByRole`, `getByLabelText`, `getByText`
4. **Test edge cases**: Empty states, error states, loading states

## Code Style

```bash
# Run linting
pnpm --filter nr-web lint

# Type checking
pnpm --filter nr-web typecheck
```

## Project Structure

```
nr-web/
├── index.html           # HTML entry point
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
├── vitest.config.ts     # Vitest configuration
├── eslint.config.js     # ESLint configuration
└── src/
    ├── main.tsx         # Application entry point
    ├── App.tsx          # Root component
    ├── index.css        # Global styles
    ├── components/      # React components
    ├── hooks/           # Custom React hooks
    ├── utils/           # Utility functions
    └── test/            # Test utilities and setup
```
