export type ShapeMorphPoint = { x: number; y: number };

export type ShapeMorphDescriptor = {
  points?: number;
  shape: string;
  sides?: number;
};

const CUSTOM_VERTICES: Readonly<Record<string, readonly ShapeMorphPoint[]>> = {
  arrow: [{ x: 2, y: 22 }, { x: 58, y: 22 }, { x: 58, y: 2 }, { x: 98, y: 50 }, { x: 58, y: 98 }, { x: 58, y: 78 }, { x: 2, y: 78 }],
  chevron: [{ x: 1, y: 1 }, { x: 68, y: 1 }, { x: 99, y: 50 }, { x: 68, y: 99 }, { x: 1, y: 99 }, { x: 32, y: 50 }],
  corner: [{ x: 1, y: 1 }, { x: 72, y: 1 }, { x: 99, y: 28 }, { x: 99, y: 99 }, { x: 1, y: 99 }],
  diamond: [{ x: 50, y: 1 }, { x: 99, y: 50 }, { x: 50, y: 99 }, { x: 1, y: 50 }],
  hexagon: [{ x: 20, y: 1 }, { x: 80, y: 1 }, { x: 99, y: 50 }, { x: 80, y: 99 }, { x: 20, y: 99 }, { x: 1, y: 50 }],
  parallelogram: [{ x: 24, y: 1 }, { x: 99, y: 1 }, { x: 76, y: 99 }, { x: 1, y: 99 }],
  rectangle: [{ x: 1, y: 1 }, { x: 99, y: 1 }, { x: 99, y: 99 }, { x: 1, y: 99 }]
};

export function shapeMorphPoints(descriptor: ShapeMorphDescriptor, sampleCount = 48): ShapeMorphPoint[] | null {
  if (descriptor.shape === "line") return null;
  const count = Math.max(12, Math.min(Math.round(sampleCount), 96));
  if (descriptor.shape === "circle") {
    return Array.from({ length: count }, (_, index) => {
      const angle = -Math.PI / 2 + 2 * Math.PI * index / count;
      return { x: 50 + 48 * Math.cos(angle), y: 50 + 48 * Math.sin(angle) };
    });
  }
  const vertices = descriptor.shape === "star"
    ? radialVertices(Math.max(3, Math.min(Math.round(descriptor.points ?? 5), 12)), true)
    : descriptor.shape === "triangle"
      ? radialVertices(3, false)
      : descriptor.shape === "polygon"
        ? radialVertices(Math.max(3, Math.min(Math.round(descriptor.sides ?? 3), 12)), false)
        : CUSTOM_VERTICES[descriptor.shape] ?? CUSTOM_VERTICES.rectangle;
  return resampleClosedPolygon(vertices, count);
}

export function interpolateShapeMorphPath(
  from: readonly ShapeMorphPoint[],
  to: readonly ShapeMorphPoint[],
  progress: number,
  softness = 0.32
) {
  const count = Math.min(from.length, to.length);
  if (count < 3) return "";
  const t = clamp(progress, 0, 1);
  const intermediateSoftness = clamp(softness, 0, 1) * Math.sin(Math.PI * t) * 0.42;
  const points = Array.from({ length: count }, (_, index) => ({
    x: from[index]!.x + (to[index]!.x - from[index]!.x) * t,
    y: from[index]!.y + (to[index]!.y - from[index]!.y) * t
  }));
  const softened = intermediateSoftness <= 0
    ? points
    : points.map((point, index) => {
        const previous = points[(index - 1 + count) % count]!;
        const next = points[(index + 1) % count]!;
        return {
          x: point.x + ((previous.x + next.x) / 2 - point.x) * intermediateSoftness,
          y: point.y + ((previous.y + next.y) / 2 - point.y) * intermediateSoftness
        };
      });
  return `M${softened.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" L")} Z`;
}

function radialVertices(count: number, star: boolean) {
  const vertexCount = star ? count * 2 : count;
  return Array.from({ length: vertexCount }, (_, index) => {
    const angle = -Math.PI / 2 + 2 * Math.PI * index / vertexCount;
    const radius = star && index % 2 === 1 ? 48 * 0.42 : 48;
    return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
  });
}

function resampleClosedPolygon(vertices: readonly ShapeMorphPoint[], count: number) {
  const segments = vertices.map((point, index) => {
    const next = vertices[(index + 1) % vertices.length]!;
    return { from: point, length: Math.hypot(next.x - point.x, next.y - point.y), to: next };
  });
  const perimeter = segments.reduce((total, segment) => total + segment.length, 0);
  return Array.from({ length: count }, (_, index) => {
    let distance = perimeter * index / count;
    const segment = segments.find((candidate) => {
      if (distance <= candidate.length) return true;
      distance -= candidate.length;
      return false;
    }) ?? segments[segments.length - 1]!;
    const progress = segment.length === 0 ? 0 : distance / segment.length;
    return {
      x: segment.from.x + (segment.to.x - segment.from.x) * progress,
      y: segment.from.y + (segment.to.y - segment.from.y) * progress
    };
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
