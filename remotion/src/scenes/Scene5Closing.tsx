import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const Scene5Closing = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoS = spring({ frame, fps, config: { damping: 12 } });
  const titleS = spring({ frame: frame - 15, fps, config: { damping: 18 } });
  const tagS = spring({ frame: frame - 35, fps, config: { damping: 20 } });
  const urlS = spring({ frame: frame - 55, fps, config: { damping: 15 } });
  const pulse = 1 + Math.sin(frame * 0.08) * 0.012;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: "radial-gradient(circle, hsla(345, 60%, 35%, 0.18) 0%, transparent 70%)",
        }}
      />

      <div
        style={{
          width: 95,
          height: 95,
          borderRadius: 20,
          background: "hsl(345, 60%, 35%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${logoS})`,
          marginBottom: 30,
          boxShadow: "0 15px 50px rgba(140, 29, 59, 0.5)",
        }}
      >
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>

      <div
        style={{
          fontFamily: "serif",
          fontSize: 100,
          fontWeight: 700,
          color: "white",
          opacity: interpolate(titleS, [0, 1], [0, 1]),
          transform: `scale(${interpolate(titleS, [0, 1], [0.85, 1])})`,
          marginBottom: 15,
          letterSpacing: -2,
        }}
      >
        DigiCam
      </div>

      <div
        style={{
          fontFamily: "sans-serif",
          fontSize: 28,
          color: "rgba(255,255,255,0.6)",
          opacity: interpolate(tagS, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(tagS, [0, 1], [20, 0])}px)`,
          textAlign: "center",
          marginBottom: 45,
          maxWidth: 700,
        }}
      >
        Pensé pour les entreprises et administrations africaines
      </div>

      <div
        style={{
          padding: "16px 48px",
          borderRadius: 12,
          background: "hsl(345, 60%, 35%)",
          fontFamily: "sans-serif",
          fontSize: 22,
          fontWeight: 600,
          color: "white",
          opacity: interpolate(urlS, [0, 1], [0, 1]),
          transform: `scale(${interpolate(urlS, [0, 1], [0.8, 1]) * pulse})`,
          boxShadow: "0 10px 40px rgba(140, 29, 59, 0.4)",
        }}
      >
        digicam.lovable.app
      </div>
    </AbsoluteFill>
  );
};
