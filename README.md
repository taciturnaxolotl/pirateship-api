# Pirateship API

<img align="right" width="75" height="75" src="https://cdn.prod.website-files.com/6373a03c7d7cb73ba2df4f8e/63cebd814ad20b37f1293666_ARRrrrmoji%20Template%20168.png">

An unoffical typed wrapper for the PirateShip API.

## Installation

```bash
bun i pirateship-api
```

## Usage

```ts
import { fetchShippingRates } from "pirateship-api";

const { rates } = await fetchShippingRates({
  originZip: "20001",
  destinationZip: "90028",
  weight: 14, // ounces
  dimensionX: 9, // inches
  dimensionY: 10,
  dimensionZ: 5,
  mailClassKeys: ["Priority", "PriorityExpress"],
  packageTypeKeys: ["SoftEnvelope"],
});

for (const rate of rates) {
  console.log(`${rate.title} - ${rate.carrier.title} - $${rate.totalPrice}`);
}
```

```
Priority Mail - USPS - $13.48
Priority Mail Express - USPS - $55.79
```

Add UPS by its service code. (UPS codes are opaque numbers so we ship constants for them)

```ts
import { fetchShippingRates, UpsDomesticService } from "pirateship-api";

await fetchShippingRates({
  // ...
  mailClassKeys: ["Priority", UpsDomesticService.Ground],
});
```

## The result

```ts
const { rates, unavailable } = await fetchShippingRates(options);
```

`rates` holds all prices the api returned. `unavailable` holds the services that aren't available with reasoning as to why.

```ts
for (const service of unavailable) {
  console.warn(`${service.title} (${service.code}): ${service.reason}`);
}
```

You can ignore `unavailable` if you wish. Bad requests will throw an error.

## Errors

We have a few types of terminal errors that make it impossible to return anything useful.

| Thrown | When | fields |
| --- | --- | --- |
| `PirateShipValidationError` | Rejected before sending | `field` |
| `PirateShipRequestError` | The API rejected the request | `field` |
| `PirateShipQueryRetiredError` | Pirate Ship changed their rates query (see below) | |
| `PirateShipHttpError` | Non-2xx response | `status`, `isChallenge`, `retryable` |
| `PirateShipNetworkError` | DNS, socket, abort, bad body | `cause` |

You can also add a timeout via an abort signal:

```ts
await fetchShippingRates({ ...options, signal: AbortSignal.timeout(10_000) });
```

## Persisted queries

Pirate Ship's API only runs queries their own site has registered, so this library sends their rates query by hash instead of its own. If they change that query every request throws `PirateShipQueryRetiredError` until it's updated.

```bash
bun run sync-query          # pull the current query from their site
bun run sync-query --check  # exit 1 if it drifted (good for CI)
bun run probe               # check every service, package type, and value we list is still current
```

`sync-query` prints what changed (variables and fields added or removed) and won't write a hash the API rejects. The type tests fail until `src/types.ts` matches the new query, so nothing goes stale quietly. A weekly workflow in `.github/workflows/drift.yaml` runs all of it.

That query also limits what you can ask for: there's no insurance, ship date, or customs option, since their calculator doesn't send them.

## Migrating from 0.2

| Was | Now |
| --- | --- |
| `fetchShippingRates` resolved to `Rate[]` | Resolves to `{ rates, unavailable }` |
| Bad input threw a bare `Error` | Throws `PirateShipRequestError` with a `field` |
| `ShippingOptions` was one flat interface | Union, split by destination |
| `weight` was optional | Required |
| `Extensions` | Gone. Failures are `UnavailableService` or a throw |
| `pricingTypes: string[]` | `pricingTypes: PricingType[]` |
| Some types only lived in `types.ts` | Everything is exported from the root |

This is a work in progress and the types are accurate as of `2026-10-05` but can't be guaranteed to be 100% correct as this is an undocumented internal API.

<p align="center">
    <img src="https://raw.githubusercontent.com/taciturnaxolotl/carriage/main/.github/images/line-break.svg" />
</p>

<p align="center">
    <i><code>&copy 2024-present <a href="https://dunkirk.sh">Kieran Klukas</a></code></i>
</p>

<p align="center">
    <a href="https://github.com/taciturnaxolotl/pirateship-api/img/blob/main/LICENSE.md"><img src="https://img.shields.io/static/v1.svg?style=for-the-badge&label=License&message=MIT&logoColor=d9e0ee&colorA=363a4f&colorB=b7bdf8"/></a>
</p>
