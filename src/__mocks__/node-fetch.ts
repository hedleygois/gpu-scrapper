const mockFetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve('<html><body></body></html>'),
    json: () => Promise.resolve({}),
  })
);

export default mockFetch;
