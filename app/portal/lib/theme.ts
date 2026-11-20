import { createContext, useContext } from "react";

export type Theme = "light" | "dark";

export const ThemeContext = createContext<Theme>("light");

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Colours for charts (SVG attributes cannot read CSS variables everywhere). */
export interface ChartPalette {
  primary: string;
  strong: string;
  light: string;
  orange: string;
  red: string;
  teal: string;
  gray: string;
  grid: string;
  axis: string;
  areaTop: string;
  surface: string;
  border: string;
  ink: string;
  muted: string;
  sliceStroke: string;
}

const LIGHT: ChartPalette = {
  primary: "#6d4aff",
  strong: "#5b3bd6",
  light: "#9b7bff",
  orange: "#e0821f",
  red: "#dd5c46",
  teal: "#0b7c9c",
  gray: "#a29ec4",
  grid: "#eeedf3",
  axis: "#6b6a8a",
  areaTop: "#e4dcff",
  surface: "#ffffff",
  border: "#e3e3e9",
  ink: "#201d33",
  muted: "#54527a",
  sliceStroke: "#fbfaff",
};

const DARK: ChartPalette = {
  primary: "#8b6dff",
  strong: "#6f55e8",
  light: "#b9a5ff",
  orange: "#f0a04b",
  red: "#f07a64",
  teal: "#3cc0e0",
  gray: "#6f6c95",
  grid: "#2c2a42",
  axis: "#8f8db0",
  areaTop: "#3a2f80",
  surface: "#222035",
  border: "#34324d",
  ink: "#f1effa",
  muted: "#b0aed0",
  sliceStroke: "#1b1a2a",
};

export function useChartPalette(): ChartPalette {
  return useTheme() === "dark" ? DARK : LIGHT;
}
