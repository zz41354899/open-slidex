export type MotionDocPropValue = string | number;
export type MotionDocPropInput = Readonly<Record<string, MotionDocPropValue | undefined>>;
export type MotionDocPropPatch = Record<string, MotionDocPropValue | undefined>;

/**
 * Raw MotionDoc attributes as they cross the parser and serializer boundary.
 * UI and application code should prefer a narrowed block or prop view.
 */
export type MotionDocProps = Record<string, MotionDocPropValue>;

export type MotionDocBlockMap = {
  heading: {
    props: MotionDocProps;
    type: "heading";
    text: string;
  };
  Title: {
    type: "Title";
    props: MotionDocProps;
    text: string;
  };
  Text: {
    type: "Text";
    props: MotionDocProps;
    text: string;
  };
  Card: MotionDocPropsBlock<"Card">;
  Chart: MotionDocPropsBlock<"Chart">;
  Icon: MotionDocPropsBlock<"Icon">;
  ImageBlock: MotionDocPropsBlock<"ImageBlock">;
  Metric: MotionDocPropsBlock<"Metric">;
  Shape: MotionDocPropsBlock<"Shape">;
  Stack: MotionDocPropsBlock<"Stack">;
  Table: MotionDocPropsBlock<"Table">;
  VideoBlock: MotionDocPropsBlock<"VideoBlock">;
};

type MotionDocPropsBlock<TType extends string> = {
  type: TType;
  props: MotionDocProps;
};

export type MotionDocBlockType = keyof MotionDocBlockMap;
export type MotionDocBlockOf<TType extends MotionDocBlockType> = MotionDocBlockMap[TType];
export type MotionDocBlock = MotionDocBlockMap[MotionDocBlockType];
export type MotionDocTextBlock = MotionDocBlockOf<"Title" | "Text" | "heading">;
export type MotionDocTableBlock = MotionDocBlockOf<"Table">;
export type MotionDocVisualBlock = MotionDocBlockOf<"Chart" | "Icon" | "ImageBlock" | "Shape" | "VideoBlock">;
export type MotionDocBlockWithProps = MotionDocBlock;

export type MotionDocSpeakerNotes = {
  markdown: string;
  plainText: string;
};

export type MotionDocScene = {
  duration: number;
  props: MotionDocProps;
  blocks: MotionDocBlock[];
  notes?: MotionDocSpeakerNotes;
};

export type ParsedMotionDoc = {
  title: string;
  scenes: MotionDocScene[];
};
