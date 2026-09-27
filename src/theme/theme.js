// Single source of design tokens. Screens should pull from here instead
// of hardcoding hex values/spacing, so the "ClothMarket identity" stays
// consistent across every screen we add in later phases without a
// design-system rewrite each time.
export const colors = {
  primary: "#1E293B",
  accent: "#F97316",
  background: "#FFFFFF",
  surface: "#F8FAFC",
  border: "#E2E8F0",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  danger: "#DC2626",
  success: "#16A34A",
  white: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" },
  h2: { fontSize: 22, fontWeight: "700" },
  body: { fontSize: 16, fontWeight: "400" },
  caption: { fontSize: 13, fontWeight: "400" },
};

export const radii = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export default { colors, spacing, typography, radii };
