export interface Rates {
    errors: Error[]
    data: Data
}

export interface Data {
    rates: Rate[]
}

export interface Rate {
    title: string
    deliveryDescription: string
    trackingDescription: string
    serviceDescription: string
    pricingDescription: string
    cubicTier: null
    mailClassKey: string
    mailClass: MailClass
    packageTypeKey: string
    zone: string
    surcharges: Surcharge[]
    carrier: Carrier
    totalPrice: number
    priceBaseTypeKey: string
    basePrice: number
    crossedTotalPrice: number
    pricingType: string
    pricingSubType: string
    ratePeriodId: number
    learnMoreUrl: string
    cheapest: boolean
    fastest: boolean
    __typename: string
}

export interface Carrier {
    carrierKey: string
    title: string
    __typename: string
}

export interface MailClass {
    accuracy: null
    international: boolean
    __typename: string
}

export interface Surcharge {
    title: string
    price: number
    __typename: string
}

export interface Error {
    message: string
    locations: Location[]
    path: string[]
    extensions: Extensions
}

export interface Extensions {
    code: number
    title: string
    mailClassKey: string
    packageTypeKey: string
}

export interface Location {
    line: number
    column: number
}

export interface ShippingOptions {
    /**
     * Zip code of the origin.
     */
    originZip: string
    /**
     * City of the origin.
     */
    originCity: string
    /**
     * State code of the origin.
     */
    originRegionCode: string
    /**
     * Whether the origin is a residential address.
     */
    isResidential: boolean
    /**
     * Zip code of the destination. Only required for US shipping.
     */
    destinationZip: string
    /**
     * Country code of the destination. seems to follow https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
     */
    destinationCountryCode: string
    /**
     * Array of mail class keys.
     */
    mailClassKeys: string[]
    /**
     * Array of package type keys.
     */
    packageTypeKeys: string[]
    /**
     * Weight of the package in ounces
     */
    weight: number
    /**
     * Length of the package in inches
     */
    dimensionX: number
    /**
     * Width of the package in inches
     */
    dimensionY: number
    /**
     * Height of the package in inches
     */
    dimensionZ: number
    /**
     * Whether to show UPS rates when 2x7 is selected.
     */
    showUpsRatesWhen2x7Selected: boolean
}
