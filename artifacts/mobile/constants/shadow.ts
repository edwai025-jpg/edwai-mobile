import { Platform, processColor, type ColorValue, type ViewStyle } from "react-native";

/** Preserve native shadows and use their equivalent CSS representation on web. */
export function platformShadow(
  color: ColorValue,
  width: number,
  height: number,
  opacity: number,
  radius: number,
): ViewStyle {
  if (Platform.OS !== "web") {
    return {
      shadowColor: color,
      shadowOffset: { width, height },
      shadowOpacity: opacity,
      shadowRadius: radius,
    };
  }
  const value = processColor(color);
  if (typeof value !== "number") throw new Error("Unsupported web shadow color.");
  const red = (value >>> 16) & 255;
  const green = (value >>> 8) & 255;
  const blue = value & 255;
  const alpha = (((value >>> 24) & 255) / 255 * opacity).toFixed(2);
  return { boxShadow: `${width}px ${height}px ${radius}px rgba(${red},${green},${blue},${alpha})` };
}
