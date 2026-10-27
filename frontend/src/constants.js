import {
  Beef, Building, Candy, Car, ChefHat, CookingPot, Croissant, Factory, HardHat, Package, Shirt, ShoppingBasket, ShoppingCart, Sparkles, Sprout, Store,
  Truck, UtensilsCrossed, Wrench,
} from "lucide-react";
import { t } from "./i18n.js";

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

export const SHOP_CATEGORIES = [
  { value: "grocery", get label() { return t("Озуқаворӣ"); }, icon: ShoppingBasket },
  { value: "meat", get label() { return t("Гӯшти ҳалол"); }, icon: Beef },
  { value: "bakery", get label() { return t("Нон ва самбӯса"); }, icon: Croissant },
  { value: "sweets", get label() { return t("Меваи хушк ва ширинӣ"); }, icon: Candy },
  { value: "cafe", get label() { return t("Ошхона ва таом"); }, icon: UtensilsCrossed },
  { value: "clothes", get label() { return t("Либос ва матоъ"); }, icon: Shirt },
  { value: "home", get label() { return t("Зарфу асбоби рӯзгор"); }, icon: CookingPot },
  { value: "other", get label() { return t("Дигар"); }, icon: Store },
];

export const shopCategory = (value) => SHOP_CATEGORIES.find((c) => c.value === value) || SHOP_CATEGORIES.at(-1);

export const SHOP_ORIGINS = [
  { value: "tj", flag: "🇹🇯", get label() { return t("Тоҷикӣ"); } },
  { value: "uz", flag: "🇺🇿", get label() { return t("Ӯзбекӣ"); } },
  { value: "mixed", flag: "🇹🇯🇺🇿", get label() { return t("Тоҷикӣ ва ӯзбекӣ"); } },
];

export const shopOrigin = (value) => SHOP_ORIGINS.find((o) => o.value === value) || SHOP_ORIGINS[0];

export const UNITS = [
  { value: "dona", get label() { return t("дона"); } },
  { value: "kg", get label() { return t("кг"); } },
  { value: "litr", get label() { return t("литр"); } },
  { value: "bandcha", get label() { return t("бандча"); } },
  { value: "qutti", get label() { return t("қуттӣ"); } },
  { value: "portion", get label() { return t("порсия"); } },
];

export const unitLabel = (value) => (UNITS.find((u) => u.value === value) || UNITS[0]).label;

export const CITIES = ["Москва", "Санкт-Петербург", "Екатеринбург", "Новосибирск", "Казань", "Краснодар", "Самара", "Нижний Новгород", "Ростов-на-Дону", "Тюмень"];
