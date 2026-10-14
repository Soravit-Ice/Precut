import designs from "./caption-original-designs.json";
import extra from "../../../vendor/hyperframes/fonts.json";
import type { CaptionAnimationId } from "./caption-animations";
export const originalDesigns = designs;
export const originalFontFaces = extra.faces;
export const originalFontNames = [
  ...new Set(["Inter", ...designs.flatMap((d) => d.fonts)]),
];
export const originalDesign = (id: CaptionAnimationId) =>
  designs.find((d) => d.id === id)!;
