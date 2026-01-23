import { useState, useCallback } from "react";
import { Button } from "./Button";
import "./Counter.css";

export interface CounterProps {
  initialValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
}

export function Counter({
  initialValue = 0,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  onChange,
}: CounterProps) {
  const [count, setCount] = useState(initialValue);

  const updateCount = useCallback(
    (newValue: number) => {
      const clampedValue = Math.min(Math.max(newValue, min), max);
      setCount(clampedValue);
      onChange?.(clampedValue);
    },
    [min, max, onChange]
  );

  const increment = useCallback(() => {
    updateCount(count + step);
  }, [count, step, updateCount]);

  const decrement = useCallback(() => {
    updateCount(count - step);
  }, [count, step, updateCount]);

  const reset = useCallback(() => {
    updateCount(initialValue);
  }, [initialValue, updateCount]);

  const canDecrement = count - step >= min;
  const canIncrement = count + step <= max;

  return (
    <div className="counter" role="group" aria-label="Counter">
      <div className="counter__controls">
        <Button
          variant="secondary"
          size="small"
          onClick={decrement}
          disabled={!canDecrement}
          aria-label="Decrement"
        >
          -
        </Button>
        <output className="counter__value" aria-live="polite">
          {count}
        </output>
        <Button
          variant="secondary"
          size="small"
          onClick={increment}
          disabled={!canIncrement}
          aria-label="Increment"
        >
          +
        </Button>
      </div>
      <Button variant="secondary" size="small" onClick={reset}>
        Reset
      </Button>
    </div>
  );
}
