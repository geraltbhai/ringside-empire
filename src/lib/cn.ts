import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const money = (n: number, compact = true) =>
  (n < 0 ? "-" : "") +
  "$" +
  (compact
    ? Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Math.abs(n))
    : Math.abs(Math.round(n)).toLocaleString("en-US"));

export const heightLabel = (inches: number) => `${Math.floor(inches / 12)}'${inches % 12}"`;
