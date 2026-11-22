"use client";

import type { RefObject } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { UIMessage } from "ai";
import { PauseOverlay, ThinkTimeOverlay, EndingOverlay } from "@/components/interview/RoomOverlays";
import { RoomHeader } from "@/components/interview/RoomHeader";
import { FlowMap } from "@/components/interview/FlowMap";
import { RoomStage } from "@/components/interview/RoomStage";
import { TelemetryRow } from "@/components/interview/TelemetryRow";
import { TranscriptPanel } from "@/components/interview/TranscriptPanel";
import { TechnicalScratchpad } from "@/components/interview/TechnicalScratchpad";
import { SystemDesignBoard } from "@/components/interview/SystemDesignBoard";
import { CopilotHints } from "@/components/interview/CopilotHints";
import { StandbyOverlay } from "@/components/interview/StandbyOverlay";
import { UnsavedSessionBanner } from "@/components/interview/UnsavedSessionBanner";
import { SendFailureBanner } from "@/components/interview/SendFailureBanner";
import { TextSelectionMenu } from "@/components/interview/TextSelectionMenu";
import { StarTracker } from "@/components/interview/StarTracker";
import type { useRoomWorkState } from "./useRoomWorkState";
import type { useRoomPanels } from "./useRoomPanels";
import type { useModelRuntime } from "./useModelRuntime";
import type { SettlementNotice } from "@/lib/interview/settlement-plan";
import type { SendFailureNotice } from "@/hooks/useSendFailureRecovery";

/**
 * S4 slice 10: the room's view tree. The JSX moved verbatim out of page.tsx —
 * same elements, same props, same order — so the page keeps orchestration and
 * this file keeps layout. Values arrive in one view-model object rather than
 * sixty positional props: the room's contract is large, and one object keeps
 * "what the view needs" greppable in a single place.
 */

type Settlement = {
  isEnding: boolean;
  handleEndCall: () => void;
  saveFailure: { notice: SettlementNotice } | null;
  isRetrying: boolean;
  retrySave: () => void;
  leaveWithoutSaving: () => void;
};

type SendFailure = {
  visible: boolean;
  retrying: boolean;
  retry: () => void;
  dismiss: () => void;
  notice: SendFailureNotice;
};

export type RoomViewModel = ReturnType<typeof useRoomWorkState> &
  ReturnType<typeof useRoomPanels> &
  ReturnType<typeof useModelRuntime> & {
    thinkCountdown: number | null;
    setThinkCountdown: (n: number | null) => void;
    isCalmMode: boolean;
    stressTest: boolean;
    isRecording: boolean;
    recordingStartTime: number | null;
    togglePaused: () => void;
    isThinkTimeEnabled: boolean;
    setIsThinkTimeEnabled: (b: boolean) => void;
    toggleFocusMode: () => void;
    messages: UIMessage[];
    isPageVisible: boolean;
    isLoading: boolean;
    isAiSpeaking: boolean;
    latestAiMessage: string;
    activeUserTranscript: string;
    loopMeta: string | null;
    wpm: number;
    activeStream: MediaStream | null;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    handleStartSpeaking: () => void;
    requestHint: () => Promise<void>;
    handleTextSubmit: () => void;
    inputRef: RefObject<HTMLInputElement | null>;
    fillerWordsCount: number;
    showLiveInsights: boolean;
    status: string;
    latencyPhase: number;
    isDyslexiaMode: boolean;
    messagesEndRef: RefObject<HTMLDivElement | null>;
    regenerate: () => void;
    setMessages: (m: UIMessage[]) => void;
    modelLoadError: boolean;
    startFromStandby: () => void;
    router: AppRouterInstance;
    isStandby: boolean;
    settlement: Settlement;
    sendFailure: SendFailure;
    framework: string;
  };

