// Test oracle only: deliberately absent from the package's public exports.
export function enumerateStrings(alphabet: readonly string[], maxLength: number): string[] {
  if (!Number.isInteger(maxLength) || maxLength < 0) throw new Error('Length must be a nonnegative integer.');
  if (new Set(alphabet).size !== alphabet.length || alphabet.some(s => [...s].length !== 1 || s === 'ε')) throw new Error('Invalid alphabet.');
  const symbols = [...alphabet].sort();
  const strings = [''];
  let layer = [''];
  for (let length = 1; length <= maxLength; length++) {
    layer = layer.flatMap(prefix => symbols.map(symbol => prefix + symbol));
    strings.push(...layer);
  }
  return strings;
}
