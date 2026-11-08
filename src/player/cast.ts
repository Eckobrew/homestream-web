/** Cast SDK interaction is kept behind this narrow adapter for testable subtitle selection. */
export function selectCastSubtitles(sdk: { createRequest(ids: number[]): unknown; editTracks(request: unknown, success: () => void, failure: () => void): void }, index: number) {
  sdk.editTracks(sdk.createRequest(index < 0 ? [] : [index + 1]), () => {}, () => {});
}
