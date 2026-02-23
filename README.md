# Pirateship API

<img align="right" width="75" height="75" src="https://cdn.prod.website-files.com/6373a03c7d7cb73ba2df4f8e/63cebd814ad20b37f1293666_ARRrrrmoji%20Template%20168.png">

An unoffical typed wrapper for the PirateShip API.

## Installation

```bash
bun i pirateship-api
```

# Usage

```ts
import { fetchShippingRates } from "pirateship-api";

const options: ShippingOptions = {
  originZip: "20001",
  originCity: "Washington",
  originRegionCode: "DC",
  isResidential: true,
  destinationZip: "90028",
  destinationCountryCode: "US",
  mailClassKeys: [
    "PriorityExpress",
    "First",
    "ParcelSelect",
    "Priority",
  ],
  packageTypeKeys: ["SoftEnvelope"],
  weight: 14,
  dimensionX: 9,
  dimensionY: 10,
  dimensionZ: 5
  showUpsRatesWhen2x7Selected: true,
};

const rates = await fetchShippingRates(options);
console.log(rates.map((rate) => rate.title + " - " + rate.carrier.title + " - $" + rate.totalPrice));
```

Running the above code will output the following:

```ts
;['Priority Mail - USPS - $10.07', 'Priority Mail Express - USPS - $47.25']
```

This is a work in progress and the types are accurate as of `2026-02-23` but can't be guaranteed to be 100% correct as this is an undocumented internal API.

<p align="center">
    <img src="https://raw.githubusercontent.com/taciturnaxolotl/carriage/main/.github/images/line-break.svg" />
</p>

<p align="center">
    <i><code>&copy 2024-present <a href="https://dunkirk.sh">Kieran Klukas</a></code></i>
</p>

<p align="center">
    <a href="https://github.com/taciturnaxolotl/pirateship-api/img/blob/main/LICENSE.md"><img src="https://img.shields.io/static/v1.svg?style=for-the-badge&label=License&message=MIT&logoColor=d9e0ee&colorA=363a4f&colorB=b7bdf8"/></a>
</p>
