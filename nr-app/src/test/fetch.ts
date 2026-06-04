type JsonResponseOptions = {
  body?: unknown;
  ok?: boolean;
  status?: number;
};

export function createJsonResponse({
  body = { success: true },
  ok = true,
  status = 200,
}: JsonResponseOptions = {}) {
  return {
    json: jest.fn(async () => body),
    ok,
    status,
  } as unknown as Response;
}

export function mockFetchJson(options?: JsonResponseOptions) {
  const fetchMock = jest.fn(async () => createJsonResponse(options));
  global.fetch = fetchMock;
  return fetchMock;
}
