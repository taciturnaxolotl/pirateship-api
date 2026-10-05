/**
 * Types for the Pirate Ship rates endpoint.
 *
 * Every union that has a known, closed value space is published twice: as a
 * runtime constant you can enumerate, and as the type derived from it. The two
 * can never drift apart.
 */

/* -------------------------------------------------------------------------- */
/*                                Package types                               */
/* -------------------------------------------------------------------------- */

/** Package types the unauthenticated rates endpoint accepts. */
// UPS-specific package types (Express Envelope, Box, Tube, Pak) require
// authentication. UPS mail classes work here; only the package types are gated.
export const PackageTypes = [
    'SoftEnvelope',
    'Parcel',
    'Irregular',
    'FlatRateEnvelope',
    'FlatRateLegalEnvelope',
    'FlatRatePaddedEnvelope',
    'SmallFlatRateBox',
    'MediumFlatRateBox',
    'LargeFlatRateBox',
    'ExpressFlatRateEnvelope',
    'ExpressFlatRateLegalEnvelope',
    'ExpressFlatRatePaddedEnvelope',
] as const

export type PackageType = (typeof PackageTypes)[number]

/** Package types priced as a flat rate, for which dimensions are ignored. */
export const FlatRatePackageTypes = [
    'FlatRateEnvelope',
    'FlatRateLegalEnvelope',
    'FlatRatePaddedEnvelope',
    'SmallFlatRateBox',
    'MediumFlatRateBox',
    'LargeFlatRateBox',
    'ExpressFlatRateEnvelope',
    'ExpressFlatRateLegalEnvelope',
    'ExpressFlatRatePaddedEnvelope',
] as const satisfies readonly PackageType[]

/* -------------------------------------------------------------------------- */
/*                                Mail classes                                */
/* -------------------------------------------------------------------------- */

/** USPS services for US destinations. */
export const UspsDomesticMailClass = {
    PriorityExpress: 'PriorityExpress',
    Priority: 'Priority',
    GroundAdvantage: 'GroundAdvantage',
    /** Legacy. Accepted, but it has not quoted a rate on any route tested. */
    First: 'First',
    /** Legacy. Accepted, but it has not quoted a rate on any route tested. */
    ParcelSelect: 'ParcelSelect',
    /** Legacy. Accepted, but it has not quoted a rate on any route tested. */
    MediaMail: 'MediaMail',
} as const

/** USPS services for destinations outside the US. */
export const UspsInternationalMailClass = {
    /** Pirate Ship's own rate, sold under the name "Simple Export Rate". */
    SimpleExportRate: 'FirstGlobalRate',
    FirstClassPackageInternational: 'FirstClassPackageInternationalService',
    PriorityMailInternational: 'PriorityMailInternational',
    PriorityMailExpressInternational: 'PriorityMailExpressInternational',
} as const

/** UPS services for US destinations. The wire value is a numeric code. */
export const UpsDomesticService = {
    NextDayAir: '01',
    SecondDayAir: '02',
    Ground: '03',
    ThreeDaySelect: '12',
    NextDayAirSaver: '13',
    NextDayAirEarly: '14',
    SecondDayAirAm: '59',
    /** Ground Saver for packages under 1 lb. At or above 1 lb, use `GroundSaver`. */
    GroundSaverUnder1Lb: '92',
    GroundSaver: '93',
} as const

/** UPS services for destinations outside the US. The wire value is a numeric code. */
export const UpsInternationalService = {
    WorldwideExpress: '07',
    WorldwideExpedited: '08',
    /** Serves Canada and Mexico only; other destinations quote no rate. */
    Standard: '11',
    WorldwideEconomy: '17',
    /** Accepted by the API, but it has not quoted a rate on any route tested. */
    WorldwideExpressPlus: '54',
    WorldwideSaver: '65',
} as const

export type UspsDomesticMailClassKey =
    (typeof UspsDomesticMailClass)[keyof typeof UspsDomesticMailClass]
export type UspsInternationalMailClassKey =
    (typeof UspsInternationalMailClass)[keyof typeof UspsInternationalMailClass]
export type UpsDomesticMailClassKey =
    (typeof UpsDomesticService)[keyof typeof UpsDomesticService]
export type UpsInternationalMailClassKey =
    (typeof UpsInternationalService)[keyof typeof UpsInternationalService]

