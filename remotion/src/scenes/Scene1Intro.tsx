import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const Scene1Intro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });
  const titleOp = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [20, 45], [50, 0], { extrapolateRight: "clamp" });
  const tagOp = interpolate(frame, [45, 70], [0, 1], { extrapolateRight: "clamp" });
  const tagY = interpolate(frame, [45, 70], [30, 0], { extrapolateRight: "clamp" });
  const lineW = interpolate(frame, [55, 85], [0, 400], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Logo */}
      <div
        style={{
          width: 110,
          height: 110,
          borderRadius: 24,
          background: "hsl(345, 60%, 35%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${logoScale})`,
          marginBottom: 35,
          boxShadow: "0 20px 60px rgba(140, 29, 59, 0.5)",
        }}
      >
        <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>

      <div
        style={{
          fontFamily: "serif",
          fontSize: 130,
          fontWeight: 700,
          color: "white",
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          letterSpacing: -3,
        }}
      >
        DigiCam
      </div>

      <div
        style={{
          width: lineW,
          height: 3,
          background: "linear-gradient(90deg, transparent, hsl(345, 60%, 45%), transparent)",
          marginTop: 20,
          marginBottom: 25,
          borderRadius: 2,
        }}
      />

      <div
        style={{
          fontFamily: "sans-serif",
          fontSize: 34,
          color: "rgba(255,255,255,0.65)",
          opacity: tagOp,
          transform: `translateY(${tagY}px)`,
          textAlign: "center",
          maxWidth: 900,
          letterSpacing: 1,
        }}
      >
        Votre plateforme de gestion documentaire
      </div>
    </AbsoluteFill>
  );
};
