"use client";

import {
  Microphone, PlayCircle, SpeakerHigh, VideoCamera, WarningCircle, WifiHigh, WifiLow, WifiSlash,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { WaveformVisualizer } from "@/components/setup/WaveformVisualizer";
import type { HardwareCheckState } from "@/hooks/useHardwareCheck";

/**
 * Step 6 of the setup wizard: what the browser can see of the candidate's
 * microphone, camera, speakers and connection. Presentation only — every value
 * comes from useHardwareCheck, and none of it judges the candidate.
 */
export function HardwareCheckPanel({ hardware }: { hardware: HardwareCheckState }) {
  const { micStatus, camStatus, networkStatus, speakerTestPlaying, setSpeakerTestPlaying, analyser, errorMessage, videoRef } = hardware;

  return (
                <div className="bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-[32px] p-8 shadow-sm">
                  <div className="text-center mb-8">
                    <p className="text-slate-500">Let&apos;s make sure your microphone is working before we enter the interview room.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[300px]">
                    {/* Camera Preview */}
                    <div className="col-span-1 md:col-span-2 bg-slate-50/50 border border-slate-200/50 rounded-[24px] overflow-hidden flex flex-col items-center justify-center relative min-h-[240px]">
                      {camStatus === "testing" && (
                        <div className="flex flex-col items-center animate-pulse text-sky-500">
                          <VideoCamera className="w-12 h-12 mb-4" weight="duotone" />
                          <p className="text-sm font-medium">Requesting camera access...</p>
                        </div>
                      )}
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-500 ${camStatus === "success" ? "opacity-100" : "opacity-0"}`}
                      />
                      {camStatus === "success" && (
                        <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-white text-xs font-medium border border-white/10 shadow-lg">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          Camera Active
                        </div>
                      )}
                      {camStatus === "error" && (
                        <div className="flex flex-col items-center text-rose-500 z-10">
                          <WarningCircle className="w-12 h-12 mb-4" weight="duotone" />
                          <p className="text-sm font-medium text-center px-4 max-w-sm">{errorMessage}</p>
                        </div>
                      )}
                    </div>

                    {/* Microphone Check */}
                    <div className="bg-slate-50/50 border border-slate-200/50 rounded-[24px] p-6 flex flex-col items-center justify-center text-center">
                      <div className="relative mb-4">
                        {micStatus === "success" && <div className="absolute inset-0 bg-emerald-400/20 rounded-full animate-ping" />}
                        <div className={`relative p-3 rounded-full border ${micStatus === "success" ? "bg-emerald-100 border-emerald-200 text-emerald-600" : "bg-slate-100 border-slate-200 text-slate-400"}`}>
                          <Microphone className="w-8 h-8" weight={micStatus === "success" ? "fill" : "duotone"} />
                        </div>
                      </div>
                      <h3 className="font-semibold text-slate-800 mb-1">Microphone</h3>
                      {micStatus === "success" ? (
                        <>
                          <div className="w-full max-w-[160px] h-12 my-2 overflow-hidden flex items-center justify-center">
                            <WaveformVisualizer 
                              analyser={analyser} 
                              color="#10b981" 
                              className="opacity-80"
                            />
                          </div>
                          <p className="text-xs text-slate-500">Speak to test levels</p>
                        </>
                      ) : (
                         <p className="text-xs text-slate-500 mt-2">Waiting for access...</p>
                      )}
                    </div>

                    {/* Network & Speaker */}
                    <div className="space-y-6">
                      {/* Speaker Check */}
                      <div className="bg-slate-50/50 border border-slate-200/50 rounded-[24px] p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="bg-sky-100 p-3 rounded-full border border-sky-200 text-sky-600">
                            <SpeakerHigh className="w-6 h-6" weight="duotone" />
                          </div>
                          <div className="text-left">
                            <h3 className="font-semibold text-slate-800 text-sm">Speaker Test</h3>
                            <p className="text-xs text-slate-500">Play a test sound</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full shadow-sm"
                          onClick={() => {
                            setSpeakerTestPlaying(true);
                            const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
                            audio.play().catch(() => setSpeakerTestPlaying(false));
                            audio.onended = () => setSpeakerTestPlaying(false);
                          }}
                          disabled={speakerTestPlaying}
                        >
                          {speakerTestPlaying ? "Playing..." : <><PlayCircle className="w-4 h-4 mr-1" /> Play</>}
                        </Button>
                      </div>

                      {/* Network Status */}
                      <div className="bg-slate-50/50 border border-slate-200/50 rounded-[24px] p-5 flex items-center gap-4">
                        <div className={`p-3 rounded-full border ${
                          networkStatus === "good" ? "bg-emerald-100 border-emerald-200 text-emerald-600" :
                          networkStatus === "poor" ? "bg-amber-100 border-amber-200 text-amber-600" :
                          networkStatus === "offline" ? "bg-rose-100 border-rose-200 text-rose-600" :
                          "bg-slate-100 border-slate-200 text-slate-400"
                        }`}>
                          {networkStatus === "good" ? <WifiHigh className="w-6 h-6" weight="bold" /> :
                           networkStatus === "poor" ? <WifiLow className="w-6 h-6" weight="bold" /> :
                           <WifiSlash className="w-6 h-6" weight="bold" />}
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-slate-800 text-sm">Network Connection</h3>
                          <p className="text-xs text-slate-500 capitalize">{networkStatus} status</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
  );
}
