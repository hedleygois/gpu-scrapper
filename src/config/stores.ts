export interface Store {
  readonly name: string;
  readonly baseUrl: string;
  readonly searchPath: string;
  readonly searchParam: string;
  readonly requiresBrowser: boolean;
}

export const STORES: readonly Store[] = [
  {
    name: "Megekko",
    baseUrl: "https://www.megekko.nl",
    searchPath: "/zoeken",
    searchParam: "q",
    requiresBrowser: true
  },
  {
    name: "Coolblue",
    baseUrl: "https://www.coolblue.nl",
    searchPath: "/zoeken",
    searchParam: "query",
    requiresBrowser: false
  },
  {
    name: "Alternate",
    baseUrl: "https://www.alternate.nl",
    searchPath: "/listing.xhtml",
    searchParam: "q",
    requiresBrowser: false
  },
  {
    name: "Azerty",
    baseUrl: "https://azerty.nl",
    searchPath: "/catalogsearch/result/",
    searchParam: "q",
    requiresBrowser: false,
  },
] as const;

export const SEARCH_TERMS: readonly string[] = [
  "AMD Radeon 7700XT", "AMD Radeon 7900XT", "AMD Radeon 7900XTX",
  "NVIDIA GeForce 5070 ti", "NVIDIA GeForce 5080", "NVIDIA GeForce 4070 TI Super",
  "AMD Ryzen 9950X3D", "AMD Ryzen 9900X3D", "AMD Ryzen 7950X3D", "AMD Ryzen 7800X3D", "AMD Ryzen 7900X3D"
] as const;