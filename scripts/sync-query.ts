/**
 * Re-derive the rates query from Pirate Ship's own site.
 *
 * The endpoint only runs queries their frontend registered, keyed by the
 * SHA-256 of the printed query. Their public rate calculator ships the query as
 * a parsed document, so this fetches that bundle, prints the document the way
 * Apollo Client does before hashing, and compares the result to the pinned copy.
 *
 *   bun run sync-query          rewrite src/rates-query.ts if it changed
 *   bun run sync-query --check  exit 1 if it changed, write nothing
 */
import {
    Kind,
    print,
    visit,
    type DocumentNode,
    type SelectionSetNode,
} from 'graphql'
import { RATES_QUERY, RATES_QUERY_HASH } from '../src/rates-query'
import { diffShapes, queryShape } from './query-shape'

const CALCULATOR = 'https://www.pirateship.com/usps/shipping-calculator'
const OPERATION = 'RatesQuery'
const TARGET = new URL('../src/rates-query.ts', import.meta.url).pathname

async function text(url: string): Promise<string> {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${url} returned ${response.status}`)
    return response.text()
}

/** Find the script bundles the calculator page loads. */
async function bundles(): Promise<string[]> {
    const html = await text(CALCULATOR)
    const urls = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map(
        (match) => new URL(match[1] as string, CALCULATOR).href
    )
    if (urls.length === 0) throw new Error(`no scripts found on ${CALCULATOR}`)
    return urls
}

/**
 * Pull a named operation's document out of minified source.
 *
 * Bundlers inline gql documents as plain object literals, so the document is
 * the balanced `{kind:\`Document\`...}` enclosing the operation's name.
 */
function extractDocument(source: string, name: string): DocumentNode | null {
    const marker = `name:{kind:\`Name\`,value:\`${name}\`}`
    const at = source.indexOf(marker)
    if (at < 0) return null
    const start = source.lastIndexOf('{kind:`Document`', at)
    if (start < 0) return null
    let depth = 0
    for (let i = start; i < source.length; i++) {
        if (source[i] === '{') depth++
        else if (source[i] === '}' && --depth === 0) {
            return new Function(`return (${source.slice(start, i + 1)})`)()
        }
    }
    return null
}

/** Apollo Client adds `__typename` to every selection set below the operation. */
function addTypename(document: DocumentNode): DocumentNode {
    return visit(document, {
        SelectionSet: {
            enter(node: SelectionSetNode, _key, parent) {
                if (
                    parent &&
                    !Array.isArray(parent) &&
                    (parent as { kind?: string }).kind ===
                        Kind.OPERATION_DEFINITION
                ) {
                    return undefined
                }
                const hasTypename = node.selections.some(
                    (s) =>
                        s.kind === Kind.FIELD && s.name.value === '__typename'
                )
                if (hasTypename) return undefined
                return {
                    ...node,
                    selections: [
                        ...node.selections,
                        {
                            kind: Kind.FIELD,
                            name: { kind: Kind.NAME, value: '__typename' },
                        },
                    ],
                }
            },
        },
    })
}

const sha256 = (value: string) =>
    new Bun.CryptoHasher('sha256').update(value).digest('hex')

if (import.meta.main) await main()

async function main(): Promise<void> {
    let document: DocumentNode | null = null
    for (const url of await bundles()) {
        document = extractDocument(await text(url), OPERATION)
        if (document) break
    }
    if (!document) {
        console.error(`${OPERATION} not found in any bundle on ${CALCULATOR}`)
        process.exit(2)
    }

    const query = print(addTypename(document))
    const hash = sha256(query)

    if (hash === RATES_QUERY_HASH && query === RATES_QUERY) {
        console.log(`${OPERATION} unchanged (${hash})`)
        process.exit(0)
    }

    console.log(`${OPERATION} changed`)
    console.log(`  pinned: ${RATES_QUERY_HASH}`)
    console.log(`  live:   ${hash}`)

    const diff = diffShapes(queryShape(RATES_QUERY), queryShape(query))
    const report: [string, string[]][] = [
        ['variables added', diff.variablesAdded],
        ['variables removed', diff.variablesRemoved],
        ['variables retyped', diff.variablesRetyped],
        ['fields added', diff.fieldsAdded],
        ['fields removed', diff.fieldsRemoved],
    ]
    for (const [label, items] of report) {
        if (items.length > 0) console.log(`  ${label}: ${items.join(', ')}`)
    }
    if (report.every(([, items]) => items.length === 0)) {
        console.log('  variables and fields unchanged')
    }

    const accepted = await serverAccepts(hash)
    console.log(
        accepted
            ? '  the API accepts the new hash'
            : '  the API REJECTS the new hash: the printing rules have probably changed'
    )

    if (process.argv.includes('--check')) process.exit(1)
    if (!accepted) {
        console.error('not writing a hash the API rejects')
        process.exit(3)
    }

    await Bun.write(TARGET, render(query, hash))
    await Bun.$`bunx prettier --write ${TARGET}`.quiet()
    console.log(`wrote ${TARGET}`)

    const needsTypes =
        diff.variablesAdded.length +
        diff.variablesRemoved.length +
        diff.variablesRetyped.length +
        diff.fieldsAdded.length +
        diff.fieldsRemoved.length
    if (needsTypes > 0) {
        console.log(
            'update ShippingOptions and Rate in src/types.ts to match; `bun test` fails until they do'
        )
    }
}

/** Ask the API whether it knows a hash. Any answer but "unknown query" is a yes. */
export async function serverAccepts(candidate: string): Promise<boolean> {
    const response = await fetch(
        'https://ship.pirateship.com/api/graphql?opname=RatesQuery',
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                operationName: OPERATION,
                variables: {
                    originZip: '43081',
                    destinationZip: '90210',
                    weight: 16,
                    mailClassKeys: ['Priority'],
                    packageTypeKeys: ['FlatRateEnvelope'],
                },
                extensions: {
                    persistedQuery: { version: 1, sha256Hash: candidate },
                },
            }),
        }
    )
    if (!response.ok) {
        throw new Error(
            `could not check the hash: the API returned ${response.status}`
        )
    }
    const body = (await response.json()) as {
        errors?: { message?: string }[]
    }
    return !(body.errors ?? []).some((error) =>
        /persisted quer/i.test(error.message ?? '')
    )
}

function render(query: string, hash: string): string {
    return `/**
 * The rates query Pirate Ship's own site sends.
 *
 * The endpoint only executes queries it has registered, identified by the
 * SHA-256 of their printed text. This is a verbatim copy of theirs, so its hash
 * matches what the server expects. Edit nothing here by hand: a single changed
 * character changes the hash and every request fails. Regenerate it with
 * \`bun run sync-query\`.
 */
export const RATES_QUERY = ${JSON.stringify(query)}

/** SHA-256 of \`RATES_QUERY\`, the id the server knows it by. */
export const RATES_QUERY_HASH = '${hash}'

/** The variables \`RATES_QUERY\` declares. Anything else would be ignored. */
export const RATES_QUERY_VARIABLES: ReadonlySet<string> = new Set(
    [...RATES_QUERY.slice(0, RATES_QUERY.indexOf(')')).matchAll(/\\$(\\w+):/g)].map(
        (match) => match[1] as string
    )
)
`
}
