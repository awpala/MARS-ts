import { describe, expect, it } from 'vitest';
import { unsupportedSchemaKeywords, validateJsonSchema, type JsonSchema } from './jsonSchema.js';

const schema: JsonSchema = {
  type: 'object',
  required: ['name', 'count'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, pattern: '^[a-z]+$' },
    count: { $ref: '#/$defs/count' },
    mode: { enum: ['fast', 'slow'] },
    kind: { const: 'record' },
    choice: { type: ['integer', 'null'], minimum: 0 },
    pair: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      prefixItems: [{ type: 'string' }],
      items: { type: 'boolean' }
    },
    labels: { type: 'object', additionalProperties: { type: 'string' } }
  },
  $defs: { count: { type: 'integer', minimum: 0, maximum: 8, multipleOf: 4 } }
};

const issues = (value: unknown) =>
  validateJsonSchema(schema, value).map(({ path, message }) => `${path} ${message}`);

describe('JSON Schema subset validation', () => {
  it('accepts a conforming value, including optional members and unconstrained maps', () => {
    expect(
      issues({
        name: 'abc',
        count: 4,
        mode: 'slow',
        kind: 'record',
        choice: null,
        pair: ['x', true],
        labels: { 'a/b': 'one', __proto__: 'two' }
      })
    ).toEqual([]);
    expect(issues({ name: 'a', count: 0 })).toEqual([]);
  });

  it('reports each failed keyword with a JSON Pointer to the failing value', () => {
    expect(issues(null)).toEqual([' must be an object']);
    expect(issues({ count: 5, extra: 1 })).toEqual([
      ' must have property "name"',
      '/count must be a multiple of 4',
      ' must not have property "extra"'
    ]);
    expect(issues({ name: '', count: 12 })).toEqual([
      '/name must not be empty',
      '/name must match ^[a-z]+$',
      '/count must be at most 8'
    ]);
    expect(issues({ name: 'a', count: -4, mode: 'idle', kind: 'other', choice: -1 })).toEqual([
      '/count must be at least 0',
      '/mode must be one of "fast", "slow"',
      '/kind must be "record"',
      '/choice must be at least 0'
    ]);
    expect(issues({ name: 'a', count: 1.5, choice: 'x' })).toEqual([
      '/count must be an integer',
      '/choice must be an integer or null'
    ]);
    expect(issues({ name: 'a', count: 0, pair: [1, 'x', true], labels: { 'a/b~c': 2 } })).toEqual([
      '/pair must have at most 2 items',
      '/pair/0 must be a string',
      '/pair/1 must be a boolean',
      '/labels/a~1b~0c must be a string'
    ]);
  });

  it('treats non-finite numbers as no number and counts string length in code points', () => {
    expect(validateJsonSchema({ type: 'number' }, Infinity)).toHaveLength(1);
    expect(validateJsonSchema({ type: 'integer' }, NaN)).toHaveLength(1);
    expect(validateJsonSchema({ type: 'string', minLength: 2 }, '😀')).toHaveLength(1);
    expect(validateJsonSchema({ type: 'string', minLength: 2 }, '😀a')).toEqual([]);
  });

  it('stops at the issue limit for an arbitrarily large document', () => {
    const many = Array.from({ length: 5000 }, () => 'x');
    expect(validateJsonSchema({ type: 'array', items: { type: 'integer' } }, many, 3)).toHaveLength(
      3
    );
  });

  it('refuses a schema that uses keywords it does not evaluate rather than ignoring them', () => {
    const unsupported = {
      type: 'object',
      properties: { a: { oneOf: [{ type: 'string' }] }, b: { $ref: '#/$defs/missing' } },
      patternProperties: {},
      $defs: { c: { enum: [{}], multipleOf: 0.5, pattern: '(' } }
    } as unknown as JsonSchema;
    expect(unsupportedSchemaKeywords(unsupported)).toEqual([
      '#/properties/a/oneOf: unsupported keyword',
      '#/properties/b/$ref: must name a schema under #/$defs/',
      '#/patternProperties: unsupported keyword',
      '#/$defs/c/enum: must list primitive values',
      '#/$defs/c/multipleOf: must be a positive integer',
      '#/$defs/c/pattern: must be a valid regular expression'
    ]);
    expect(() => validateJsonSchema(unsupported, {})).toThrow('Unsupported JSON Schema');
    expect(unsupportedSchemaKeywords(schema)).toEqual([]);
  });
});
