import type { Rates, Rate, ShippingOptions } from './types'

export { Rates, Rate, ShippingOptions }

export async function fetchShippingRates(
    options: ShippingOptions
): Promise<Rate[]> {
    const response = await fetch(
        'https://ship.pirateship.com/api/graphql?opname=RatesQuery',
        {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(buildRequestBody(options)),
            method: 'POST',
        }
    )

    const data = (await response.json()) as Rates

    // check for data and error
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

function buildRequestBody(options: ShippingOptions): object {
    return {
        operationName: 'RatesQuery',
        variables: {
            originZip: options.originZip,
            originCity: options.originCity,
            originRegionCode: options.originRegionCode,
            isResidential: options.isResidential,
            destinationZip: options.destinationZip,
            destinationCountryCode: options.destinationCountryCode,
            mailClassKeys: options.mailClassKeys,
            packageTypeKeys: options.packageTypeKeys,
            weight: options.weight,
            dimensionX: options.dimensionX,
            dimensionY: options.dimensionY,
            dimensionZ: options.dimensionZ,
            showUpsRatesWhen2x7Selected: options.showUpsRatesWhen2x7Selected,
        },
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

const options: ShippingOptions = {
    originZip: '20001',
    originCity: 'Washington',
    originRegionCode: 'DC',
    isResidential: true,
    destinationZip: '90028',
    destinationCountryCode: 'US',
    mailClassKeys: ['PriorityExpress', 'First', 'ParcelSelect', 'Priority'],
    packageTypeKeys: ['SoftEnvelope'],
    weight: 14,
    dimensionX: 9,
    dimensionY: 10,
    dimensionZ: 1,
    showUpsRatesWhen2x7Selected: true,
}

const rates = await fetchShippingRates(options)
