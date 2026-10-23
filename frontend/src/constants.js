import { Building, Car, ChefHat, Factory, HardHat, Package, ShoppingCart, Sparkles, Sprout, Truck, Wrench } from "lucide-react";
import { t } from "./i18n.js";

// Same keys as INDUSTRIES in jobs/models.py.
export const INDUSTRIES = [
  { value: "construction", label: t("Сохтмон"), icon: HardHat },
  { value: "warehouse", label: t("Анбор"), icon: Package },
  { value: "delivery", label: t("Расонидан"), icon: Truck },
  { value: "taxi", label: t("Таксӣ ва ронандагӣ"), icon: Car },
  { value: "trade", label: t("Савдо"), icon: ShoppingCart },
  { value: "food", label: t("Ошхона ва қаҳвахона"), icon: ChefHat },
  { value: "cleaning", label: t("Тозакунӣ"), icon: Sparkles },
  { value: "agriculture", label: t("Кишоварзӣ"), icon: Sprout },
  { value: "manufacturing", label: t("Истеҳсолот"), icon: Factory },
  { value: "other", label: t("Дигар"), icon: Wrench },
];

export const industry = (value) => INDUSTRIES.find((i) => i.value === value) || { value, label: value, icon: Building };
