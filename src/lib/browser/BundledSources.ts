/** Exact static source injected by Vite in development, tests, and production, without browser filesystem access. */
declare const __MARS_SPIM_EXCEPTIONS__: string;

/** Immutable source shipped with the application, outside the writable source library. */
export interface BundledSource {
  /** Reserved absolute virtual identity in a colon-bearing namespace that writable-library names cannot use. */
  readonly name: string;
  /** Human-readable purpose shown in source-selection controls. */
  readonly label: string;
  /** Exact bundled assembly text, including its upstream license notice. */
  readonly source: string;
}

/** SPIM's default handler and startup code, copyright James R. Larus, under its retained BSD notice. */
export const spimExceptionHandler: BundledSource = Object.freeze({
  name: '/SPIM:/exceptions.s',
  label: 'SPIM default exceptions handler',
  source: __MARS_SPIM_EXCEPTIONS__
});

/** Resolve a reserved source identity without consulting mutable editor buffers or browser storage. */
export function bundledSource(name: string): BundledSource | undefined {
  return name === spimExceptionHandler.name ? spimExceptionHandler : undefined;
}
