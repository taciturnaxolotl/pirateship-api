import { describe, expect, test } from 'bun:test'
import {
    fetchShippingRates,
    splitMailClassKey,
    mailClassName,
    carrierOf,
    stripFormatting,
    PirateShipHttpError,
    PirateShipNetworkError,
    PirateShipQueryRetiredError,
    PirateShipRequestError,
    isSaturdayDelivery,
    RATES_QUERY,
    RATES_QUERY_HASH,
    PirateShipValidationError,
    UpsDomesticService,
    UpsInternationalService,
} from './index'
import type { DomesticShippingOptions, Rate } from './index'

/**
 * Fixtures below are real payloads captured from the live endpoint. The API has
 * since been restricted to persisted queries, so these recordings are the only
 * way left to exercise the response handling.
 */

/** A real `Priority` rate, verbatim apart from trimming to the queried fields. */
const PRIORITY_RATE = {
    title: 'Priority Mail',
    deliveryDescription:
        'Estimated delivery [b]Monday 9/28 by 6:00 PM[/b] if shipped today',
    trackingDescription: 'Free Tracking',
    serviceDescription:
        '[link=https://support.pirateship.com/en/articles/4808542-how-do-i-file-a-usps-insurance-claim intercom-link]$100 carrier liability[/link]',
    pricingDescription: 'Commercial Pricing',
    cubicTier: null,
    mailClassKey: 'Priority',
    mailClass: {
        accuracy: null,
        international: false,
        __typename: 'CarrierMailClass',
    },
    packageTypeKey: 'Parcel',
    zone: '8',
    surcharges: [],
    carrier: { carrierKey: 'usps', title: 'USPS', __typename: 'Carrier' },
    totalPrice: 13.7,
    priceBaseTypeKey: 'ecommerce',
    basePrice: 13.7,
    crossedTotalPrice: 0,
    pricingType: 'weight',
    pricingSubType: 'default',
    ratePeriodId: 1,
    learnMoreUrl: 'https://www.pirateship.com/usps/priority-mail',
    cheapest: true,
    fastest: false,
    best: true,
    __typename: 'RateResult',
} as unknown as Rate

const OPTIONS: DomesticShippingOptions = {
    originZip: '43081',
    destinationZip: '90210',
    weight: 32,
    dimensionX: 9,
    dimensionY: 10,
    dimensionZ: 5,
    mailClassKeys: ['Priority'],
    packageTypeKeys: ['Parcel'],
}

/** A fetch stand-in that answers with one recorded payload. */
function stubJson(body: unknown, status = 200): typeof globalThis.fetch {
    return async () =>
        new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
        })
}