/** Any service that can quote a US destination. */
export type DomesticMailClassKey =
    | UspsDomesticMailClassKey
    | UpsDomesticMailClassKey

/** Any service that can quote a destination outside the US. */
export type InternationalMailClassKey =
    | UspsInternationalMailClassKey
    | UpsInternationalMailClassKey

/** Any mail class key accepted as request input. */
export type MailClassKey = DomesticMailClassKey | InternationalMailClassKey

/* -------------------------------------------------------------------------- */
/*                              Response key space                            */
/* -------------------------------------------------------------------------- */

/** Pricing variant the API appends to a mail class key when quoting a rate. */
export const RateVariants = [
    'Cubic',
    'Flat_Rate_Envelope',
    'Legal_Flat_Rate_Envelope',
    'Padded_Flat_Rate_Envelope',
    'Small_Flat_Rate_Box',
    'Medium_Flat_Rate_Box',
    'Large_Flat_Rate_Box',
] as const

export type RateVariant = (typeof RateVariants)[number]

/**
 * Mail class key as returned on a rate.
 *
 * Responses use a wider key space than requests: asking for `Priority` can
 * quote back `Priority_Cubic`. Use `splitMailClassKey` to recover the base key
 * and variant. Only unsuffixed keys are valid as request input.
 */
export type ResponseMailClassKey =
    | MailClassKey
    | `${MailClassKey}_${RateVariant}`

/* -------------------------------------------------------------------------- */
/*                                   Pricing                                  */
/* -------------------------------------------------------------------------- */

/** How a rate was priced. Also accepted as a `pricingTypes` selector. */
export const PricingTypes = ['cubic', 'flat_rate', 'weight'] as const
export type PricingType = (typeof PricingTypes)[number]

/** Pricing sub-type. `softpack` applies to soft envelope rates. */
export const PricingSubTypes = ['default', 'softpack'] as const
export type PricingSubType = (typeof PricingSubTypes)[number]

/** Price book a rate came from. Also accepted as a `priceBaseTypeKeys` selector. */
export const PriceBaseTypeKeys = [
    'commercial',
    'ecommerce',
    'marketplace',
    /** Returned rarely; was not reproducible on demand during testing. */
    'retail',
] as const
export type PriceBaseTypeKey = (typeof PriceBaseTypeKeys)[number]

/** Carriers this endpoint quotes. */
export const CarrierKeys = ['usps', 'ups'] as const
export type CarrierKey = (typeof CarrierKeys)[number]

/* -------------------------------------------------------------------------- */
/*                                  Responses                                 */
/* -------------------------------------------------------------------------- */

export interface Carrier {
    carrierKey: CarrierKey
    title: string
    __typename: 'Carrier'
}

export interface MailClass {
    accuracy: string | null
    international: boolean
    __typename: 'CarrierMailClass'
}

export interface Surcharge {
    title: string
    price: number
    __typename: 'RateSurcharge'
}

export interface Rate {
    /** Human-readable service name, e.g. `UPS Next Day Air®`. */
    title: string
    /** Delivery estimate. Contains BBCode, e.g. `in [b]6-10 days[/b]`. */
    deliveryDescription: string
    /** Tracking summary. Contains BBCode. */
    trackingDescription: string
    /** Carrier liability summary. Contains BBCode `[link=...]` tags. */
    serviceDescription: string
    /** Pricing summary, e.g. `Commercial Pricing`. Plain text. */
    pricingDescription: string
    cubicTier: string | null
    /**
     * May carry a pricing variant suffix. See `splitMailClassKey`.
     *
     * Not unique within a response: UPS quotes Saturday Delivery as a second
     * rate under the same key. See `isSaturdayDelivery`.
     */
    mailClassKey: ResponseMailClassKey
    mailClass: MailClass
    packageTypeKey: PackageType
    zone: string
    surcharges: Surcharge[]
    carrier: Carrier
    /** Final price. Equal to `basePrice` plus every entry in `surcharges`. */
    totalPrice: number
    priceBaseTypeKey: PriceBaseTypeKey
    basePrice: number
    crossedTotalPrice: number
    pricingType: PricingType
    pricingSubType: PricingSubType
    ratePeriodId: number
    learnMoreUrl: string
    cheapest: boolean
    fastest: boolean
    /** Pirate Ship's recommended pick among the rates for this package type. */
    best: boolean
    __typename: 'RateResult'
}

