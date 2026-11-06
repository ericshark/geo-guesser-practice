/**
 * Equirectangular projection into a 1000 x 500 SVG coordinate space:
 * x = (lon + 180) * (1000 / 360)
 * y = (90 - lat) * (500 / 180)
 */
export function projectLatLonToSvg(lat: number, lon: number): [number, number] {
  const x = Number(((lon + 180) * (1000 / 360)).toFixed(1));
  const y = Number(((90 - lat) * (500 / 180)).toFixed(1));
  return [x, y];
}
