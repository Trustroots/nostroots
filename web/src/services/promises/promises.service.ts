export const promiseWithTimeout = (
  fn: () => Promise<any>,
  timeoutMs: number
): Promise<any> => {
  const promise = fn();
  const timeout = new Promise((resolve, reject) => {
    setTimeout(() => {
      reject();
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]);
};