/* -------------------------------------------------------------------------- */
/*                                   Errors                                   */
/* -------------------------------------------------------------------------- */

/**
 * A service that was requested but could not be priced.
 *
 * This is routine rather than exceptional. Services are priced independently,
 * so asking for fifteen and getting nine back is the normal case: UPS Standard
 * does not serve US addresses, Ground Saver splits at 1 lb, and a package can be
 * unsuitable for one service while being fine for another.
 */
export interface UnavailableService {
    mailClassKey: MailClassKey
    packageTypeKey: PackageType
    /** Upstream code. `2001` no matching rate, `2002` package unsuitable. */
    code: number
    /** Service name as the API reports it, e.g. `UPS® Standard`. */
    title: string
    /** Why it could not be priced, in the API's own words. */
    reason: string
}

/** The result of a rate lookup. */
export interface RateQuote {
    /** Every rate the API priced, cheapest first is not guaranteed. */
    rates: Rate[]
    /**
     * Requested services that produced no rate, with the reason for each.
     *
     * Normal to be non-empty alongside a populated `rates`. A request the API
     * rejects outright throws instead, so this never means "your call was wrong".
     */
    unavailable: UnavailableService[]
}

/**
 * The API rejected the request, so no rates were priced.
 *
 * Distinct from a service being unavailable: this means the call itself was
 * malformed, and in practice it is a bug in the caller rather than a shipping
 * constraint.
 */
export class PirateShipRequestError extends Error {
    override readonly name: string = 'PirateShipRequestError'
    /**
     * The parameter the API objected to, e.g. `destinationZip`, or `null` when
     * the rejection was not specific to one field.
     */
    readonly field: string | null
    constructor(message: string, field: string | null) {
        super(message)
        this.field = field
    }
}

/**
 * The API no longer recognises the query this version of the library sends.
 *
 * The endpoint only runs queries Pirate Ship's own site has registered, and
 * this library sends theirs by hash. When they change it, every request fails
 * this way until the library is updated.
 */
export class PirateShipQueryRetiredError extends PirateShipRequestError {
    override readonly name = 'PirateShipQueryRetiredError'
    constructor(message: string) {
        super(
            `${message} Pirate Ship has changed its rates query; update pirateship-api.`,
            null
        )
    }
}

/** The API was reached but answered with a non-2xx status. */
export class PirateShipHttpError extends Error {
    override readonly name = 'PirateShipHttpError'
    readonly status: number
    /** Start of the response body, truncated so a challenge page cannot flood a log. */
    readonly body: string
    /**
     * Seconds to wait before retrying, from the `Retry-After` header.
     *
     * Effectively always `null`: the endpoint sits behind Cloudflare and
     * publishes no rate limit metadata on either success or failure. Back off
     * on your own schedule.
     */
    readonly retryAfter: number | null
    /**
     * How Cloudflare's edge intervened, taken from `cf-mitigated`. `null` when
     * the response came from the API itself.
     *
     * `challenge` is what a 429 from this endpoint means in practice. Cloudflare
     * also documents `block`, which was not observed during testing, so this is
     * left as the raw string rather than a closed union.
     */
    readonly cfMitigation: string | null
    /** Upstream request id, useful when reporting a server error. */
    readonly requestId: string | null

    constructor(response: Response, body: string) {
        super(
            response.headers.get('cf-mitigated') === 'challenge'
                ? `PirateShip returned ${response.status}: blocked by a bot challenge`
                : `PirateShip API returned ${response.status}`
        )
        this.status = response.status
        this.body = body.slice(0, 2048)
        const retryAfter = Number(response.headers.get('retry-after'))
        this.retryAfter =
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null
        this.cfMitigation = response.headers.get('cf-mitigated')
        this.requestId = response.headers.get('x-request-id')
    }

    /**
     * Whether Cloudflare served a bot challenge instead of the API answering.
     *
     * This is what a 429 from this endpoint means: not a quota, so there is no
     * budget to inspect and no reset time to wait for. The request was
     * classified as automated, and slowing down clears it.
     */
    get isChallenge(): boolean {
        return this.cfMitigation === 'challenge'
    }

