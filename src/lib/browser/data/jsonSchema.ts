/** JSON type names accepted by the `type` keyword. */
export type JsonSchemaType =
  'null' | 'boolean' | 'object' | 'array' | 'number' | 'integer' | 'string';

/** The JSON Schema 2020-12 subset this validator evaluates; any other keyword makes a schema unusable rather than silently ignored. */
export interface JsonSchema {
  /** Dialect identifier; annotation only. */
  $schema?: string;
  /** Schema identifier; annotation only. */
  $id?: string;
  /** Human-readable name; annotation only. */
  title?: string;
  /** Human-readable explanation; annotation only. */
  description?: string;
  /** Named subschemas addressed by `$ref`. */
  $defs?: Record<string, JsonSchema>;
  /** Same-document reference of the form `#/$defs/<name>`, evaluated together with sibling keywords. */
  $ref?: string;
  /** Accepted JSON type or types; `number` and `integer` require a finite value. */
  type?: JsonSchemaType | readonly JsonSchemaType[];
  /** The single accepted primitive value. */
  const?: string | number | boolean | null;
  /** The accepted primitive values. */
  enum?: readonly (string | number | boolean | null)[];
  /** Subschemas for named object properties. */
  properties?: Record<string, JsonSchema>;
  /** Property names an object must have. */
  required?: readonly string[];
  /** False to reject, or a subschema to validate, object properties that `properties` does not name. */
  additionalProperties?: boolean | JsonSchema;
  /** Subschema for array elements after those `prefixItems` covers. */
  items?: JsonSchema;
  /** Subschemas for leading array elements, by position. */
  prefixItems?: readonly JsonSchema[];
  /** Smallest accepted array length. */
  minItems?: number;
  /** Largest accepted array length. */
  maxItems?: number;
  /** Smallest accepted number. */
  minimum?: number;
  /** Largest accepted number. */
  maximum?: number;
  /** Positive integer a number must divide by exactly. */
  multipleOf?: number;
  /** Smallest accepted string length in Unicode code points. */
  minLength?: number;
  /** ECMAScript regular expression a string must match somewhere, evaluated with the `u` flag. */
  pattern?: string;
}

/** One way a value fails its schema. */
export interface SchemaIssue {
  /** JSON Pointer to the failing value; empty for the document root. */
  path: string;
  /** Requirement the value does not meet, phrased to follow the path. */
  message: string;
}

const ANNOTATIONS = new Set(['$schema', '$id', '$defs', 'title', 'description']);
const ASSERTIONS = new Set([
  '$ref',
  'type',
  'const',
  'enum',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'prefixItems',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'multipleOf',
  'minLength',
  'pattern'
]);
/** Roots already audited, so repeated validations do not walk the schema again. */
const audited = new WeakSet<JsonSchema>();
/** Compiled `pattern` expressions by source text; patterns come from checked-in schemas, so the cache stays small. */
const patterns = new Map<string, RegExp>();

/** Raised once the issue limit is reached, ending the traversal of an arbitrarily large document. */
class IssueLimit extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function primitive(value: unknown): boolean {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

/** List every keyword use this validator does not implement, and every malformed supported keyword, as `<location>: <problem>`; an empty list means the schema can be evaluated faithfully. */
export function unsupportedSchemaKeywords(root: JsonSchema): string[] {
  const problems: string[] = [];
  const walk = (schema: unknown, at: string): void => {
    if (!isObject(schema)) {
      problems.push(`${at}: a schema must be an object`);
      return;
    }
    for (const [keyword, value] of Object.entries(schema)) {
      const here = `${at}/${keyword}`;
      if (!ANNOTATIONS.has(keyword) && !ASSERTIONS.has(keyword)) {
        problems.push(`${here}: unsupported keyword`);
        continue;
      }
      switch (keyword) {
        case '$defs':
        case 'properties':
          if (!isObject(value)) problems.push(`${here}: must be an object`);
          else for (const [name, child] of Object.entries(value)) walk(child, `${here}/${name}`);
          break;
        case 'prefixItems':
          if (!Array.isArray(value)) problems.push(`${here}: must be an array`);
          else value.forEach((child, index) => walk(child, `${here}/${index}`));
          break;
        case 'items':
          walk(value, here);
          break;
        case 'additionalProperties':
          if (typeof value !== 'boolean') walk(value, here);
          break;
        case '$ref':
          if (typeof value !== 'string' || !resolveReference(root, value))
            problems.push(`${here}: must name a schema under #/$defs/`);
          break;
        case 'const':
          if (!primitive(value)) problems.push(`${here}: must be a primitive value`);
          break;
        case 'enum':
          if (!Array.isArray(value) || !value.every(primitive))
            problems.push(`${here}: must list primitive values`);
          break;
        case 'multipleOf':
          if (!Number.isInteger(value) || (value as number) <= 0)
            problems.push(`${here}: must be a positive integer`);
          break;
        case 'pattern':
          try {
            new RegExp(String(value), 'u');
          } catch {
            problems.push(`${here}: must be a valid regular expression`);
          }
          break;
      }
    }
  };
  walk(root, '#');
  return problems;
}

function resolveReference(root: JsonSchema, reference: string): JsonSchema | undefined {
  const name = reference.startsWith('#/$defs/') ? reference.slice('#/$defs/'.length) : '';
  return name && root.$defs && Object.hasOwn(root.$defs, name) ? root.$defs[name] : undefined;
}

function typeOf(value: unknown): JsonSchemaType | undefined {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'boolean':
    case 'string':
    case 'object':
      return typeof value as JsonSchemaType;
    case 'number':
      return Number.isFinite(value) ? 'number' : undefined;
    default:
      return undefined;
  }
}

