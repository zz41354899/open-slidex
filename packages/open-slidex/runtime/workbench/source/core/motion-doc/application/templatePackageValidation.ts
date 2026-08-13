import { summarizeMotionDoc } from "@/core/motion-doc/application/motionDocAutomation";
import {
  parseTemplatePackageV1,
  templatePackageLocales,
  type TemplatePackageV1
} from "@/core/motion-doc/domain/templatePackageV1";

export type TemplatePackageValidationIssue = {
  code: "duplicate_asset" | "invalid_package" | "invalid_source" | "invalid_starter";
  message: string;
  path?: string;
};

export function validateTemplatePackageV1(value: unknown): {
  issues: TemplatePackageValidationIssue[];
  package?: TemplatePackageV1;
  valid: boolean;
} {
  let parsed: TemplatePackageV1;
  try {
    parsed = parseTemplatePackageV1(value);
  } catch (error) {
    return {
      issues: [{
        code: "invalid_package",
        message: error instanceof Error ? error.message : "Template package validation failed."
      }],
      valid: false
    };
  }

  const issues: TemplatePackageValidationIssue[] = [];
  const assetPaths = new Set<string>();
  for (const asset of parsed.assets) {
    if (assetPaths.has(asset.path)) {
      issues.push({ code: "duplicate_asset", message: `Duplicate template asset: ${asset.path}`, path: asset.path });
    }
    assetPaths.add(asset.path);
  }

  for (const locale of templatePackageLocales) {
    const sourceValidation = summarizeMotionDoc(parsed.sources[locale]).validation;
    if (!sourceValidation.isValid) {
      issues.push({
        code: "invalid_source",
        message: `${parsed.id} ${locale} source has ${sourceValidation.issues.length} validation issue(s).`,
        path: `sources.${locale}`
      });
    }
    const starterValidation = summarizeMotionDoc(parsed.starterSources[locale]).validation;
    if (!starterValidation.isValid) {
      issues.push({
        code: "invalid_starter",
        message: `${parsed.id} ${locale} starter has ${starterValidation.issues.length} validation issue(s).`,
        path: `starterSources.${locale}`
      });
    }
  }

  return { issues, package: parsed, valid: issues.length === 0 };
}
