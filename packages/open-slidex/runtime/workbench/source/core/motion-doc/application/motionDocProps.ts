import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

export function omitMotionDocProps(props: MotionDocProps, keys: readonly string[]) {
  const nextProps = { ...props };
  keys.forEach((key) => delete nextProps[key]);
  return nextProps;
}
