/**
 * Saga tests step through a worker by hand and feed it the resolved value of
 * each yielded effect. The generator's declared `next()` parameter type is the
 * type of an unrelated yield point, so it rejects those values; widen it here.
 */
export function steppable<T = unknown, R = unknown>(
  generator: Generator<T, R, never>,
) {
  return generator as Generator<T, R, any>;
}
