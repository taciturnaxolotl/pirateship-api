/**
 * Check the library's value lists against the live API.
 *
 * `bun run probe` makes four requests, about two seconds apart:
 *
 * 1. One request listing every known and candidate key. The API names each
 *    invalid key in its own error, so a single call shows which keys we ship
 *    have been retired and which candidates have become valid.
 * 2. Three real quotes (domestic, Canada, Britain) asking for every service,
 *    package type, and pricing model. Every value that comes back must be in
 *    the matching exported list.
 *
 * Exits 0 when everything matches, 1 on drift, 2 when the API could not be
 * reached or blocked the run.
 */
import {
    CarrierKeys,
    PackageTypes,
    PriceBaseTypeKeys,
    PricingSubTypes,
    PricingTypes,
    RateVariants,
    UpsDomesticService,
    UpsInternationalService,
    UspsDomesticMailClass,
    UspsInternationalMailClass,
    splitMailClassKey,
} from '../src/index'
import { RATES_QUERY_HASH } from '../src/rates-query'

const ENDPOINT = 'https://ship.pirateship.com/api/graphql?opname=RatesQuery'
const PACKAGE = { weight: 32, dimensionX: 9, dimensionY: 10, dimensionZ: 5 }

const DOMESTIC = [
    ...Object.values(UspsDomesticMailClass),
    ...Object.values(UpsDomesticService),
] as string[]
const INTERNATIONAL = [
    ...Object.values(UspsInternationalMailClass),
    ...Object.values(UpsInternationalService),
] as string[]
const KNOWN_SERVICES = new Set([...DOMESTIC, ...INTERNATIONAL])

/** Keys worth trying in case Pirate Ship starts accepting them. */
const CANDIDATE_SERVICES = [
    ...Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0')),
    'FirstClass',
    'FirstClassPackage',
    'ParcelSelectLightweight',
    'LibraryMail',
    'BoundPrintedMatter',
    'RetailGround',
    'GroundAdvantageReturn',
    'PriorityMailReturn',
    'ConnectLocal',
    'GlobalExpressGuaranteed',
    'InternationalGroundAdvantage',
    'SimpleExportRate',
]
const CANDIDATE_PACKAGES = [
    'Box',
    'Envelope',
    'Letter',
    'LargeEnvelope',
    'Flat',
    'Tube',
    'ExpressEnvelope',
    'ExpressBox',
    'ExpressTube',
    'ExpressPak',
    'RegionalRateBoxA',
    'RegionalRateBoxB',
    'RegionalRateBoxC',
]
const CANDIDATE_PRICING = ['retail', 'commercial', 'dimensional']

/** Accepted by the API but left out of the library on purpose. */
const DELIBERATELY_OMITTED = new Set([
    // USPS retired Regional Rate; the API accepts these only to return an error.
    'RegionalRateBoxA',
    'RegionalRateBoxB',
])

interface GraphQlError {
    message?: string
    extensions?: { field?: string }
}
interface ProbeRate {
    mailClassKey: string
    packageTypeKey: string
    pricingType: string
    pricingSubType: string
    priceBaseTypeKey: string
    carrier: { carrierKey: string }
}

class Unreachable extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
let requests = 0

async function query(variables: Record<string, unknown>) {
    if (requests++ > 0) await sleep(2000)
    let response: Response
    try {
        response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                operationName: 'RatesQuery',
                variables,
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: RATES_QUERY_HASH,
                    },
                },
            }),
        })
    } catch (error) {
        throw new Unreachable(`request failed: ${(error as Error).message}`)
    }
    if (!response.ok) {
        const challenge = response.headers.get('cf-mitigated')
        throw new Unreachable(
            `API returned ${response.status}${challenge ? ` (cf-mitigated: ${challenge})` : ''}`
        )
    }
    const body = (await response.json()) as {
        data?: { rates?: ProbeRate[] | null }
        errors?: GraphQlError[]
    }
    const persisted = body.errors?.find((e) =>
        /persisted quer/i.test(e.message ?? '')
    )
    if (persisted) {
        throw new Unreachable(
            `${persisted.message} Run \`bun run sync-query\` first.`
        )
    }
    return body
}

/** Values named as invalid for a given field, read from the error messages. */
function rejected(
    errors: GraphQlError[] | undefined,
    field: string
): Set<string> {
    const names = new Set<string>()
    for (const error of errors ?? []) {
        if (error.extensions?.field !== field) continue
        const match = /^.* (\S+) is not valid/.exec(error.message ?? '')
        if (match) names.add(match[1] as string)
    }
    return names
}

const problems = new Set<string>()
const notes: string[] = []