describe('fetchShippingRates', () => {
    test('returns priced rates with nothing unavailable', async () => {
        const quote = await fetchShippingRates({
            ...OPTIONS,
            fetch: stubJson({ data: { rates: [PRIORITY_RATE] } }),
        })
        expect(quote.rates).toHaveLength(1)
        expect(quote.rates[0]?.totalPrice).toBe(13.7)
        expect(quote.unavailable).toEqual([])
    })

    test('a service that cannot be priced is returned, not thrown', async () => {
        // Captured: Priority and Ground Advantage restricted to weight pricing,
        // where Ground Advantage's soft envelope rate is cubic-only.
        const quote = await fetchShippingRates({
            ...OPTIONS,
            mailClassKeys: ['Priority', 'GroundAdvantage'],
            pricingTypes: ['weight'],
            fetch: stubJson({
                data: { rates: [PRIORITY_RATE] },
                errors: [
                    {
                        message: 'Pricing type(s) weight not supported.',
                        extensions: {
                            rateError: {
                                code: 2002,
                                title: 'Ground Advantage',
                                mailClassKey: 'GroundAdvantage',
                                packageTypeKey: 'Parcel',
                            },
                        },
                    },
                ],
            }),
        })
        expect(quote.rates).toHaveLength(1)
        expect(quote.unavailable).toEqual([
            {
                mailClassKey: 'GroundAdvantage',
                packageTypeKey: 'Parcel',
                code: 2002,
                title: 'Ground Advantage',
                reason: 'Pricing type(s) weight not supported.',
            },
        ])
    })

    test('a rejected parameter throws and names the field', async () => {
        // Captured: mailClassKeys: ['Nonsense'] — the API returns no data key.
        const call = fetchShippingRates({
            ...OPTIONS,
            fetch: stubJson({
                errors: [
                    {
                        message: 'Mail Class Key Nonsense is not valid',
                        extensions: { field: 'mailClassKeys' },
                    },
                ],
            }),
        })
        expect(call).rejects.toBeInstanceOf(PirateShipRequestError)
        await call.catch((error: PirateShipRequestError) => {
            expect(error.field).toBe('mailClassKeys')
            expect(error.message).toBe('Mail Class Key Nonsense is not valid')
        })
    })

    test('an unrecognised API error throws with a null field', async () => {
        const call = fetchShippingRates({
            ...OPTIONS,
            fetch: stubJson({
                errors: [{ message: 'Syntax Error: Expected Name, found {' }],
            }),
        })
        expect(call).rejects.toBeInstanceOf(PirateShipRequestError)
        await call.catch((error: PirateShipRequestError) => {
            expect(error.field).toBeNull()
        })
    })

    test('a hash the server no longer knows throws QueryRetired', async () => {
        // Captured: what the endpoint says about an unregistered hash.
        const call = fetchShippingRates({
            ...OPTIONS,
            fetch: stubJson({
                errors: [
                    {
                        message: `Unknown persisted query id "${RATES_QUERY_HASH}".`,
                    },
                ],
            }),
        })
        expect(call).rejects.toBeInstanceOf(PirateShipQueryRetiredError)
        expect(call).rejects.toBeInstanceOf(PirateShipRequestError)
    })

    test('sends the pinned query by hash and never the query text', async () => {
        let body: Record<string, any> = {}
        await fetchShippingRates({
            ...OPTIONS,
            fetch: async (_url, init) => {
                body = JSON.parse(String(init?.body))
                return new Response(JSON.stringify({ data: { rates: [] } }))
            },
        })
        expect(body.operationName).toBe('RatesQuery')
        expect(body.extensions.persistedQuery).toEqual({
            version: 1,
            sha256Hash: RATES_QUERY_HASH,
        })
        expect(body).not.toHaveProperty('query')
    })

    test('a request-level error wins over any unavailable service', async () => {
        const call = fetchShippingRates({
            ...OPTIONS,
            fetch: stubJson({
                errors: [
                    {
                        message: 'Could not get matching rate',
                        extensions: {
                            rateError: {
                                code: 2001,
                                title: 'x',
                                mailClassKey: '11',
                                packageTypeKey: 'Parcel',
                            },
                        },
                    },
                    {
                        message: 'Destination Postcode abcde is not valid',
                        extensions: { field: 'destinationZip' },
                    },
                ],
            }),
        })
        expect(call).rejects.toBeInstanceOf(PirateShipRequestError)
    })

    test('a bot challenge throws with the edge details and a capped body', async () => {
        // Captured: Cloudflare serves ~932KB of HTML with no retry-after.
        const challenge = '<!DOCTYPE html><html>'.padEnd(900_000, 'x')
        const call = fetchShippingRates({
            ...OPTIONS,
            fetch: async () =>
                new Response(challenge, {
                    status: 429,
                    headers: {
                        'content-type': 'text/html',
                        'cf-mitigated': 'challenge',
                    },
                }),
        })
        expect(call).rejects.toBeInstanceOf(PirateShipHttpError)
        await call.catch((error: PirateShipHttpError) => {
            expect(error.status).toBe(429)
            expect(error.isChallenge).toBe(true)
            expect(error.blockedByEdge).toBe(true)
            expect(error.retryAfter).toBeNull()
            expect(error.retryable).toBe(true)
            expect(error.body.length).toBe(2048)
        })
    })

    test('a transport failure throws a network error preserving the cause', async () => {
        const cause = new TypeError('fetch failed')
        const call = fetchShippingRates({
            ...OPTIONS,
            fetch: async () => {
                throw cause
            },
        })
        expect(call).rejects.toBeInstanceOf(PirateShipNetworkError)
        await call.catch((error: Error) => {
            expect(error.cause).toBe(cause)
        })
    })

    test('dimensions below the minimum are rejected before any request', async () => {
        let called = false
        const call = fetchShippingRates({
            ...OPTIONS,
            dimensionX: 0.1,
            fetch: async () => {
                called = true
                return new Response('{}')
            },
        })
        expect(call).rejects.toBeInstanceOf(PirateShipValidationError)
        await call.catch((error: PirateShipValidationError) => {
            expect(error.field).toBe('dimensionX')
        })
        expect(called).toBe(false)
    })

    test('flat rate package types skip the dimension minimums', async () => {
        const quote = await fetchShippingRates({
            ...OPTIONS,
            dimensionX: 0.1,
            packageTypeKeys: ['SmallFlatRateBox'],
            fetch: stubJson({ data: { rates: [] } }),
        })
        expect(quote.rates).toEqual([])
    })

    test('an empty service list is rejected before any request', async () => {
        const call = fetchShippingRates({ ...OPTIONS, mailClassKeys: [] })
        expect(call).rejects.toBeInstanceOf(PirateShipValidationError)
    })

    test('non-wire options are not sent as GraphQL variables', async () => {
        let sent: Record<string, unknown> = {}
        await fetchShippingRates({
            ...OPTIONS,
            signal: new AbortController().signal,
            fetch: async (_url, init) => {
                sent = JSON.parse(String(init?.body)).variables
                return new Response(JSON.stringify({ data: { rates: [] } }))
            },
        })
        expect(sent).not.toHaveProperty('fetch')
        expect(sent).not.toHaveProperty('signal')
        expect(sent.originZip).toBe('43081')
    })
})

