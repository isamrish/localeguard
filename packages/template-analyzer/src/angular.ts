/**
 * Angular component templates (external `.html` files).
 */

import type { Issue } from "@localeguard/core";

import { scanTemplate } from "./scanner";

export function scanAngularTemplate(
  source: string,
  fileName: string,
  translationComponents?: string[],
  startLine = 1,
): Issue[] {
  return scanTemplate(source, {
    mode: "angular",
    fileName,
    startLine,
    translationComponents,
  });
}
