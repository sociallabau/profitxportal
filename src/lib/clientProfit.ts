/** Client profit calculator: the maths behind Dan's "Client Calculator" sheet. */

export type ClientInputs = {
  name: string;
  /** Monthly package price ($). */
  packagePrice: number;
  shootHours: number;
  managementHours: number;
  /** Videos and posts the editor handles each month. */
  videos: number;
};

export type SharedRates = {
  /** What your own time costs you per hour ($). */
  hourlyCost: number;
  /** What the editor charges per video ($). */
  editorCostPerVideo: number;
};

export type MarginRating = 'green' | 'yellow' | 'red';

export type ClientResult = {
  timeCost: number;
  editorCost: number;
  totalCost: number;
  netProfit: number;
  /** Net margin as a percentage, or null when there's no package price. */
  margin: number | null;
  rating: MarginRating | null;
};

export const GREEN_MARGIN = 60;
export const YELLOW_MARGIN = 40;

const n = (v: number) => (Number.isFinite(v) ? v : 0);

export function rateMargin(margin: number): MarginRating {
  if (margin >= GREEN_MARGIN) return 'green';
  if (margin >= YELLOW_MARGIN) return 'yellow';
  return 'red';
}

export function calculateClient(client: ClientInputs, rates: SharedRates): ClientResult {
  const timeCost = (n(client.shootHours) + n(client.managementHours)) * n(rates.hourlyCost);
  const editorCost = n(client.videos) * n(rates.editorCostPerVideo);
  const totalCost = timeCost + editorCost;
  const price = n(client.packagePrice);
  const netProfit = price - totalCost;
  const margin = price > 0 ? (netProfit / price) * 100 : null;
  return { timeCost, editorCost, totalCost, netProfit, margin, rating: margin === null ? null : rateMargin(margin) };
}
