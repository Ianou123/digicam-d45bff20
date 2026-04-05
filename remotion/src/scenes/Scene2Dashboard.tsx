import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile, Img } from "remotion";

export const Scene2Dashboard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Badge
  const badgeS = spring({ frame, fps, config: { damping: 20 } });
  // Title
  const titleS = spring({ frame: frame - 10, fps, config: { damping: 18 } });
  // Screenshot
  const imgS = spring({ frame: frame - 25, fps, config: { damping: 15, stiffness: 80 } });
  const imgScale = interpolate(imgS, [0, 1], [0.85, 1]);
  const imgOp = interpolate(imgS, [0, 1], [0, 1]);
  // Subtle float
  const floatY = Math.sin(frame * 0.04) * 4;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Badge */}
      <div
        style={{
          fontFamily: "sans-serif",
          fontSize: 16,
          fontWeight: 700,
          color: "hsl(345, 60%, 50%)",
          letterSpacing: 5,
          textTransform: "uppercase",
          opacity: interpolate(badgeS, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(badgeS, [0, 1], [20, 0])}px)`,
          marginBottom: 12,
        }}
      >
        Tableau de bord
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: "serif",
          fontSize: 52,
          fontWeight: 700,
          color: "white",
          opacity: interpolate(titleS, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(titleS, [0, 1], [30, 0])}px)`,
          marginBottom: 40,
          textAlign: "center",
        }}
      >
        Vue d'ensemble en temps réel
      </div>

      {/* Screenshot in MacBook-style frame */}
      <div
        style={{
          opacity: imgOp,
          transform: `scale(${imgScale}) translateY(${floatY}px)`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
          position: "relative",
        }}
      >
        {/* Window chrome */}
        <div
          style={{
            height: 36,
            background: "rgba(30,30,30,0.95)",
            display: "flex",
            alignItems: "center",
            paddingLeft: 16,
            gap: 8,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f56" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ffbd2e" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#27c93f" }} />
        </div>
        <Img
          src={staticFile("images/digicam-graphic-1-dashboard.png")}
          style={{ width: 1200, display: "block" }}
        />
      </div>
    </AbsoluteFill>
  );
};
