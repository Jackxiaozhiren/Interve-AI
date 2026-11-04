"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LiveStats } from "@/components/interview/LiveStats";
import { TelemetryWidget } from "@/components/interview/TelemetryWidget";
import { CameraSelfView } from "@/components/interview/CameraSelfView";

/**
 * The delivery-metrics strip under the stage. Focus mode collapses it, which is
 * why the whole row is gated here rather than tile by tile.
 */
/**
 * At phone width the three cards stacked to 254 of the split's 642 px and the
 * stage — where the mic and the composer live — collapsed to 2 px, so the strip
 * is hidden below md. A phone-first version of it is its own unit.
 */
export function TelemetryRow({
  isFocusMode,
  wpm,
  fillerWordsCount,
  showLiveInsights,
  isRecording,
  isAiSpeaking,
}: {
  isFocusMode: boolean;
  wpm: number;
  fillerWordsCount: number;
  showLiveInsights: boolean;
  isRecording: boolean;
  isAiSpeaking: boolean;
}) {
  return (
    <AnimatePresence>
      {!isFocusMode && (
        <motion.div
          initial={{ opacity: 0, y: 20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: 20, height: 0, transition: { duration: 0.2 } }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 shrink-0 max-md:hidden"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <LiveStats
              wpm={wpm}
              fillerWordsCount={fillerWordsCount}
              showAiEstimates={showLiveInsights}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <TelemetryWidget isRecording={isRecording} isAiSpeaking={isAiSpeaking} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <CameraSelfView />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
