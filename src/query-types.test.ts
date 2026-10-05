/**
 * Keeps the hand-written types honest against the query we actually send.
 *
 * Each list below is checked two ways. `satisfies Record<keyof T, true>` makes
 * the compiler reject a list that is missing a key of the type or names one it
 * lacks. The test then compares the list to the pinned query. Together they
 * mean a type and the query cannot drift apart without something failing.
 *
 * After `bun run sync-query` changes the query, this is the test that tells you
 * which types to edit.
 */
import { describe, expect, test } from 'bun:test'
import { childFields, queryShape } from '../scripts/query-shape'
import { RATES_QUERY } from './rates-query'
import type {
    Carrier,
    DomesticShippingOptions,
    InternationalShippingOptions,
    MailClass,
    Rate,
    Surcharge,
} from './types'

const shape = queryShape(RATES_QUERY)

const keys = (record: Record<string, true>) => Object.keys(record).sort()

/** Options that configure this library rather than being sent to the API. */
const LOCAL_OPTIONS = ['fetch', 'signal']

/**
 * The GraphQL type the pinned query declares for each variable. A change here
 * means Pirate Ship retyped a variable, which may need a matching change to
 * `ShippingOptions`.
 */
const VARIABLE_TYPES: Record<string, string> = {
    originZip: 'String!',
    originCity: 'String',
    originRegionCode: 'String',
    destinationZip: 'String',
    isResidential: 'Boolean',
    destinationCountryCode: 'String',
    weight: 'Float',
    dimensionX: 'Float',
    dimensionY: 'Float',
    dimensionZ: 'Float',
    mailClassKeys: '[String!]!',
    packageTypeKeys: '[String!]!',
    pricingTypes: '[String!]',
    showUpsRatesWhen2x7Selected: 'Boolean',
}

/** Keys every variant of `T` requires. */
type RequiredKeys<T> = {
    [K in keyof T]-?: object extends Pick<T, K> ? never : K
}[keyof T]

/**
 * Options required for both domestic and international quotes. The compiler
 * keeps this list exact; the test checks every variable the API marks `!` is
 * in it, so a newly mandatory variable cannot be left optional by mistake.
 */
const ALWAYS_REQUIRED = {
    originZip: true,
    weight: true,
    mailClassKeys: true,
    packageTypeKeys: true,
} satisfies Record<
    RequiredKeys<DomesticShippingOptions> &
        RequiredKeys<InternationalShippingOptions>,
    true
>

type OptionKey =
    | keyof DomesticShippingOptions
    | keyof InternationalShippingOptions

const OPTION_KEYS = {
    originZip: true,
    originCity: true,
    originRegionCode: true,
    destinationZip: true,
    destinationCountryCode: true,
    isResidential: true,
    weight: true,
    dimensionX: true,
    dimensionY: true,
    dimensionZ: true,
    mailClassKeys: true,
    packageTypeKeys: true,
    pricingTypes: true,
    showUpsRatesWhen2x7Selected: true,
    fetch: true,
    signal: true,
} satisfies Record<OptionKey, true>

const RATE_KEYS = {
    title: true,
    deliveryDescription: true,
    trackingDescription: true,
    serviceDescription: true,
    pricingDescription: true,
    cubicTier: true,
    mailClassKey: true,
    mailClass: true,
    packageTypeKey: true,
    zone: true,
    surcharges: true,
    carrier: true,
    totalPrice: true,
    priceBaseTypeKey: true,
    basePrice: true,
    crossedTotalPrice: true,
    pricingType: true,
    pricingSubType: true,
    ratePeriodId: true,
    learnMoreUrl: true,
    cheapest: true,
    fastest: true,
    best: true,
    __typename: true,
} satisfies Record<keyof Rate, true>

const CARRIER_KEYS = {
    carrierKey: true,
    title: true,
    __typename: true,
} satisfies Record<keyof Carrier, true>

const MAIL_CLASS_KEYS = {
    accuracy: true,
    international: true,
    __typename: true,
} satisfies Record<keyof MailClass, true>

const SURCHARGE_KEYS = {
    title: true,
    price: true,
    __typename: true,
} satisfies Record<keyof Surcharge, true>

describe('types match the pinned query', () => {
    test('ShippingOptions exposes exactly the variables the query declares', () => {
        const sent = keys(OPTION_KEYS).filter(
            (key) => !LOCAL_OPTIONS.includes(key)
        )
        expect(sent).toEqual([...shape.variables.keys()].sort())
    })

    test('variables keep the types they were pinned with', () => {
        expect(Object.fromEntries(shape.variables)).toEqual(VARIABLE_TYPES)
    })

    test('every variable the API requires is required in ShippingOptions', () => {
        const mandatory = [...shape.variables]
            .filter(([, type]) => type.endsWith('!'))
            .map(([name]) => name)
        expect(keys(ALWAYS_REQUIRED)).toEqual(expect.arrayContaining(mandatory))
    })

    test('Rate declares exactly the fields the query selects', () => {
        expect(keys(RATE_KEYS)).toEqual(childFields(shape, 'rates').sort())
    })

    test.each([
        ['Carrier', 'rates.carrier', CARRIER_KEYS],
        ['MailClass', 'rates.mailClass', MAIL_CLASS_KEYS],
        ['Surcharge', 'rates.surcharges', SURCHARGE_KEYS],
    ] as const)('%s matches %s', (_name, path, record) => {
        expect(keys(record)).toEqual(childFields(shape, path).sort())
    })
})