function matchesType(value: unknown, expected: JsonSchemaType): boolean {
  const actual = typeOf(value);
  return expected === 'integer'
    ? actual === 'number' && Number.isInteger(value)
    : actual === expected;
}

function article(type: JsonSchemaType): string {
  return type === 'null' ? 'null' : `${/^[aeio]/.test(type) ? 'an' : 'a'} ${type}`;
}

/** Whether a string holds at least `minimum` Unicode code points, counting them only when its UTF-16 length is inconclusive. */
function hasCodePoints(value: string, minimum: number): boolean {
  if (value.length < minimum) return false;
  if (Math.ceil(value.length / 2) >= minimum) return true;
  let count = 0;
  for (let index = 0; index < value.length; index += value.codePointAt(index)! > 0xffff ? 2 : 1)
    if (++count >= minimum) return true;
  return false;
}

/**
 * Validate a parsed JSON value against a schema written in the supported 2020-12 subset, returning at most `limit` issues in
 * document order; an empty list means the value conforms. Throws when the schema itself uses an unsupported or malformed
 * keyword, which is a programming error in a checked-in schema rather than a property of the value.
 */
export function validateJsonSchema(root: JsonSchema, value: unknown, limit = 20): SchemaIssue[] {
  if (!audited.has(root)) {
    const problems = unsupportedSchemaKeywords(root);
    if (problems.length) throw new Error(`Unsupported JSON Schema: ${problems.join('; ')}`);
    audited.add(root);
  }
  const issues: SchemaIssue[] = [];
  const report = (path: string, message: string): void => {
    issues.push({ path, message });
    if (issues.length >= limit) throw new IssueLimit();
  };
  const pointer = (path: string, key: string | number): string =>
    `${path}/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`;

  const check = (schema: JsonSchema, value: unknown, path: string): void => {
    if (schema.$ref !== undefined) check(resolveReference(root, schema.$ref)!, value, path);
    if (schema.type !== undefined) {
      const types = typeof schema.type === 'string' ? [schema.type] : schema.type;
      if (!types.some((type) => matchesType(value, type))) {
        report(path, `must be ${types.map(article).join(' or ')}`);
        return;
      }
    }
    if (schema.const !== undefined && value !== schema.const)
      report(path, `must be ${JSON.stringify(schema.const)}`);
    if (schema.enum && !schema.enum.includes(value as never))
      report(
        path,
        `must be one of ${schema.enum.map((choice) => JSON.stringify(choice)).join(', ')}`
      );
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum)
        report(path, `must be at least ${schema.minimum}`);
      if (schema.maximum !== undefined && value > schema.maximum)
        report(path, `must be at most ${schema.maximum}`);
      if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0)
        report(path, `must be a multiple of ${schema.multipleOf}`);
    } else if (typeof value === 'string') {
      if (schema.minLength !== undefined && !hasCodePoints(value, schema.minLength))
        report(
          path,
          schema.minLength === 1
            ? 'must not be empty'
            : `must have at least ${schema.minLength} characters`
        );
      if (schema.pattern !== undefined) {
        let pattern = patterns.get(schema.pattern);
        if (!pattern) patterns.set(schema.pattern, (pattern = new RegExp(schema.pattern, 'u')));
        if (!pattern.test(value)) report(path, `must match ${schema.pattern}`);
      }
    } else if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems)
        report(path, `must have at least ${schema.minItems} items`);
      if (schema.maxItems !== undefined && value.length > schema.maxItems)
        report(path, `must have at most ${schema.maxItems} items`);
      const prefix = schema.prefixItems ?? [];
      for (let index = 0; index < value.length; index++) {
        const item = index < prefix.length ? prefix[index] : schema.items;
        if (item) check(item, value[index], pointer(path, index));
      }
    } else if (isObject(value)) {
      for (const name of schema.required ?? [])
        if (!Object.hasOwn(value, name)) report(path, `must have property "${name}"`);
      const properties = schema.properties ?? {};
      const additional = schema.additionalProperties;
      for (const [name, member] of Object.entries(value)) {
        if (Object.hasOwn(properties, name)) check(properties[name], member, pointer(path, name));
        else if (additional === false) report(path, `must not have property "${name}"`);
        else if (typeof additional === 'object') check(additional, member, pointer(path, name));
      }
    }
  };

  try {
    check(root, value, '');
  } catch (error) {
    if (!(error instanceof IssueLimit)) throw error;
  }
  return issues;
}
