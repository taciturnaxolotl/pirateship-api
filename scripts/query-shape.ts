/**
 * The shape of a GraphQL query: which variables it declares and which fields it
 * selects. Used to say exactly what changed when Pirate Ship edits its query,
 * and to check our hand-written types still match the pinned one.
 */
import {
    Kind,
    parse,
    print,
    type OperationDefinitionNode,
    type SelectionSetNode,
} from 'graphql'

export interface QueryShape {
    /** Variable name to its declared type, e.g. `originZip` to `String!`. */
    variables: Map<string, string>
    /** Every selected field as a dotted path, e.g. `rates.carrier.title`. */
    fields: Set<string>
}

export function queryShape(query: string): QueryShape {
    const operation = parse(query).definitions.find(
        (definition): definition is OperationDefinitionNode =>
            definition.kind === Kind.OPERATION_DEFINITION
    )
    if (!operation) throw new Error('query has no operation')

    const variables = new Map(
        (operation.variableDefinitions ?? []).map((definition) => [
            definition.variable.name.value,
            print(definition.type),
        ])
    )

    const fields = new Set<string>()
    const walk = (set: SelectionSetNode, prefix: string) => {
        for (const selection of set.selections) {
            if (selection.kind !== Kind.FIELD) continue
            const path = prefix + selection.name.value
            fields.add(path)
            if (selection.selectionSet) walk(selection.selectionSet, `${path}.`)
        }
    }
    walk(operation.selectionSet, '')
    return { variables, fields }
}

/** The fields directly under `parent`, e.g. `rates` or `rates.carrier`. */
export function childFields(shape: QueryShape, parent: string): string[] {
    const prefix = `${parent}.`
    return [...shape.fields]
        .filter((path) => path.startsWith(prefix))
        .map((path) => path.slice(prefix.length))
        .filter((name) => !name.includes('.'))
}

export interface ShapeDiff {
    variablesAdded: string[]
    variablesRemoved: string[]
    /** Variables whose declared type changed, as `name: old -> new`. */
    variablesRetyped: string[]
    fieldsAdded: string[]
    fieldsRemoved: string[]
}

export function diffShapes(before: QueryShape, after: QueryShape): ShapeDiff {
    const only = <T>(a: Iterable<T>, b: { has(value: T): boolean }) =>
        [...a].filter((value) => !b.has(value))
    return {
        variablesAdded: only(after.variables.keys(), before.variables),
        variablesRemoved: only(before.variables.keys(), after.variables),
        variablesRetyped: [...before.variables]
            .filter(
                ([name, type]) =>
                    after.variables.has(name) &&
                    after.variables.get(name) !== type
            )
            .map(
                ([name, type]) =>
                    `${name}: ${type} -> ${after.variables.get(name)}`
            ),
        fieldsAdded: only(after.fields, before.fields),
        fieldsRemoved: only(before.fields, after.fields),
    }
}
