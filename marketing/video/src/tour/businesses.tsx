// The kinds of business the menu run shows, each with its own menu (the photos are the
// app's sample menus in src/Catalog.API/Pics) and logo. All four are made-up brands
// with simple typographic logos; no real business appears in the video.
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadBungee } from "@remotion/google-fonts/Bungee";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import type React from "react";
import { DISHES } from "./ui";

const { fontFamily: anton } = loadAnton("normal", { weights: ["400"], subsets: ["latin"] });
const { fontFamily: bungee } = loadBungee("normal", { weights: ["400"], subsets: ["latin"] });
const { fontFamily: playfair } = loadPlayfair("italic", { weights: ["700"], subsets: ["latin"] });

export type Item = { key: string; name: string; note: string; price: number; img: string };
export type Business = {
  id: "mellow" | "zaytoun" | "smash" | "levelup";
  kind: string;
  name: string;
  categories: string[];
  items: Item[];
  // A wordmark drawn in the brand colour (the café's is CafeLogo in ui.tsx).
  logo?: (color: string, height: number) => React.ReactNode;
};

const fromDishes = (k: keyof typeof DISHES): Item => ({ key: k, ...DISHES[k] });

export const CHILLAX: Business = {
  id: "mellow",
  kind: "Café",
  name: "Mellow",
  categories: ["Coffee", "Iced", "Food", "Desserts"],
  items: (["latte", "mocha", "cappuccino", "waffle", "cake", "lemonade"] as const).map(fromDishes),
};

export const BUSINESSES: Business[] = [
  CHILLAX,
  {
    id: "smash",
    kind: "Burger kitchen",
    name: "Smash Lab",
    categories: ["Burgers", "Sides", "Wraps", "Drinks"],
    items: [
      { key: "smash", name: "Classic Smash", note: "Beef, cheddar, house sauce", price: 165, img: "smash" },
      { key: "double", name: "Double Smash", note: "Two patties, double cheese", price: 220, img: "double" },
      { key: "crispy", name: "Crispy Chicken", note: "Buttermilk fried, slaw", price: 175, img: "crispy" },
      { key: "cheesefries", name: "Cheese Fries", note: "Cheddar sauce, jalapeño", price: 85, img: "cheesefries" },
      { key: "shawarma", name: "Beef Shawarma", note: "Tahini, pickles, saj bread", price: 140, img: "shawarma" },
      { key: "rings", name: "Onion Rings", note: "Crispy, smoky dip", price: 70, img: "rings" },
    ],
    logo: (color, h) => (
      <span style={{ fontFamily: anton, fontSize: h * 1.05, lineHeight: 1, letterSpacing: "0.02em", color, textTransform: "uppercase" }}>
        Smash Lab
      </span>
    ),
  },
  {
    id: "zaytoun",
    kind: "Restaurant",
    name: "Zaytoun",
    categories: ["Grills", "Mezze", "Salads", "Sweets"],
    items: [
      { key: "grill", name: "Mixed Grill", note: "Kofta, tawook, lamb chops", price: 420, img: "grill" },
      { key: "tawook", name: "Shish Tawook", note: "Garlic sauce, grilled veg", price: 260, img: "tawook" },
      { key: "kofta", name: "Kofta", note: "Charcoal grilled, tahini", price: 240, img: "kofta" },
      { key: "fattoush", name: "Fattoush", note: "Sumac, crispy bread", price: 95, img: "fattoush" },
      { key: "hummus", name: "Hummus", note: "Olive oil, warm bread", price: 75, img: "hummus" },
      { key: "omali", name: "Om Ali", note: "Baked, nuts and cream", price: 90, img: "omali" },
    ],
    logo: (color, h) => (
      <span style={{ fontFamily: playfair, fontStyle: "italic", fontWeight: 700, fontSize: h * 1.1, lineHeight: 1, color }}>Zaytoun</span>
    ),
  },
  {
    id: "levelup",
    kind: "Game station",
    name: "Level Up",
    categories: ["Snacks", "Drinks", "Combos", "Sweets"],
    items: [
      { key: "pizza", name: "Mini Pizza", note: "Mozzarella, pepperoni", price: 120, img: "pizza" },
      { key: "nachos", name: "Loaded Nachos", note: "Cheese, salsa, jalapeño", price: 110, img: "nachos" },
      { key: "hotdog", name: "Hot Dog", note: "Mustard, crispy onions", price: 80, img: "hotdog" },
      { key: "gshake", name: "Milkshake", note: "Oreo or strawberry", price: 95, img: "gshake" },
      { key: "popcorn", name: "Popcorn", note: "Salted or caramel", price: 45, img: "popcorn" },
      { key: "mocktail", name: "Blue Mocktail", note: "Blue curaçao, lime, soda", price: 75, img: "mocktail" },
    ],
    logo: (color, h) => (
      <span style={{ fontFamily: bungee, fontSize: h * 0.85, lineHeight: 1, color }}>LEVEL UP</span>
    ),
  },
];

export const businessById = (id: Business["id"]) => BUSINESSES.find((b) => b.id === id) ?? CHILLAX;
