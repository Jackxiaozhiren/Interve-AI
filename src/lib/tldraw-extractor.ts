import { TLShape, TLArrowShape, TLGeoShape, TLTextShape } from "tldraw";

export function extractSystemDesignText(shapes: TLShape[]): string {
  if (!shapes || shapes.length === 0) return "";

  const geos = shapes.filter((s): s is TLGeoShape => s.type === "geo");
  const arrows = shapes.filter((s): s is TLArrowShape => s.type === "arrow");
  const texts = shapes.filter((s): s is TLTextShape => s.type === "text");

  let description = "System Design Architecture Entities:\n";
  
  const shapeMap = new Map<string, string>();
  
  for (const s of geos) {
    const textContent = (s.props as { text?: string }).text ? (s.props as { text?: string }).text!.trim() : `Node_${s.id.split(':')[1]?.substring(0, 5) || 'Unknown'}`;
    shapeMap.set(s.id, textContent);
    description += `- ${textContent} [Shape: ${s.props.geo}]\n`;
  }
  for (const s of texts) {
    const textContent = (s.props as { text?: string }).text ? (s.props as { text?: string }).text!.trim() : "";
    if (textContent) {
      shapeMap.set(s.id, textContent);
      description += `- Text Label: "${textContent}"\n`;
    }
  }

  if (arrows.length > 0) {
    description += "\nConnections & Data Flow:\n";
    for (const arrow of arrows) {
      const startId = (arrow.props.start as { type?: string, boundShapeId?: string }).type === "binding" ? (arrow.props.start as { type?: string, boundShapeId?: string }).boundShapeId : null;
      const endId = (arrow.props.end as { type?: string, boundShapeId?: string }).type === "binding" ? (arrow.props.end as { type?: string, boundShapeId?: string }).boundShapeId : null;
      
      if (startId || endId) {
        const startName = startId ? (shapeMap.get(startId) || `Unknown_${startId.split(':')[1]?.substring(0, 5) || 'Start'}`) : "Unbound Start";
        const endName = endId ? (shapeMap.get(endId) || `Unknown_${endId.split(':')[1]?.substring(0, 5) || 'End'}`) : "Unbound End";
        const arrowText = (arrow.props as { text?: string }).text ? ` (Label: ${(arrow.props as { text?: string }).text})` : "";
        description += `- ${startName} -> ${endName}${arrowText}\n`;
      }
    }
  }

  return description;
}