function compareAccepted(
    label: string,
    known: readonly string[],
    candidates: readonly string[],
    invalid: Set<string>
) {
    for (const key of known) {
        if (invalid.has(key))
            problems.add(`${label} ${key} is no longer accepted`)
    }
    for (const key of candidates) {
        if (
            invalid.has(key) ||
            known.includes(key) ||
            DELIBERATELY_OMITTED.has(key)
        ) {
            continue
        }
        problems.add(`${label} ${key} is now accepted but not in the library`)
    }
}

async function checkAcceptedKeys() {
    const services = [...new Set([...KNOWN_SERVICES, ...CANDIDATE_SERVICES])]
    const packages = [...new Set([...PackageTypes, ...CANDIDATE_PACKAGES])]
    const pricing = [...new Set([...PricingTypes, ...CANDIDATE_PRICING])]
    const body = await query({
        originZip: '43081',
        destinationZip: '90210',
        ...PACKAGE,
        mailClassKeys: services,
        packageTypeKeys: packages,
        pricingTypes: pricing,
    })
    const invalidServices = rejected(body.errors, 'mailClassKeys')
    if (invalidServices.size === 0) {
        throw new Unreachable(
            'the API rejected none of 100+ candidate services, so its error format has probably changed'
        )
    }
    compareAccepted('service', [...KNOWN_SERVICES], services, invalidServices)
    compareAccepted(
        'package type',
        PackageTypes,
        packages,
        rejected(body.errors, 'packageTypeKeys')
    )
    compareAccepted(
        'pricing type',
        PricingTypes,
        pricing,
        rejected(body.errors, 'pricingTypes')
    )
}

async function checkReturnedValues() {
    const seen = {
        mailClassKey: new Set<string>(),
        packageTypeKey: new Set<string>(),
        pricingType: new Set<string>(),
        pricingSubType: new Set<string>(),
        priceBaseTypeKey: new Set<string>(),
        carrierKey: new Set<string>(),
    }
    let rejectedQuotes = 0
    const quotes = [
        { destinationZip: '90210', mailClassKeys: DOMESTIC },
        { destinationCountryCode: 'CA', mailClassKeys: INTERNATIONAL },
        { destinationCountryCode: 'GB', mailClassKeys: INTERNATIONAL },
    ]
    for (const destination of quotes) {
        const body = await query({
            originZip: '43081',
            ...PACKAGE,
            ...destination,
            packageTypeKeys: [...PackageTypes],
            pricingTypes: [...PricingTypes],
        })
        const fieldErrors = (body.errors ?? []).filter(
            (e) => e.extensions?.field
        )
        for (const error of fieldErrors)
            problems.add(`quote rejected: ${error.message}`)
        if (fieldErrors.length > 0) rejectedQuotes++
        for (const rate of body.data?.rates ?? []) {
            seen.mailClassKey.add(rate.mailClassKey)
            seen.packageTypeKey.add(rate.packageTypeKey)
            seen.pricingType.add(rate.pricingType)
            seen.pricingSubType.add(rate.pricingSubType)
            seen.priceBaseTypeKey.add(rate.priceBaseTypeKey)
            seen.carrierKey.add(rate.carrier.carrierKey)
        }
    }

    const lists: [keyof typeof seen, readonly string[]][] = [
        ['packageTypeKey', PackageTypes],
        ['pricingType', PricingTypes],
        ['pricingSubType', PricingSubTypes],
        ['priceBaseTypeKey', PriceBaseTypeKeys],
        ['carrierKey', CarrierKeys],
    ]
    for (const [field, known] of lists) {
        for (const value of seen[field]) {
            if (!known.includes(value))
                problems.add(`${field} '${value}' is not in the library`)
        }
        // A rejected quote returns nothing, so "not returned" would be noise.
        if (rejectedQuotes > 0) continue
        const unseen = known.filter((value) => !seen[field].has(value))
        if (unseen.length > 0)
            notes.push(`${field} not returned this run: ${unseen.join(', ')}`)
    }

    for (const key of seen.mailClassKey) {
        const { mailClassKey, variant } = splitMailClassKey(key as never)
        if (!KNOWN_SERVICES.has(mailClassKey)) {
            problems.add(
                `response key '${key}' does not split into a known service and RateVariant`
            )
        } else if (variant !== null && !RateVariants.includes(variant)) {
            problems.add(
                `response key '${key}' has unknown variant '${variant}'`
            )
        }
    }
}

try {
    await checkAcceptedKeys()
    await checkReturnedValues()
} catch (error) {
    if (error instanceof Unreachable) {
        console.error(`could not probe: ${error.message}`)
        process.exit(2)
    }
    throw error
}

for (const note of notes) console.log(`note: ${note}`)
if (problems.size === 0) {
    console.log(`library matches the API (${requests} requests)`)
    process.exit(0)
}
console.log(`${problems.size} difference(s) from the API:`)
for (const problem of problems) console.log(`  ${problem}`)
process.exit(1)
