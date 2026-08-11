export {
  applySlideXBatch,
  applySlideXBatch as applyOpenSlideXBatch,
  blankPresentationMdx,
  createBlankSlideSource,
  getSlideXCatalog,
  getSlideXCatalog as getOpenSlideXCatalog,
  inspectSlideXDocument,
  inspectSlideXDocument as inspectOpenSlideXDocument,
  listSlideXAssetReferences,
  type SlideXAssetReference,
  type SlideXAssetReference as OpenSlideXAssetReference,
  type SlideXBatchResult,
  type SlideXBlockSelector,
  type SlideXDocument,
  type SlideXDocument as OpenSlideXDocument,
  type SlideXDocumentAdapter,
  type SlideXDocumentAdapter as OpenSlideXDocumentAdapter,
  type SlideXEditCommand,
  type SlideXEditCommand as OpenSlideXEditCommand,
  type SlideXRevision,
  type SlideXRevision as OpenSlideXRevision
} from "@/core/motion-doc/application/localSdk";
export {
  ensureMotionDocSourceBlockIds,
  generateBlockString,
  generateSlideString
} from "@/core/motion-doc/application/motionDocSerialize";
export {
  motionDocSlideSourceRanges,
  type MotionDocSlideSourceRange
} from "@/core/motion-doc/application/motionDocSourceEditor";
export {
  getMotionDocCanvasNodes,
  updateMotionDocCanvasNodeFrame
} from "@/core/motion-doc/application/motionDocCanvas";
export { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
export { materializeFreeformSource } from "@/core/motion-doc/application/motionDocFreeform";
export {
  isOpenSlideXLocalAssetSource,
  stripNonLocalMotionDocMedia,
  validateOpenSlideXLocalMedia,
  type LocalMotionDocMediaIssue
} from "@/core/motion-doc/application/localMediaPolicy";
export {
  summarizeMotionDoc,
  motionDocAddBlockTypes,
  type MotionDocSupportedAddBlockType
} from "@/core/motion-doc/application/motionDocAutomation";
export { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
export {
  parseTemplatePackageV1,
  parseTemplateRef,
  templateBlueprintV1Schema,
  templatePackageLocales,
  templatePackageV1Schema,
  templateRefSchema,
  type TemplateBlueprintV1,
  type TemplatePackageLocale,
  type TemplatePackageV1,
  type TemplateRef
} from "@/core/motion-doc/domain/templatePackageV1";
export {
  getOfficialTemplatePackage,
  getOfficialTemplateRef,
  officialTemplatePackages
} from "@/core/motion-doc/presets/officialTemplatePackages";
export {
  getOfficialTemplateQualityProfile
} from "@/core/motion-doc/presets/officialTemplateQualityProfiles";
export {
  parseTemplateQualityProfileV1,
  templateQualityProfileV1Schema,
  type TemplateQualityProfileV1
} from "@/core/motion-doc/domain/templateQualityProfileV1";
export {
  validateTemplatePackageV1,
  type TemplatePackageValidationIssue
} from "@/core/motion-doc/application/templatePackageValidation";
export {
  defaultMotionDocChartData,
  isMotionDocChartMotion,
  isMotionDocChartType,
  motionDocChartModel,
  motionDocChartMotions,
  motionDocChartPaletteNames,
  motionDocChartTypes,
  parseMotionDocChartData,
  type MotionDocChartDatum,
  type MotionDocChartModel,
  type MotionDocChartMotion,
  type MotionDocChartType
} from "@/core/motion-doc/domain/chart";
export {
  isMotionDocEnterAnimation,
  isMotionDocSlideTransition,
  motionDocEnterAnimations,
  motionDocSlideTransitions,
  normalizeMotionDocEnterAnimation,
  normalizeMotionDocSlideTransition,
  type MotionDocEnterAnimation,
  type MotionDocSlideTransition
} from "@/core/motion-doc/domain/motionVocabulary";
export type {
  MotionDocBlock,
  MotionDocProps,
  MotionDocScene,
  MotionDocSpeakerNotes,
  ParsedMotionDoc
} from "@/core/motion-doc/domain/motionDocTypes";
export {
  buildMotionDocHtml,
  buildMotionDocPreviewHtml,
  buildMotionDocPngSvg,
  buildMotionDocRasterHtml,
  type MotionDocPreviewHtmlOptions
} from "@/core/motion-doc/infrastructure/export/motionDocExport";
