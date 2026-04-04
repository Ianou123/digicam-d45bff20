import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";

const problems = [
  "📄 Des milliers de documents papier",
  "🔍 Recherche manuelle interminable",
  "🔒 Aucune traçabilité ni sécurité",
];

export const Scene2Problem = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleX = interpolate(frame, [0, 20], [-60, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 180px" }}>
      <div
        style={{
          fontFamily: "sans-serif",
          fontSize: 18,
          fontWeight: 600,
          color: "hsl(345, 60%, 50%)",
          letterSpacing: 4,
          textTransform: "uppercase",
          opacity: titleOpacity,
          transform: `translateX(${titleX}px)`,
          marginBottom: 20,
        }}
      >
        Le problème
      </div>

      <div
        style={{
          fontFamily: "serif",
          fontSize: 64,
          fontWeight: 700,
          color: "white",
          opacity: titleOpacity,
          transform: `translateX(${titleX}px)`,
          lineHeight: 1.2,
          marginBottom: 50,
        }}
      >
        La gestion documentaire
        <br />
        reste archaïque
      </div>

      {problems.map((problem, i) => {
        const delay = 30 + i * 18;
        const s = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 120 } });
        const opacity = interpolate(s, [0, 1], [0, 1]);
        const x = interpolate(s, [0, 1], [80, 0]);

        return (
          <div
            key={i}
            style={{
              fontFamily: "sans-serif",
              fontSize: 30,
              color: "rgba(255,255,255,0.85)",
              opacity,
              transform: `translateX(${x}px)`,
              marginBottom: 20,
              paddingLeft: 20,
              borderLeft: "3px solid hsl(345, 60%, 35%)",
            }}
          >
            {problem}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
