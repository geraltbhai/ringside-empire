/**
 * Business model. All figures are fictional in-game dollars.
 * Attendance depends on venue capacity, ticket price (elastic demand), brand
 * popularity, global audience demand, star power and marketing.
 */
import { clamp } from "./rng";
import type { BrandId, MoneyBreakdown, Show, Transaction, TransactionCategory, Universe, Venue } from "./types";
import { nextId } from "./ids";

export const REFERENCE_PRICE = { weekly: 45, ple: 95 } as const;
export const PRODUCTION_COST = { weekly: 600_000, ple: 3_200_000 } as const;
export const BROADCAST_FEE_PER_WEEKLY_SHOW = 300_000;
export const FIXED_WEEKLY_OVERHEAD = 260_000;

export function showBrandPopularity(universe: Universe, show: Show) {
  if (show.brand === "joint") return (universe.brands.mayhem.popularity + universe.brands.fury.popularity) / 2;
  return universe.brands[show.brand as BrandId].popularity;
}

export function starPower(universe: Universe, ids: string[]) {
  const pops = ids.map((id) => universe.wrestlers[id]?.popularity ?? 0).sort((a, b) => b - a);
  const top = pops.slice(0, 5);
  if (top.length === 0) return 30;
  return top.reduce((a, b) => a + b, 0) / top.length;
}

/** 0–1 index of how many fans want to see this show. */
export function demandIndex(universe: Universe, show: Show, bookedIds: string[]) {
  const brandPop = showBrandPopularity(universe, show);
  const stars = starPower(universe, bookedIds);
  return clamp((brandPop * 0.45 + universe.audienceDemand * 0.35 + stars * 0.2) / 100, 0, 1);
}

export function projectAttendance(universe: Universe, show: Show, venue: Venue, bookedIds: string[], noise = 0) {
  const demand = demandIndex(universe, show, bookedIds);
  const ref = REFERENCE_PRICE[show.type] * (venue.tier === "stadium" ? 1.1 : venue.tier === "club" ? 0.8 : 1);
  const priceFactor = Math.pow(ref / Math.max(5, show.ticketPrice), 0.75);
  const marketing = 1 + Math.min(0.18, show.marketingSpend / (show.type === "ple" ? 2_000_000 : 400_000));
  const pleBoost = show.type === "ple" ? 1.25 : 1;
  // Bigger buildings are harder to fill.
  const sizePenalty = venue.capacity > 30_000 ? 0.82 : venue.capacity < 5_000 ? 1.15 : 1;
  const fill = (0.2 + demand * 0.7) * priceFactor * marketing * pleBoost * sizePenalty * (1 + noise);
  return Math.round(clamp(fill, 0.05, 1) * venue.capacity);
}

export interface ShowEconomics {
  attendance: number;
  viewership: number;
  revenue: MoneyBreakdown;
  expenses: MoneyBreakdown;
  profit: number;
}

export function showEconomics(
  universe: Universe,
  show: Show,
  rating: number,
  bookedIds: string[],
  injuryCount: number,
  noise = 0,
): ShowEconomics {
  const venue = universe.venues.find((v) => v.id === show.venueId) ?? universe.venues[0];
  const attendance = projectAttendance(universe, show, venue, bookedIds, noise);
  const demand = demandIndex(universe, show, bookedIds);
  const stars = starPower(universe, bookedIds);
  const viewership = Math.round(
    (show.type === "ple" ? 400_000 : 700_000) + 2_400_000 * Math.pow(demand, 1.3) * (0.8 + rating / 250),
  );
  const brandRep =
    show.brand === "joint" ? (universe.brands.mayhem.reputation + universe.brands.fury.reputation) / 2 : universe.brands[show.brand as BrandId].reputation;

  const revenue: MoneyBreakdown = {
    tickets: attendance * show.ticketPrice,
    merchandise: Math.round(attendance * (3 + stars * 0.07) * (0.6 + rating / 180) + viewership * 0.012),
    sponsorship: Math.round(35_000 + brandRep * 900),
  };
  if (show.type === "weekly") {
    revenue.broadcast = Math.round(BROADCAST_FEE_PER_WEEKLY_SHOW * (0.7 + showBrandPopularity(universe, show) / 230));
  } else {
    // Streaming buys / premium-event package
    revenue.ple = Math.round(viewership * 0.4 * (0.7 + rating / 200));
  }
  if (rating >= 85) revenue.bonus = Math.round(show.type === "ple" ? 250_000 : 75_000);

  const expenses: MoneyBreakdown = {
    venue: venue.rent,
    production: PRODUCTION_COST[show.type],
    marketing: show.marketingSpend,
  };
  if (injuryCount > 0) expenses.medical = injuryCount * 30_000;

  const sum = (m: MoneyBreakdown) => Object.values(m).reduce((a, b) => a + b, 0);
  return { attendance, viewership, revenue, expenses, profit: sum(revenue) - sum(expenses) };
}

export function weeklyPayroll(universe: Universe, brand?: BrandId) {
  return Object.values(universe.wrestlers)
    .filter((w) => (w.brand === "mayhem" || w.brand === "fury") && (!brand || w.brand === brand))
    .reduce((s, w) => s + w.contract.weeklySalary, 0);
}

export function recordTransaction(
  universe: Universe,
  category: TransactionCategory,
  amount: number,
  note: string,
  brand: Transaction["brand"] = null,
) {
  if (amount === 0) return;
  universe.transactions.push({ id: nextId(universe, "tx"), week: universe.week, brand, category, amount: Math.round(amount), note });
  universe.cash += Math.round(amount);
}

export const REVENUE_CATEGORIES: TransactionCategory[] = ["tickets", "ple", "sponsorship", "merchandise", "broadcast", "bonus"];
export const EXPENSE_CATEGORIES: TransactionCategory[] = ["salaries", "venue", "production", "marketing", "medical", "signing"];

export function weeklyLedger(universe: Universe) {
  const byWeek = new Map<number, { week: number; revenue: number; expenses: number; profit: number; cash: number }>();
  let cash = universe.cash - universe.transactions.reduce((s, t) => s + t.amount, 0);
  const sorted = [...universe.transactions].sort((a, b) => a.week - b.week);
  for (const t of sorted) {
    const row = byWeek.get(t.week) ?? { week: t.week, revenue: 0, expenses: 0, profit: 0, cash: 0 };
    if (t.amount >= 0) row.revenue += t.amount;
    else row.expenses += -t.amount;
    byWeek.set(t.week, row);
  }
  const rows = [...byWeek.values()].sort((a, b) => a.week - b.week);
  for (const r of rows) {
    r.profit = r.revenue - r.expenses;
    cash += r.profit;
    r.cash = cash;
  }
  return rows;
}

export function brandProfit(universe: Universe, brand: BrandId | "joint") {
  return universe.transactions.filter((t) => t.brand === brand).reduce((s, t) => s + t.amount, 0);
}

/** Simple forecast: average of the last 4 weeks' profit plus known payroll changes. */
export function forecast(universe: Universe, weeks = 4) {
  const ledger = weeklyLedger(universe).slice(-4);
  const avgProfit = ledger.length ? ledger.reduce((s, r) => s + r.profit, 0) / ledger.length : 0;
  const out: { week: number; cash: number }[] = [];
  let cash = universe.cash;
  for (let i = 1; i <= weeks; i++) {
    cash += avgProfit;
    out.push({ week: universe.week + i, cash: Math.round(cash) });
  }
  return { avgProfit: Math.round(avgProfit), points: out };
}