    /**
     * Whether the edge answered instead of the API.
     *
     * The API itself replies `200` even to malformed requests, reporting
     * problems in the response body, so an HTTP-level failure nearly always
     * means the request never reached it.
     */
    get blockedByEdge(): boolean {
        return this.cfMitigation !== null
    }

    /** Whether retrying the same request could plausibly succeed. */
    get retryable(): boolean {
        return this.status === 408 || this.status === 429 || this.status >= 500
    }
}

/** The request never completed: DNS, socket, abort, or a malformed body. */
export class PirateShipNetworkError extends Error {
    override readonly name = 'PirateShipNetworkError'
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options)
    }
}

/** An input was rejected before any request was sent. */
export class PirateShipValidationError extends Error {
    override readonly name = 'PirateShipValidationError'
    /** The offending option, e.g. `dimensionX`. */
    readonly field: string
    constructor(field: string, message: string) {
        super(message)
        this.field = field
    }
}

/* -------------------------------------------------------------------------- */
/*                                   Requests                                 */
/* -------------------------------------------------------------------------- */

/** ISO 3166-1 alpha-2 country code. */
export type CountryCode =
    // prettier-ignore
    | 'AD'
    | 'AE'
    | 'AF'
    | 'AG'
    | 'AI'
    | 'AL'
    | 'AM'
    | 'AO'
    | 'AQ'
    | 'AR'
    | 'AS'
    | 'AT'
    | 'AU'
    | 'AW'
    | 'AX'
    | 'AZ'
    | 'BA'
    | 'BB'
    | 'BD'
    | 'BE'
    | 'BF'
    | 'BG'
    | 'BH'
    | 'BI'
    | 'BJ'
    | 'BL'
    | 'BM'
    | 'BN'
    | 'BO'
    | 'BQ'
    | 'BR'
    | 'BS'
    | 'BT'
    | 'BV'
    | 'BW'
    | 'BY'
    | 'BZ'
    | 'CA'
    | 'CC'
    | 'CD'
    | 'CF'
    | 'CG'
    | 'CH'
    | 'CI'
    | 'CK'
    | 'CL'
    | 'CM'
    | 'CN'
    | 'CO'
    | 'CR'
    | 'CU'
    | 'CV'
    | 'CW'
    | 'CX'
    | 'CY'
    | 'CZ'
    | 'DE'
    | 'DJ'
    | 'DK'
    | 'DM'
    | 'DO'
    | 'DZ'
    | 'EC'
    | 'EE'
    | 'EG'
    | 'EH'
    | 'ER'
    | 'ES'
    | 'ET'
    | 'FI'
    | 'FJ'
    | 'FK'
    | 'FM'
    | 'FO'
    | 'FR'
    | 'GA'
    | 'GB'
    | 'GD'
    | 'GE'
    | 'GF'
    | 'GG'
    | 'GH'
    | 'GI'
    | 'GL'
    | 'GM'
    | 'GN'
    | 'GP'
    | 'GQ'
    | 'GR'
    | 'GS'
    | 'GT'
    | 'GU'
    | 'GW'
    | 'GY'
    | 'HK'
    | 'HM'
    | 'HN'
    | 'HR'
    | 'HT'
    | 'HU'
    | 'ID'
    | 'IE'
    | 'IL'
    | 'IM'
    | 'IN'
    | 'IO'
    | 'IQ'
    | 'IR'
    | 'IS'
    | 'IT'
    | 'JE'
    | 'JM'
    | 'JO'
    | 'JP'
    | 'KE'
    | 'KG'
    | 'KH'
    | 'KI'
    | 'KM'
    | 'KN'
    | 'KP'
    | 'KR'
    | 'KW'
    | 'KY'
    | 'KZ'
    | 'LA'
    | 'LB'
    | 'LC'
    | 'LI'
    | 'LK'
    | 'LR'
    | 'LS'
    | 'LT'
    | 'LU'
    | 'LV'
    | 'LY'
    | 'MA'
    | 'MC'
    | 'MD'
    | 'ME'
    | 'MF'
    | 'MG'
    | 'MH'
    | 'MK'
    | 'ML'
    | 'MM'
    | 'MN'
    | 'MO'
    | 'MP'
    | 'MQ'
    | 'MR'
    | 'MS'
    | 'MT'
    | 'MU'
    | 'MV'
    | 'MW'
    | 'MX'
    | 'MY'
    | 'MZ'
    | 'NA'
    | 'NC'
    | 'NE'
    | 'NF'
    | 'NG'
    | 'NI'
    | 'NL'
    | 'NO'
    | 'NP'
    | 'NR'
    | 'NU'
    | 'NZ'
    | 'OM'
    | 'PA'
    | 'PE'
    | 'PF'
    | 'PG'
    | 'PH'
    | 'PK'
    | 'PL'
    | 'PM'
    | 'PN'
    | 'PR'
    | 'PS'
    | 'PT'
    | 'PW'
    | 'PY'
    | 'QA'
    | 'RE'
    | 'RO'
    | 'RS'
    | 'RU'
    | 'RW'
    | 'SA'
    | 'SB'
    | 'SC'
    | 'SD'
    | 'SE'
    | 'SG'
    | 'SH'
    | 'SI'
    | 'SJ'
    | 'SK'
    | 'SL'
    | 'SM'
    | 'SN'
    | 'SO'
    | 'SR'
    | 'SS'
    | 'ST'
    | 'SV'
    | 'SX'
    | 'SY'
    | 'SZ'
    | 'TC'
    | 'TD'
    | 'TF'
    | 'TG'
    | 'TH'
    | 'TJ'
    | 'TK'
    | 'TL'
    | 'TM'
    | 'TN'
    | 'TO'
    | 'TR'
    | 'TT'
    | 'TV'
    | 'TW'
    | 'TZ'
    | 'UA'
    | 'UG'
    | 'UM'
    | 'US'
    | 'UY'
    | 'UZ'
    | 'VA'
    | 'VC'
    | 'VE'
    | 'VG'
    | 'VI'
    | 'VN'
    | 'VU'
    | 'WF'
    | 'WS'
    | 'YE'
    | 'YT'
    | 'ZA'
    | 'ZM'
    | 'ZW'

