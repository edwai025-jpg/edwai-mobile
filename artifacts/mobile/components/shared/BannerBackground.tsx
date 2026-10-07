import React, { useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Path, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";

import { Colors } from "@/constants/colors";

const STARS: [number, number, number][] = [
  [8, 12, 6], [4, 38, 82], [6, 70, 10], [5, 85, 60], [3, 22, 50],
];

export function BannerBackground() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };
  const { w, h } = size;
  const bookX = w * 0.9 - 160;
  const capX = w * 0.46;
  const capY = h * 0.82 - 100;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {w > 0 && (
        <Svg width={w} height={h}>
          <Defs>
            <Pattern id="dots" width={28} height={28} patternUnits="userSpaceOnUse">
              <Circle cx={14} cy={14} r={1.5} fill={Colors.bannerDot} />
            </Pattern>
            <RadialGradient id="violet" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#8b5cf6" stopOpacity={0.4} />
              <Stop offset="0.7" stopColor="#8b5cf6" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="indigo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#6366f1" stopOpacity={0.3} />
              <Stop offset="0.7" stopColor="#6366f1" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill="url(#dots)" />
          <Rect x={w * 0.82 - 220} y={60} width={220} height={220} fill="url(#violet)" />
          <Rect x={w * 0.3} y={h - 40 - 160} width={160} height={160} fill="url(#indigo)" />
          {/* open book outline */}
          <Path
            d={`M${bookX + 80} ${8 + 40} C${bookX + 55} ${8 + 25} ${bookX + 25} ${8 + 25} ${bookX + 5} ${8 + 32} L${bookX + 5} ${8 + 130} C${bookX + 25} ${8 + 123} ${bookX + 55} ${8 + 123} ${bookX + 80} ${8 + 140} C${bookX + 105} ${8 + 123} ${bookX + 135} ${8 + 123} ${bookX + 155} ${8 + 130} L${bookX + 155} ${8 + 32} C${bookX + 135} ${8 + 25} ${bookX + 105} ${8 + 25} ${bookX + 80} ${8 + 40} Z M${bookX + 80} ${8 + 40} L${bookX + 80} ${8 + 140}`}
            stroke={Colors.bannerOutline}
            strokeWidth={2}
            fill="none"
          />
          {/* graduation cap outline */}
          <Path
            d={`M${capX + 50} ${capY + 20} L${capX + 95} ${capY + 42} L${capX + 50} ${capY + 64} L${capX + 5} ${capY + 42} Z M${capX + 25} ${capY + 54} L${capX + 25} ${capY + 76} C${capX + 40} ${capY + 88} ${capX + 60} ${capY + 88} ${capX + 75} ${capY + 76} L${capX + 75} ${capY + 54}`}
            stroke={Colors.bannerOutline}
            strokeWidth={2}
            fill="none"
          />
          {STARS.map(([s, l, t], i) => {
            const points = Array.from({ length: 10 }, (_, n) => {
              const angle = n * Math.PI / 5 - Math.PI / 2;
              const radius = n % 2 ? s / 4 : s / 2;
              return `${n ? "L" : "M"}${w * l / 100 + Math.cos(angle) * radius} ${h * t / 100 + Math.sin(angle) * radius}`;
            }).join(" ");
            return <Path key={i} d={`${points} Z`} fill={Colors.bannerStar} />;
          })}
        </Svg>
      )}
    </View>
  );
}

export default BannerBackground;
