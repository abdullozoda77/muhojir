import { Building, Car, ChefHat, Factory, HardHat, Package, ShoppingCart, Sparkles, Sprout, Truck, Wrench } from "lucide-react";
import { t } from "./i18n.js";

// Same keys as INDUSTRIES in jobs/models.py.
export const INDUSTRIES = [
  { value: "construction", get label() { return t("Сохтмон"); }, icon: HardHat },
  { value: "warehouse", get label() { return t("Анбор"); }, icon: Package },
  { value: "delivery", get label() { return t("Расонидан"); }, icon: Truck },
  { value: "taxi", get label() { return t("Таксӣ ва ронандагӣ"); }, icon: Car },
  { value: "trade", get label() { return t("Савдо"); }, icon: ShoppingCart },
  { value: "food", get label() { return t("Ошхона ва қаҳвахона"); }, icon: ChefHat },
  { value: "cleaning", get label() { return t("Тозакунӣ"); }, icon: Sparkles },
  { value: "agriculture", get label() { return t("Кишоварзӣ"); }, icon: Sprout },
  { value: "manufacturing", get label() { return t("Истеҳсолот"); }, icon: Factory },
  { value: "other", get label() { return t("Дигар"); }, icon: Wrench },
];

export const industry = (value) => INDUSTRIES.find((i) => i.value === value) || { value, label: value, icon: Building };
