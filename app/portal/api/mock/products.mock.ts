import type { Product } from "../types";

/**
 * Static catalogue matching the 17-product development store.
 * imageUrl is null so the generated artwork is used; real API data
 * will carry image URLs and the artwork is ignored.
 */
export const MOCK_PRODUCTS: Product[] = [
  { id: "p01", title: "The Inventory Not Tracked Snowboard", vendor: "Analytics", category: "snowboard", price: 949.95, imageUrl: null, art: { kind: "boards", colors: ["#6a3cf0", "#3b2370"], accent: "#8f6bff" } },
  { id: "p02", title: "Gift Card", vendor: "Snowboard Vendor", category: "giftcard", price: 10, imageUrl: null, art: { kind: "gift", colors: ["#f2b04d", "#e2574c"] } },
  { id: "p03", title: "The Minimal Snowboard", vendor: "Analytics", category: null, price: 885.95, imageUrl: null },
  { id: "p04", title: "The Compare at Price Snowboard", vendor: "Analytics", category: "snowboard", price: 885.95, imageUrl: null, art: { kind: "boards", colors: ["#6fd0f0", "#c04fb8"], accent: "#f08be0" } },
  { id: "p05", title: "The Out of Stock Snowboard", vendor: "Analytics", category: "snowboard", price: 885.95, imageUrl: null, art: { kind: "boards", colors: ["#1b1b22", "#1f8f8a"], accent: "#2dd4bf" } },
  { id: "p06", title: "The Collection Snowboard: Hydrogen", vendor: "Hydrogen Vendor", category: "snowboard", price: 600, imageUrl: null, art: { kind: "boards", colors: ["#16161c", "#c9a4f5"], accent: "#2a2a35" } },
  { id: "p07", title: "The Complete Snowboard", vendor: "Snowboard Vendor", category: "snowboard", price: 699.95, imageUrl: null, art: { kind: "boards", colors: ["#16b8a6", "#0f5f68"], accent: "#e8fbf8" } },
  { id: "p08", title: "The Videographer Snowboard", vendor: "Analytics", category: "snowboard", price: 885.95, imageUrl: null, art: { kind: "boards", colors: ["#17a99a", "#13324a"], accent: "#f5a25d" } },
  { id: "p09", title: "Selling Plans Ski Wax", vendor: "Analytics", category: "accessories", price: 9.95, imageUrl: null, art: { kind: "wax", colors: ["#e8b923", "#c9971a"] } },
  { id: "p10", title: "The Hidden Snowboard", vendor: "Snowboard Vendor", category: "snowboard", price: 749.95, imageUrl: null, art: { kind: "boards", colors: ["#1b1b22", "#f06a8a"], accent: "#ffb36b" } },
  { id: "p11", title: "The Multi-location Snowboard", vendor: "Analytics", category: "snowboard", price: 729.95, imageUrl: null, art: { kind: "boards", colors: ["#1ee59a", "#1b6b4a"], accent: "#f5d76e" } },
  { id: "p12", title: "The 3p Fulfilled Snowboard", vendor: "Analytics", category: "snowboard", price: 2629.95, imageUrl: null, art: { kind: "boards", colors: ["#9ff2dc", "#33d1b0"], accent: "#e85a6b" } },
  { id: "p13", title: "The Multi-managed Snowboard", vendor: "Multi-managed Vendor", category: "snowboard", price: 629.95, imageUrl: null, art: { kind: "boards", colors: ["#f5e27a", "#f2a3c7"], accent: "#3a3a3a" } },
  { id: "p14", title: "The Collection Snowboard: Oxygen", vendor: "Hydrogen Vendor", category: "snowboard", price: 1025, imageUrl: null, art: { kind: "boards", colors: ["#c4425a", "#173847"], accent: "#ffe1e6" } },
  { id: "p15", title: "The Collection Snowboard: Liquid", vendor: "Hydrogen Vendor", category: "snowboard", price: 749.95, imageUrl: null, art: { kind: "boards", colors: ["#2b6fb3", "#1a2e5c"], accent: "#e9f1ff" } },
  { id: "p16", title: "Orange Snowboard", vendor: "Analytics", category: null, price: 0, imageUrl: null, art: { kind: "boards", colors: ["#2b6fb3", "#1a2e5c"], accent: "#e9f1ff" } },
  { id: "p17", title: "Yellow Snowboard", vendor: "Analytics", category: null, price: 100, imageUrl: null },
];
