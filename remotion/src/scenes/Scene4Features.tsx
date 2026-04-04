import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const features = [
  { title: "Archive Numérique", desc: "Stockage sécurisé et organisé par départements", icon: "📁" },
  { title: "OCR Intelligent", desc: "Extraction automatique du texte de vos documents", icon: "📝" },
  { title: "Contrôle d'Accès", desc: "Niveaux de confidentialité et rôles granulaires", icon: "🔐" },
  { title: "Piste d'Audit", desc: "Traçabilité complète de chaque action", icon: "📊" },
  { title: "Multi-Organisation", desc: "Gestion centralisée de plusieurs entités", icon: "🏢" },
  { title: "Déploiement Flexible", desc: "Cloud, datacenter local ou sur site", icon: "☁️" },
];

export const Scene4Features = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 140px" }}>
      <div
        style={{
          fontFamily: "serif",
          fontSize: 56,
          fontWeight: 700,
          color: "white",
          opacity: titleOp,
          marginBottom: 60,
          textAlign: "center",
        }}
      >
        Fonctionnalités clés
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center", maxWidth: 1200 }}>
        {features.map((f, i) => {
          const delay = 20 + i * 10;
          const s = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 150 } });
          return (
            <div
              key={i}
              style={{
                width: 350,
                padding: "28px 24px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)`,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontFamily: "sans-serif", fontSize: 20, fontWeight: 700, color: "white", marginBottom: 6 }}>
                {f.title}
              </div>
              <div style={{ fontFamily: "sans-serif", fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>
                {f.desc}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
