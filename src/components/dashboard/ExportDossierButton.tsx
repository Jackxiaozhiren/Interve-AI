"use client";

import React, { useState, useRef } from "react";
import { DownloadSimple, Spinner } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PrintableDossier } from "./PrintableDossier";

import { type Interview } from "@/lib/db";

interface ExportDossierButtonProps {
  session: Interview;
  fileName?: string;
  className?: string;
}

export function ExportDossierButton({ session, fileName = "Interview_Dossier.pdf", className = "" }: ExportDossierButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!printRef.current) {
      toast.error("Export failed", { description: "Print view not ready." });
      return;
    }

    try {
      setIsExporting(true);
      toast("Generating Premium PDF...", { description: "This might take a few seconds." });

      const html2canvasModule = await import("html2canvas");
      const html2canvas = html2canvasModule.default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(printRef.current, {
        scale: 2, // Higher scale for better resolution
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Add first page
      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      // Add subsequent pages if content overflows
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(fileName);
      toast.success("Dossier exported successfully");
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Export failed", { description: "An error occurred while generating the PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-block">
        <Button
          onClick={handleExport}
          disabled={isExporting}
          aria-label={isExporting ? "Generating PDF dossier..." : "Export session dossier as PDF"}
          className={`relative overflow-hidden group bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 text-slate-700 border border-slate-200/60 shadow-sm rounded-full transition-all duration-300 ${className}`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-sky-50 to-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <span className="relative z-10 flex items-center gap-2 font-medium">
            {isExporting ? (
              <Spinner className="w-4 h-4 animate-spin text-sky-500" />
            ) : (
              <motion.div
                initial={{ y: 0 }}
                whileHover={{ y: 2 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <DownloadSimple className="w-4 h-4 text-slate-500 group-hover:text-sky-600 transition-colors" />
              </motion.div>
            )}
            {isExporting ? "Generating PDF..." : "Export Dossier"}
          </span>
        </Button>
      </motion.div>
      {/* Hidden container for PDF rendering */}
      <div className="fixed top-0 left-0 w-0 h-0 overflow-hidden pointer-events-none z-[-9999] opacity-0">
        <PrintableDossier ref={printRef} session={session} />
      </div>
    </>
  );
}
