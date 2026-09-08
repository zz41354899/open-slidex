import {
  createContext,
  createElement,
  useContext,
  type ComponentType,
  type ReactNode
} from "react";

export type SlideXPrimitiveProps = Record<string, unknown> & {
  children?: ReactNode;
  id?: string;
};

export type SlideXPresentationDefinition = {
  component: ComponentType;
  title: string;
};

export type SlideXRuntimeSchema<TProps> = {
  safeParse(value: unknown): { success: boolean; data?: TProps; error?: unknown };
};

export type SlideXPropDefinition = {
  required?: boolean;
  type: "boolean" | "number" | "string";
};

export type SlideXComponentOptions<TProps extends object> = {
  assetReferences?: (props: TProps) => readonly string[];
  component: ComponentType<TProps>;
  name: string;
  props?: Partial<Record<keyof TProps, SlideXPropDefinition>>;
  propsSchema?: SlideXRuntimeSchema<TProps>;
  toMotionDoc?: (props: TProps) => ReactNode;
};

type RenderMode = "presentation" | "motiondoc";
const SlideXRenderModeContext = createContext<RenderMode>("presentation");

export function definePresentation(definition: SlideXPresentationDefinition) {
  if (!definition || typeof definition.title !== "string" || typeof definition.component !== "function") {
    throw new Error("definePresentation requires a title and React component.");
  }
  return Object.freeze({ ...definition });
}

export function defineSlideXComponent<TProps extends object>(options: SlideXComponentOptions<TProps>) {
  function RegisteredSlideXComponent(props: TProps) {
    const mode = useContext(SlideXRenderModeContext);
    const parsed = options.propsSchema?.safeParse(props);
    const literalPropsValid = options.props ? validateLiteralProps(props, options.props) : true;
    if ((parsed && !parsed.success) || !literalPropsValid) {
      return createElement("span", {
        "data-open-slidex-component-error": `${options.name} props failed validation.`
      });
    }
    const validatedProps = (parsed?.data ?? props) as TProps;
    if (mode === "motiondoc") {
      if (!options.toMotionDoc) {
        return createElement("span", {
          "data-open-slidex-component-error": `${options.name} must define toMotionDoc() before MDX or editable PPTX export.`
        });
      }
      return createElement(
        "div",
        {
          "data-open-slidex-assets": JSON.stringify(options.assetReferences?.(validatedProps) ?? []),
          "data-open-slidex-component": options.name
        },
        options.toMotionDoc(validatedProps)
      );
    }
    return createElement(options.component, validatedProps);
  }
  RegisteredSlideXComponent.displayName = options.name;
  return RegisteredSlideXComponent;
}

function validateLiteralProps<TProps extends object>(
  value: TProps,
  schema: Partial<Record<keyof TProps, SlideXPropDefinition>>
) {
  return Object.entries(schema as Record<string, SlideXPropDefinition | undefined>).every(([key, definition]) => {
    if (!definition) return true;
    const candidate = (value as Record<string, unknown>)[key];
    if (candidate === undefined) return !definition.required;
    return typeof candidate === definition.type;
  });
}

export function SlideXMotionDocRoot({ children }: { children: ReactNode }) {
  return createElement(SlideXRenderModeContext.Provider, { value: "motiondoc" }, children);
}

export function Deck({ children, title, ...props }: SlideXPrimitiveProps & { title: string }) {
  return marker("div", "deck", props, children, { "data-open-slidex-title": title });
}

export function Slide({ children, ...props }: SlideXPrimitiveProps) {
  return marker("section", "slide", props, children);
}

export function Text({ children, ...props }: SlideXPrimitiveProps) {
  return marker("span", "Text", props, children);
}

export function Image(props: SlideXPrimitiveProps) {
  return marker("span", "ImageBlock", props);
}

export function Video(props: SlideXPrimitiveProps) {
  return marker("span", "VideoBlock", props);
}

export function Shape(props: SlideXPrimitiveProps) {
  return marker("span", "Shape", props);
}

export function Chart(props: SlideXPrimitiveProps) {
  return marker("span", "Chart", props);
}

export function Table(props: SlideXPrimitiveProps) {
  return marker("span", "Table", props);
}

export function Svg(props: SlideXPrimitiveProps) {
  return marker("span", "SvgBlock", props);
}

export function HtmlEmbed(props: SlideXPrimitiveProps) {
  return marker("span", "HtmlEmbedBlock", props);
}

function marker(
  tag: "div" | "section" | "span",
  type: string,
  props: Record<string, unknown>,
  children?: ReactNode,
  attributes: Record<string, string> = {}
) {
  return createElement(tag, {
    ...attributes,
    "data-open-slidex-props": JSON.stringify(serializableProps(props)),
    "data-open-slidex-type": type
  }, children);
}

function serializableProps(props: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(props).filter(([, value]) => (
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"
  )));
}
