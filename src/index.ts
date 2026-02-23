import type {
    Rates,
    Rate,
    ShippingOptions,
    PackageType,
    MailClassKey,
    CarrierKey,
    RateError,
} from './types'

export type {
    Rates,
    Rate,
    ShippingOptions,
    PackageType,
    MailClassKey,
    CarrierKey,
    RateError,
}

const FLAT_RATE_TYPES: Set<PackageType> = new Set([
    'FlatRateEnvelope',
    'FlatRateLegalEnvelope',
    'FlatRatePaddedEnvelope',
    'SmallFlatRateBox',
    'MediumFlatRateBox',
    'LargeFlatRateBox',
    'ExpressFlatRateEnvelope',
    'ExpressFlatRateLegalEnvelope',
    'ExpressFlatRatePaddedEnvelope',
])

function validateDimensions(options: ShippingOptions): void {
    for (const packageType of options.packageTypeKeys) {
        if (FLAT_RATE_TYPES.has(packageType)) continue

        const { dimensionX: x, dimensionY: y, dimensionZ: z } = options

        if (x !== undefined && x < 6) {
            throw new Error(
                `${packageType} length (dimensionX) must be at least 6 inches, got ${x}`
            )
        }
        if (y !== undefined && y < 3) {
            throw new Error(
                `${packageType} width (dimensionY) must be at least 3 inches, got ${y}`
            )
        }
        if (packageType !== 'SoftEnvelope' && z !== undefined && z < 0.25) {
            throw new Error(
                `${packageType} height (dimensionZ) must be at least 0.25 inches, got ${z}`
            )
        }
    }
}

export async function fetchShippingRates(
    options: ShippingOptions
): Promise<Rate[]> {
    validateDimensions(options)

    const response = await fetch(
        'https://ship.pirateship.com/api/graphql?opname=RatesQuery',
        {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(buildRequestBody(options)),
            method: 'POST',
        }
    )

    if (!response.ok) {
        throw new Error(`PirateShip API returned ${response.status}`)
    }

    const data = (await response.json()) as Rates

    if (data.errors && data.errors.length > 0 && !data.data) {
        throw new Error(
            data.errors[0].message || 'An error occurred in the response'
        )
    }
    if (!data.data) {
        throw new Error('No data in response')
    }

    return data.data.rates
}

function buildVariables(
    options: ShippingOptions
): Record<string, unknown> {
    const vars: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(options)) {
        if (value !== undefined) vars[key] = value
    }
    return vars
}

function buildRequestBody(options: ShippingOptions): object {
    return {
        operationName: 'RatesQuery',
        variables: buildVariables(options),
        query: `
      query RatesQuery($originZip: String!, $originCity: String, $originRegionCode: String, $destinationZip: String, $isResidential: Boolean, $destinationCountryCode: String, $weight: Float, $dimensionX: Float, $dimensionY: Float, $dimensionZ: Float, $mailClassKeys: [String!]!, $packageTypeKeys: [String!]!, $pricingTypes: [String!], $showUpsRatesWhen2x7Selected: Boolean) {
        rates(
          originZip: $originZip
          originCity: $originCity
          originRegionCode: $originRegionCode
          destinationZip: $destinationZip
          isResidential: $isResidential
          destinationCountryCode: $destinationCountryCode
          weight: $weight
          dimensionX: $dimensionX
          dimensionY: $dimensionY
          dimensionZ: $dimensionZ
          mailClassKeys: $mailClassKeys
          packageTypeKeys: $packageTypeKeys
          pricingTypes: $pricingTypes
          showUpsRatesWhen2x7Selected: $showUpsRatesWhen2x7Selected
        ) {
          title
          deliveryDescription
          trackingDescription
          serviceDescription
          pricingDescription
          cubicTier
          mailClassKey
          mailClass {
            accuracy
            international
            __typename
          }
          packageTypeKey
          zone
          surcharges {
            title
            price
            __typename
          }
          carrier {
            carrierKey
            title
            __typename
          }
          totalPrice
          priceBaseTypeKey
          basePrice
          crossedTotalPrice
          pricingType
          pricingSubType
          ratePeriodId
          learnMoreUrl
          cheapest
          fastest
          __typename
        }
      }
    `,
    }
}