/** Country codes other than the US. */
export type ForeignCountryCode = Exclude<CountryCode, 'US'>

interface CommonShippingOptions {
    /** Zip code of the origin. */
    originZip: string
    /** City of the origin. */
    originCity?: string | undefined
    /** State code of the origin. */
    originRegionCode?: string | undefined
    /** Whether the origin is a residential address. */
    isResidential?: boolean | undefined
    /** Package types to quote. */
    packageTypeKeys: PackageType[]
    /** Weight of the package in ounces. */
    weight: number
    /** Length of the package in inches. Ignored for flat rate package types. */
    dimensionX?: number | undefined
    /** Width of the package in inches. Ignored for flat rate package types. */
    dimensionY?: number | undefined
    /** Height of the package in inches. Ignored for flat rate package types. */
    dimensionZ?: number | undefined
    /**
     * Pricing models to quote.
     *
     * This selects rather than filters. Omitting it returns only the API's
     * preferred model per service, so cubic rates stay hidden behind a cheaper
     * weight rate until you ask for them by name.
     */
    pricingTypes?: PricingType[] | undefined
    /** Whether to show UPS rates when a 2x7 label is selected. */
    showUpsRatesWhen2x7Selected?: boolean | undefined
    /** Aborts the in-flight request. */
    signal?: AbortSignal | undefined
    /** Replaces the fetch implementation, for tests or instrumentation. */
    fetch?: typeof globalThis.fetch | undefined
}

/** Quote a destination inside the US. */
export interface DomesticShippingOptions extends CommonShippingOptions {
    /** Zip code of the destination. */
    destinationZip: string
    destinationCountryCode?: 'US' | undefined
    /** Services to quote. Only services that serve US destinations are allowed. */
    mailClassKeys: DomesticMailClassKey[]
}

/** Quote a destination outside the US. */
export interface InternationalShippingOptions extends CommonShippingOptions {
    /** Country code of the destination. */
    destinationCountryCode: ForeignCountryCode
    /** Postal code of the destination, where the country uses one. */
    destinationZip?: string | undefined
    /** Services to quote. Only services that ship internationally are allowed. */
    mailClassKeys: InternationalMailClassKey[]
}

export type ShippingOptions =
    | DomesticShippingOptions
    | InternationalShippingOptions
