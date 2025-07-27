import { JSDOM } from "jsdom";
import { extractProductName, extractProductPrice, extractProductUrl } from "./index";

describe("extractProductName", () => {
  it("extracts the first matching name", () => {
    const dom = new JSDOM(`<div><span class='name1'>Test Product</span></div>`);
    const el = dom.window.document.body;
    expect(extractProductName(el, [".name1", ".name2"])).toBe("Test Product");
  });

  it("returns empty string if no selector matches", () => {
    const dom = new JSDOM(`<div></div>`);
    const el = dom.window.document.body;
    expect(extractProductName(el, [".notfound"]))
      .toBe("");
  });
});

describe("extractProductPrice", () => {
  it("extracts and parses the first valid price", () => {
    const dom = new JSDOM(`<div><span class='price1'>€1.234,56</span></div>`);
    const el = dom.window.document.body;
    expect(extractProductPrice(el, [".price1"]))
      .toBeCloseTo(1234.56);
  });

  it("returns -1 if no price is found", () => {
    const dom = new JSDOM(`<div></div>`);
    const el = dom.window.document.body;
    expect(extractProductPrice(el, [".notfound"]))
      .toBe(-1);
  });

  it("skips invalid price formats", () => {
    const dom = new JSDOM(`<div><span class='price1'>abc</span></div>`);
    const el = dom.window.document.body;
    expect(extractProductPrice(el, [".price1"]))
      .toBe(-1);
  });
});

describe("extractProductUrl", () => {
  const store = { baseUrl: "https://example.com" } as any;

  it("extracts the first valid absolute URL", () => {
    const dom = new JSDOM(`<div><a href='https://test.com/item'>Link</a></div>`);
    const el = dom.window.document.body;
    expect(extractProductUrl(el, store)).toBe("https://test.com/item");
  });

  it("converts relative URLs to absolute", () => {
    const dom = new JSDOM(`<div><a href='/item/123'>Link</a></div>`);
    const el = dom.window.document.body;
    expect(extractProductUrl(el, store)).toBe("https://example.com/item/123");
  });

  it("returns empty string if no link is found", () => {
    const dom = new JSDOM(`<div></div>`);
    const el = dom.window.document.body;
    expect(extractProductUrl(el, store)).toBe("");
  });

  it("uses element.href if present and no anchor found", () => {
    const dom = new JSDOM(`<a href='https://fallback.com/item'></a>`);
    const el = dom.window.document.body.firstElementChild as Element;
    expect(extractProductUrl(el, store)).toBe("https://fallback.com/item");
  });
}); 