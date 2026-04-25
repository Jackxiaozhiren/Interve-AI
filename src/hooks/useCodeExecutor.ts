"use client";

import { useState, useCallback, useRef } from "react";

export interface LogEntry {
  type: "log" | "error" | "warn" | "info" | "system";
  message: string;
  timestamp: number;
}

export function useCodeExecutor() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  const clearLogs = useCallback(() => setLogs([]), []);

  const executeCode = useCallback((code: string, language: string) => {
    if (language !== "javascript" && language !== "typescript") {
      setLogs((prev) => [
        ...prev,
        {
          type: "system",
          message: `Execution for ${language} is not supported in the browser yet. Please use JavaScript/TypeScript.`,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    if (workerRef.current) {
      workerRef.current.terminate();
    }

    setIsRunning(true);
    setLogs((prev) => [
      ...prev,
      { type: "system", message: "Starting execution...", timestamp: Date.now() },
    ]);

    // Create a blob containing our web worker code
    // We override console methods to post messages back
    const workerCode = `
      self.console = {
        log: (...args) => self.postMessage({ type: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }),
        error: (...args) => self.postMessage({ type: 'error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }),
        warn: (...args) => self.postMessage({ type: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }),
        info: (...args) => self.postMessage({ type: 'info', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') })
      };
      
      self.onmessage = function(e) {
        try {
          // Safe eval wrapper
          const result = new Function(e.data.code)();
          if (result !== undefined) {
             self.postMessage({ type: 'log', message: 'Return: ' + (typeof result === 'object' ? JSON.stringify(result) : String(result)) });
          }
          self.postMessage({ type: 'system', message: 'Execution finished successfully.' });
        } catch (err) {
          self.postMessage({ type: 'error', message: err.toString() });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    workerRef.current = worker;

    const timeout = setTimeout(() => {
      worker.terminate();
      setIsRunning(false);
      setLogs((prev) => [
        ...prev,
        {
          type: "error",
          message: "Execution timed out (3000ms limit reached). Potential infinite loop.",
          timestamp: Date.now(),
        },
      ]);
      URL.revokeObjectURL(workerUrl);
    }, 3000); // 3 seconds timeout

    worker.onmessage = (e) => {
      setLogs((prev) => [
        ...prev,
        { type: e.data.type, message: e.data.message, timestamp: Date.now() },
      ]);
      if (e.data.type === "system" && e.data.message === "Execution finished successfully.") {
        clearTimeout(timeout);
        setIsRunning(false);
        URL.revokeObjectURL(workerUrl);
      }
    };

    worker.onerror = (e) => {
      clearTimeout(timeout);
      setIsRunning(false);
      setLogs((prev) => [
        ...prev,
        { type: "error", message: `Worker error: ${e.message}`, timestamp: Date.now() },
      ]);
      URL.revokeObjectURL(workerUrl);
    };

    // Strip TypeScript types simply by assuming it's mostly JS for this sandbox
    // For a real TS sandbox we'd need Babel/SWC inside the browser.
    // For now we just execute the raw string.
    worker.postMessage({ code });
  }, []);

  const stopExecution = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setIsRunning(false);
      setLogs((prev) => [
        ...prev,
        { type: "system", message: "Execution manually terminated.", timestamp: Date.now() },
      ]);
    }
  }, []);

  return { logs, isRunning, executeCode, stopExecution, clearLogs };
}
