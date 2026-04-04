import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const Scene3Solution = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeS = spring({ frame, fps, config: { damping: 20 } });
  const titleS = spring({ frame: frame - 15, fps, config: { damping: 18 } });
  const descS = spring({ frame: frame - 30, fps, config: { damping: 20 } });

  const pillars = [
    { icon: "🔍", label: "OCR & Recherche", desc: "Retrouvez n'importe quel document en secondes" },
    { icon: "🛡️", label: "Sécurité", desc: "Chiffrement, RLS, traçabilité complète" },
    { icon: "🏛️", label: "Souveraineté", desc: "Hébergement local possible" },
  ];

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          fontFamily: "sans-serif",
          fontSize: 18,
          fontWeight: 600,
          color: "hsl(345, 60%, 50%)",
          letterSpacing: 4,
          textTransform: "uppercase",
          opacity: interpolate(badgeS, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(badgeS, [0, 1], [20, 0])}px)`,
          marginBottom: 15,
        }}
      >
        La solution
      </div>

      <div
        style={{
          fontFamily: "serif",
          fontSize: 72,
          fontWeight: 700,
          color: "white",
          opacity: interpolate(titleS, [0, 1], [0, 1]),
          transform: `scale(${interpolate(titleS, [0, 1], [0.9, 1])})`,
          marginBottom: 60,
          textAlign: "center",
        }}
      >
        DigiCam
      </div>

      <div style={{ display: "flex", gap: 50 }}>
        {pillars.map((p, i) => {
          const s = spring({ frame: frame - 40 - i * 12, fps, config: { damping: 15, stiffness: 100 } });
          return (
            <div
              key={i}
              style={{
                width: 320,
                padding: "40px 30px",
                borderRadius: 16,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `translateY(${interpolate(s, [0, 1], [50, 0])}px)`,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>{p.icon}</div>
              <div style={{ fontFamily: "sans-serif", fontSize: 22, fontWeight: 700, color: "white", marginBottom: 10 }}>
                {p.label}
              </div>
              <div style={{ fontFamily: "sans-serif", fontSize: 16, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                {p.desc}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
