import { Colors } from "./colors";
import { platformShadow } from "./shadow";

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  full: 9999,
};

export const Typography = {
  xs: { fontSize: 11, lineHeight: 16 },
  sm: { fontSize: 13, lineHeight: 20 },
  base: { fontSize: 14, lineHeight: 22 },
  md: { fontSize: 15, lineHeight: 24 },
  lg: { fontSize: 16, lineHeight: 26 },
  xl: { fontSize: 18, lineHeight: 28 },
  "2xl": { fontSize: 20, lineHeight: 30 },
  "3xl": { fontSize: 24, lineHeight: 34 },
  "4xl": { fontSize: 28, lineHeight: 38 },

  weight: {
    regular: "Inter_400Regular" as const,
    medium: "Inter_500Medium" as const,
    semibold: "Inter_600SemiBold" as const,
    bold: "Inter_700Bold" as const,
  },
};

export const Shadow = {
  sm: {
    ...platformShadow(Colors.navy, 0, 2, 0.06, 4),
    elevation: 2,
  },
  md: {
    ...platformShadow(Colors.navy, 0, 4, 0.08, 12),
    elevation: 4,
  },
  lg: {
    ...platformShadow(Colors.navy, 0, 8, 0.12, 24),
    elevation: 8,
  },
};

export const Theme = {
  colors: Colors,
  spacing: Spacing,
  radius: Radius,
  typography: Typography,
  shadow: Shadow,
};

export default Theme;
