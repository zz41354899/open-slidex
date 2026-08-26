/**
 * A selected Text layer is often mounted with editing enabled already. Treat
 * that first render as an activation instead of waiting for a false -> true
 * prop transition that may never happen.
 */
export function shouldFocusTextEditor(
  previousEnabled: boolean | undefined,
  enabled: boolean
) {
  return enabled && previousEnabled !== true;
}
