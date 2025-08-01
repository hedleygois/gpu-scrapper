export interface Store {
  name: string;
  baseUrl: string;
  searchPath: string;
  searchParam: string;
  requiresBrowser: boolean;
}

export const STORES: Store[] = [
  {
    name: 'Megekko',
    baseUrl: 'https://www.megekko.nl',
    searchPath: '/zoeken',
    searchParam: 'q',
    requiresBrowser: true
  },
  // {
  //   name: 'Coolblue',
  //   baseUrl: 'https://www.coolblue.nl',
  //   searchPath: '/zoeken',
  //   searchParam: 'query',
  //   requiresBrowser: false
  // },
  // {
  //   name: 'Alternate',
  //   baseUrl: 'https://www.alternate.nl',
  //   searchPath: '/listing.xhtml',
  //   searchParam: 'q',
  //   requiresBrowser: false
  // },
  // {
  //   name: "Azerty",
  //   baseUrl: "https://azerty.nl",
  //   searchPath: "/catalogsearch/result/",
  //   searchParam: "q",
  //   requiresBrowser: false,
  // },
];

export const SEARCH_TERMS = [
  "Radeon 7700XT", // 'Radeon 7900XT', 'Radeon 7900XTX',
  //'GeForce 5070 ti', 'GeForce 5080', 'GeForce 4070 TI Super',
  // 'Ryzen 9950X3D', 'Ryzen 9900X3D', 'Ryzen 7950X3D', 'Ryzen 7800X3D', 'Ryzen 7900X3D'
];