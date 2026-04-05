import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2Dashboard } from "./scenes/Scene2Dashboard";
import { Scene3Search } from "./scenes/Scene3Search";
import { Scene4Audit } from "./scenes/Scene4Audit";
import { Scene5Closing } from "./scenes/Scene5Closing";

export const MainVideo = () => {
  const frame = useCurrentFrame();
  const hueShift = interpolate(frame, [0, 750], [0, 25]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, hsl(${220 + hueShift}, 22%, 11%) 0%, hsl(${345 + hueShift * 0.5}, 15%, 14%) 100%)`,
      }}
    >
      {/* Floating accent circles */}
      <AbsoluteFill style={{ opacity: 0.05 }}>
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "hsl(345, 60%, 35%)",
            top: -200 + Math.sin(frame * 0.008) * 30,
            right: -100 + Math.cos(frame * 0.006) * 20,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "hsl(345, 50%, 45%)",
            bottom: -100 + Math.cos(frame * 0.01) * 25,
            left: -50 + Math.sin(frame * 0.007) * 15,
          }}
        />
      </AbsoluteFill>

      <TransitionSeries>
        {/* Intro */}
        <TransitionSeries.Sequence durationInFrames={120}>
          <Scene1Intro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 25 })}
        />
        {/* Dashboard */}
        <TransitionSeries.Sequence durationInFrames={150}>
          <Scene2Dashboard />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 25 })}
        />
        {/* Search */}
        <TransitionSeries.Sequence durationInFrames={150}>
          <Scene3Search />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 25 })}
        />
        {/* Audit */}
        <TransitionSeries.Sequence durationInFrames={150}>
          <Scene4Audit />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 30 })}
        />
        {/* Closing */}
        <TransitionSeries.Sequence durationInFrames={140}>
          <Scene5Closing />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
