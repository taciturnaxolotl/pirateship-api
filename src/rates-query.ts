/**
 * The rates query Pirate Ship's own site sends.
 *
 * The endpoint only executes queries it has registered, identified by the
 * SHA-256 of their printed text. This is a verbatim copy of theirs, so its hash
 * matches what the server expects. Edit nothing here by hand: a single changed
 * character changes the hash and every request fails. Regenerate it with
 * `bun run sync-query`.
 */
export const RATES_QUERY =
    'query RatesQuery($originZip: String!, $originCity: String, $originRegionCode: String, $destinationZip: String, $isResidential: Boolean, $destinationCountryCode: String, $weight: Float, $dimensionX: Float, $dimensionY: Float, $dimensionZ: Float, $mailClassKeys: [String!]!, $packageTypeKeys: [String!]!, $pricingTypes: [String!], $showUpsRatesWhen2x7Selected: Boolean) {\n  rates(\n    originZip: $originZip\n    originCity: $originCity\n    originRegionCode: $originRegionCode\n    destinationZip: $destinationZip\n    isResidential: $isResidential\n    destinationCountryCode: $destinationCountryCode\n    weight: $weight\n    dimensionX: $dimensionX\n    dimensionY: $dimensionY\n    dimensionZ: $dimensionZ\n    mailClassKeys: $mailClassKeys\n    packageTypeKeys: $packageTypeKeys\n    pricingTypes: $pricingTypes\n    showUpsRatesWhen2x7Selected: $showUpsRatesWhen2x7Selected\n  ) {\n    title\n    deliveryDescription\n    trackingDescription\n    serviceDescription\n    pricingDescription\n    cubicTier\n    mailClassKey\n    mailClass {\n      accuracy\n      international\n      __typename\n    }\n    packageTypeKey\n    zone\n    surcharges {\n      title\n      price\n      __typename\n    }\n    carrier {\n      carrierKey\n      title\n      __typename\n    }\n    totalPrice\n    priceBaseTypeKey\n    basePrice\n    crossedTotalPrice\n    pricingType\n    pricingSubType\n    ratePeriodId\n    learnMoreUrl\n    cheapest\n    fastest\n    best\n    __typename\n  }\n}'

/** SHA-256 of `RATES_QUERY`, the id the server knows it by. */
export const RATES_QUERY_HASH =
    '2692f7149bbb741a0fd343d1d59d8c02b0d4cf50abe36d3ebce54bdef2b73f85'

/** The variables `RATES_QUERY` declares. Anything else would be ignored. */
export const RATES_QUERY_VARIABLES: ReadonlySet<string> = new Set(
    [
        ...RATES_QUERY.slice(0, RATES_QUERY.indexOf(')')).matchAll(/\$(\w+):/g),
    ].map((match) => match[1] as string)
)
