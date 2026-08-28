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
  isOpenSlideXCompatibleMediaSource,
  isOpenSlideXLocalAssetSource,
  isOpenSlideXLocalHtmlAssetSource,
  isOpenSlideXLocalSvgAssetSource,
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
  formatMotionDocChartValue,
  isMotionDocChartMotion,
  isMotionDocChartType,
  motionDocChartModel,
  motionDocChartBarGaps,
  motionDocChartColorModes,
  motionDocChartLabelModes,
  motionDocChartMotions,
  motionDocChartNumberFormats,
  motionDocChartPaletteNames,
  motionDocChartPresetNames,
  motionDocChartPresetProps,
  motionDocChartSortModes,
  motionDocChartTypes,
  parseMotionDocChartData,
  sortMotionDocChartData,
  type MotionDocChartDatum,
  type MotionDocChartBarGap,
  type MotionDocChartColorMode,
  type MotionDocChartLabelMode,
  type MotionDocChartModel,
  type MotionDocChartMotion,
  type MotionDocChartNumberFormat,
  type MotionDocChartPreset,
  type MotionDocChartSortMode,
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
export {
  INTERACTION_PROP,
  interactionFromProps,
  isSafeInteractionUrl,
  parseInteraction,
  withInteraction,
  type InteractionActionV1,
  type InteractionV1
} from "@/core/motion-doc/domain/interaction";
export {
  interpolateShapeMorphPath,
  shapeMorphPoints,
  type ShapeMorphDescriptor,
  type ShapeMorphPoint
} from "@/core/motion-doc/domain/shapeMorph";
export {
  autoLinkSharedMorphSequenceScenes,
  autoLinkSharedMorphScenes,
  defaultSharedMorphCurve,
  hasSharedMorphReturnLink,
  normalizeSharedMorphEasing,
  sharedMorphCssEasing,
  sharedMorphCurveFromProps,
  sharedMorphEasings,
  sharedMorphEffectProps,
  sharedMorphPairCount,
  unlinkSharedMorphGroupScenes,
  setSharedMorphReturnLinkScenes,
  type SharedMorphCurve,
  type SharedMorphEasing
} from "@/core/motion-doc/domain/sharedMorph";
export {
  MOTION_SEQUENCE_PROP,
  applyTweenState,
  createMotionActionId,
  formatMotionNumber,
  interpolateMotionNumber,
  interpolateMotionState,
  migrateLegacyEnterMotion,
  motionActionStarts,
  motionEasings,
  motionSequenceFromProps,
  motionTriggerCount,
  parseMotionSequence,
  scheduleMotionActions,
  serializeMotionSequence,
  tweenStateFromProps,
  withMotionSequence,
  type MotionAction,
  type MotionActionStart,
  type MotionEasing,
  type MotionEnterAction,
  type MotionNumberRange,
  type MotionPath,
  type MotionSequenceV1,
  type MotionTweenAction,
  type MotionTweenPreset,
  type MotionTweenState,
  type ScheduledMotionAction
} from "@/core/motion-doc/domain/motionSequence";
export type {
  MotionDocBlock,
  MotionDocProps,
  MotionDocScene,
  ParsedMotionDoc
} from "@/core/motion-doc/domain/motionDocTypes";
export {
  buildMotionDocHtml,
  buildMotionDocPreviewHtml,
  buildMotionDocPngSvg,
  buildMotionDocRasterHtml,
  type MotionDocPreviewHtmlOptions
} from "@/core/motion-doc/infrastructure/export/motionDocExport";