export function RoomView({ vm }: { vm: RoomViewModel }) {
  const {
    isPaused, thinkCountdown, setThinkCountdown, isCalmMode, stressTest, isRecording,
    recordingStartTime, togglePaused, isThinkTimeEnabled, setIsThinkTimeEnabled,
    isFocusMode, toggleFocusMode, messages, isPageVisible, isLoading, isAiSpeaking,
    modelsReady, isRequestingHint, latestAiMessage, modelStatus, activeUserTranscript,
    inputText, loopMeta, wpm, activeExpert, activeStream, setInputText,
    setIsScratchpadOpen, setIsSystemDesignOpen, startRecording, stopRecording,
    handleStartSpeaking, requestHint, handleTextSubmit, inputRef, fillerWordsCount,
    showLiveInsights, status, latencyPhase, isDyslexiaMode, messagesEndRef, regenerate,
    setMessages, isScratchpadOpen, problemStatement, isSystemDesignOpen,
    modelLoadError, startFromStandby, router, framework, isStandby,
  } = vm;
  const isEnding = vm.settlement.isEnding;
  const saveFailure = vm.settlement.saveFailure;
  const retrySave = vm.settlement.retrySave;
  const leaveWithoutSaving = vm.settlement.leaveWithoutSaving;
  const isRetrying = vm.settlement.isRetrying;
  const handleEndCall = vm.settlement.handleEndCall;
  const sendFailure = vm.sendFailure;

  return (
        <div className="flex flex-col h-screen bg-transparent text-foreground font-sans selection:bg-primary/10 p-4 gap-4">
          <PauseOverlay isPaused={isPaused} />

          <ThinkTimeOverlay
            seconds={thinkCountdown}
            isCalmMode={isCalmMode}
            onCancel={() => setThinkCountdown(null)}
            onStart={() => setThinkCountdown(0)}
          />
      
          {/* Top Header */}
          <RoomHeader
            stressTest={stressTest}
            isRecording={isRecording}
            recordingStartTime={recordingStartTime}
            isPaused={isPaused}
            onTogglePaused={togglePaused}
            isThinkTimeEnabled={isThinkTimeEnabled}
            onToggleThinkTime={() => setIsThinkTimeEnabled(!isThinkTimeEnabled)}
            isFocusMode={isFocusMode}
            onToggleFocusMode={toggleFocusMode}
          />

          {/* The stage progress read-out is a desktop affordance: on a phone it costs
              106px of a 844px screen and pushed the room's own panels below the fold. */}
          <div className="px-2 shrink-0 max-md:hidden">
            <FlowMap messageCount={messages.length} />
          </div>

          {/* Main Split Layout */}
          <div className="flex flex-col lg:grid lg:grid-cols-12 flex-1 overflow-hidden gap-4 px-2 pb-2">
        
            {/* Left: 70% (Bento Stack) */}
            {/* On a phone the two columns stack, and without a floor neither gets a
                usable height: the transcript's content won and this column collapsed
                to 18px, which in turn let the dock (absolute bottom-8) float up over
                the FlowMap row. Sharing the split instead of letting either column
                win keeps both panels real and the dock inside its stage. */}
            <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-4 overflow-hidden max-lg:flex-1 max-lg:min-h-0">
               {/* W53: normal-flow strip above the stage, never an absolute layer in it. */}
               {!isFocusMode && framework === 'star' && <div className="shrink-0"><StarTracker variant="inline" /></div>}
               {/* Top: AI Avatar (Main Bento Card) */}
                          <RoomStage
                 framework={framework}
                 stressTest={stressTest}
                 isFocusMode={isFocusMode}
                 isPageVisible={isPageVisible}
                 isLoading={isLoading}
                 isRecording={isRecording}
                 isAiSpeaking={isAiSpeaking}
                 modelsReady={modelsReady}
                 isRequestingHint={isRequestingHint}
                 latestAiMessage={latestAiMessage}
                 modelStatus={modelStatus}
                 activeUserTranscript={activeUserTranscript}
                 inputText={inputText}
                 loopMeta={loopMeta}
                 wpm={wpm}
                 activeExpert={activeExpert}
                 activeStream={activeStream}
                 setInputText={setInputText}
                 setIsScratchpadOpen={setIsScratchpadOpen}
                 setIsSystemDesignOpen={setIsSystemDesignOpen}
                 startRecording={startRecording}
                 stopRecording={stopRecording}
                 handleStartSpeaking={handleStartSpeaking}
                 requestHint={requestHint}
                 handleTextSubmit={handleTextSubmit}
                 inputRef={inputRef}
               />

                <TelemetryRow
                  isFocusMode={isFocusMode} collapsed={framework === 'star'}
                  wpm={wpm}
                  fillerWordsCount={fillerWordsCount}
                  showLiveInsights={showLiveInsights}
                  isRecording={isRecording}
                  isAiSpeaking={isAiSpeaking}
                />
            </div>

            <TranscriptPanel
              messages={messages}
              isLoading={isLoading}
              status={status}
              latencyPhase={latencyPhase}
              isDyslexiaMode={isDyslexiaMode}
              isFocusMode={isFocusMode}
              latestAiMessage={latestAiMessage}
              endRef={messagesEndRef}
              onRegenerate={regenerate}
              onDeleteMessage={(id) => setMessages(messages.filter((msg) => msg.id !== id))}
              onEndCall={handleEndCall}
              isEnding={isEnding}
            />
          </div>

          <TechnicalScratchpad 
            isOpen={isScratchpadOpen} 
            onClose={() => setIsScratchpadOpen(false)} 
            problemStatement={problemStatement}
          />

          <SystemDesignBoard 
            isOpen={isSystemDesignOpen} 
            onClose={() => setIsSystemDesignOpen(false)} 
          />

          {/* Dynamic Copilot Coaching Hints */}
          {!isFocusMode && (
            <CopilotHints 
              wpm={wpm} 
              isRecording={isRecording} 
            />
          )}

          {/* Standby / Click to Start Overlay */}
          <StandbyOverlay
            open={isStandby}
            modelsReady={modelsReady}
            loadError={modelLoadError}
            onStart={startFromStandby}
            onExit={() => router.push("/dashboard")}
          />

          <EndingOverlay isEnding={isEnding} />
          {saveFailure && (
            <UnsavedSessionBanner
              notice={saveFailure.notice}
              retrying={isRetrying}
              onRetry={retrySave}
              onLeave={leaveWithoutSaving}
            />
          )}
          {sendFailure.visible && (
            <SendFailureBanner
              retrying={sendFailure.retrying}
              onRetry={sendFailure.retry}
              onDismiss={sendFailure.dismiss}
              notice={sendFailure.notice}
            />
          )}
          <TextSelectionMenu />
        </div>
  );
}
