export const chromium = {
  launch: jest.fn(() => Promise.resolve({
    newPage: jest.fn(() => Promise.resolve({
      goto: jest.fn(),
      waitForSelector: jest.fn(),
      fill: jest.fn(),
      press: jest.fn(),
      waitForLoadState: jest.fn(),
      content: jest.fn(() => Promise.resolve('<html><body></body></html>')),
    })),
    close: jest.fn(),
  })),
};