describe('pinned query', () => {
    test('the stored text hashes to the stored id', () => {
        const hash = new Bun.CryptoHasher('sha256')
            .update(RATES_QUERY)
            .digest('hex')
        expect(hash).toBe(RATES_QUERY_HASH)
    })
})

describe('isSaturdayDelivery', () => {
    // Captured: UPS Standard to Canada returns both of these under key '11'.
    const weekday = {
        surcharges: [
            { title: 'UPS Temporary Service Continuity Fee', price: 0.5 },
        ],
    }
    const saturday = {
        surcharges: [
            { title: 'UPS Temporary Service Continuity Fee', price: 0.5 },
            { title: 'Saturday Delivery', price: 4 },
        ],
    }
    test('tells the two rates under one key apart', () => {
        expect(isSaturdayDelivery(weekday as never)).toBe(false)
        expect(isSaturdayDelivery(saturday as never)).toBe(true)
    })
})

describe('splitMailClassKey', () => {
    test('separates a variant suffix from its service', () => {
        expect(splitMailClassKey('Priority_Cubic')).toEqual({
            mailClassKey: 'Priority',
            variant: 'Cubic',
        })
    })

    test('leaves an unsuffixed key alone', () => {
        expect(splitMailClassKey('Priority')).toEqual({
            mailClassKey: 'Priority',
            variant: null,
        })
    })

    test('prefers the longest variant, so Padded does not become a service', () => {
        // A shortest-first match splits this into the non-existent
        // service 'Priority_Padded'.
        expect(splitMailClassKey('Priority_Padded_Flat_Rate_Envelope')).toEqual(
            {
                mailClassKey: 'Priority',
                variant: 'Padded_Flat_Rate_Envelope',
            }
        )
        expect(
            splitMailClassKey(
                'PriorityMailInternational_Legal_Flat_Rate_Envelope'
            )
        ).toEqual({
            mailClassKey: 'PriorityMailInternational',
            variant: 'Legal_Flat_Rate_Envelope',
        })
    })

    test('does not mistake FirstGlobalRate for First plus a variant', () => {
        expect(splitMailClassKey('FirstGlobalRate')).toEqual({
            mailClassKey: 'FirstGlobalRate',
            variant: null,
        })
    })
})

describe('mailClassName', () => {
    test('names an opaque UPS code', () => {
        expect(mailClassName(UpsInternationalService.WorldwideSaver)).toBe(
            'WorldwideSaver'
        )
        expect(mailClassName(UpsDomesticService.Ground)).toBe('Ground')
    })

    test('names the USPS rate sold under a different label', () => {
        expect(mailClassName('FirstGlobalRate')).toBe('SimpleExportRate')
    })

    test('strips a variant before looking the service up', () => {
        expect(mailClassName('Priority_Small_Flat_Rate_Box')).toBe('Priority')
    })
})

describe('carrierOf', () => {
    test('maps numeric codes to UPS and names to USPS', () => {
        expect(carrierOf('03')).toBe('ups')
        expect(carrierOf('11')).toBe('ups')
        expect(carrierOf('Priority')).toBe('usps')
        expect(carrierOf('Priority_Cubic')).toBe('usps')
        expect(carrierOf('FirstGlobalRate')).toBe('usps')
    })
})

describe('stripFormatting', () => {
    test('removes the BBCode the API embeds in descriptions', () => {
        expect(stripFormatting('Estimated delivery in [b]6-10 days[/b]')).toBe(
            'Estimated delivery in 6-10 days'
        )
    })

    test('removes link tags and their attributes', () => {
        expect(
            stripFormatting(
                '[link=https://support.pirateship.com/en/articles/1 intercom-link]No carrier liability[/link]'
            )
        ).toBe('No carrier liability')
    })

    test('leaves plain text untouched', () => {
        expect(stripFormatting('Commercial Pricing')).toBe('Commercial Pricing')
    })
})
