import { finesCatalog } from "@/content/fines";

export type FinesMode = "hidden" | "neutral" | "amounts";

/**
 * hidden  — флаг выключен: блока штрафов нет, сумм на странице нет.
 * neutral — флаг включён, approved: false: фраза без цифр, калькулятора нет.
 * amounts — флаг включён и approved: true: таблица, шкала, калькулятор.
 */
export function finesMode(): FinesMode {
  if (process.env.NEXT_PUBLIC_SHOW_FINES !== "true") return "hidden";
  if (!finesCatalog.approved) return "neutral";
  return "amounts";
}

export function showFineAmounts(): boolean {
  return finesMode() === "amounts";
}
