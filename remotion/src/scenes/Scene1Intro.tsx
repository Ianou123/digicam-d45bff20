import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const Scene1Intro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  const titleOpacity = interpolate(frame, [25, 50], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [25, 50], [40, 0], { extrapolateRight: "clamp" });
  const taglineOpacity = interpolate(frame, [50, 75], [0, 1], { extrapolateRight: "clamp" });
  const taglineY = interpolate(frame, [50, 75], [30, 0], { extrapolateRight: "clamp" });
  const lineWidth = interpolate(frame, [60, 90], [0, 300], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Logo icon */}
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: 20,
          background: "hsl(345, 60%, 35%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${logoScale})`,
          marginBottom: 30,
          boxShadow: "0 20px 60px rgba(140, 29, 59, 0.4)",
        }}
      >
        <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: "serif",
          fontSize: 120,
          fontWeight: 700,
          color: "white",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          letterSpacing: -2,
        }}
      >
        DigiCam
      </div>

      {/* Line */}
      <div
        style={{
          width: lineWidth,
          height: 3,
          background: "hsl(345, 60%, 35%)",
          marginTop: 20,
          marginBottom: 20,
          borderRadius: 2,
        }}
      />

      {/* Tagline */}
      <div
        style={{
          fontFamily: "sans-serif",
          fontSize: 32,
          color: "rgba(255,255,255,0.7)",
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          textAlign: "center",
          maxWidth: 800,
        }}
      >
        Digitalisez, recherchez et sécurisez vos documents
      </div>
    </AbsoluteFill>
  );
};
