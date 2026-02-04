export interface Location {
  id: string;
  name: string;
  days: string[];
  address: string;
  googleMapsUrl: string;
}

export const pickupLocations: Location[] = [
  {
    id: 'mae-rim',
    name: 'Mae Rim Bakery',
    days: ['Friday', 'Saturday'],
    address: 'Mae Rim, Chiang Mai, Thailand',
    googleMapsUrl: 'https://maps.app.goo.gl/tnj14dQLBwqSu9k4A'
  },
  {
    id: 'in-town',
    name: 'In-Town Location',
    days: ['Sunday'],
    address: 'Chiang Mai, Thailand',
    googleMapsUrl: 'https://maps.app.goo.gl/uaSYZeexEbSQzTsn7'
  }
];
