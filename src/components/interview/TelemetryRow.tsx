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
 *
 * W56: in `framework=star` the inline STAR strip (a `shrink-0` sibling, ~225 px)
 * already occupies the room's fixed-height left column. Keeping this row as a
 * second `shrink-0` sibling squeezed the only `flex-1` stage to 2 px and hid the
 * agent spheres. STAR mode collapses this row (same path as focus mode) so the
 * stage keeps a usable height; `collapsed` is explicit so general mode is
 * untouched and the decision is assertable from the call site.
 */
export function TelemetryRow({
  isFocusMode,
  collapsed = false,
  wpm,
  fillerWordsCount,
  showLiveInsights,
  isRecording,
  isAiSpeaking,
}: {
  isFocusMode: boolean;
  collapsed?: boolean;
  wpm: number;
  fillerWordsCount: number;
  showLiveInsights: boolean;
  isRecording: boolean;
  isAiSpeaking: boolean;
}) {
  return (
    <AnimatePresence>
      {!isFocusMode && !collapsed && (
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
