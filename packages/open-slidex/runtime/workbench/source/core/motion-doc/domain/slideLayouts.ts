export const slideLayouts = [
  {
    id: "title",
    name: "Title, Body & Author",
    source: `<Text fontSize={60} fontWeight={800} x={8} y={25} w={84} h={15}>Presentation Title</Text>\n<Text fontSize={18} lineHeight={1.6} fontWeight={400} x={8} y={43} w={65} h={15}>Write a short paragraph to introduce the main topic or provide a brief overview of your presentation.</Text>\n<Text fontSize={13.5} fontWeight={600} x={8} y={82} w={40} h={10}>Author Name</Text>`
  },
  {
    id: "title-photo",
    name: "Title & Photo",
    source: `<Text fontSize={54} fontWeight={800} x={8} y={40} w={40} h={20}>Title</Text>\n<ImageBlock src="https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&q=85&w=2400" alt="Photo" x={50} y={10} w={42} h={80} fit="cover" radius={24} enter="fadeIn" />`
  },
  {
    id: "title-alt-photo",
    name: "Title & Alternate Photo",
    source: `<ImageBlock src="https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&q=85&w=2400" alt="Alternate Photo" x={8} y={10} w={42} h={80} fit="cover" radius={24} enter="fadeIn" />\n<Text fontSize={54} fontWeight={800} x={54} y={40} w={40} h={20}>Title</Text>`
  },
  {
    id: "title-bullets",
    name: "Title & Bullets",
    source: `<Text fontSize={40.5} fontWeight={700} x={8} y={10} w={84} h={15}>Title</Text>\n<Text listType="bullet" fontSize={18} lineHeight={1.8} x={8} y={30} w={84} h={60}>• First point\n• Second point\n• Third point</Text>`
  },
  {
    id: "bullets",
    name: "Bullets",
    source: `<Text listType="bullet" fontSize={21} lineHeight={1.8} x={10} y={20} w={80} h={60}>• First point\n• Second point\n• Third point</Text>`
  },
  {
    id: "title-bullets-photo",
    name: "Title, Bullets & Photo",
    source: `<Text fontSize={40.5} fontWeight={700} x={8} y={10} w={84} h={15}>Title</Text>\n<Text listType="bullet" fontSize={15} lineHeight={1.6} x={8} y={30} w={40} h={60}>• First point\n• Second point</Text>\n<ImageBlock src="https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&q=85&w=2400" alt="Photo" x={52} y={30} w={40} h={60} fit="cover" radius={24} enter="fadeIn" />`
  },
  {
    id: "title-bullets-small-video",
    name: "Title, Bullets & Small Live Video",
    source: `<Text fontSize={40.5} fontWeight={700} x={8} y={10} w={84} h={15}>Title</Text>\n<Text listType="bullet" fontSize={15} lineHeight={1.6} x={8} y={30} w={40} h={60}>• First point\n• Second point</Text>\n<VideoBlock src="https://www.w3schools.com/html/mov_bbb.mp4" controls="true" x={52} y={30} w={40} h={40} fit="cover" radius={24} enter="fadeIn" />`
  },
  {
    id: "title-bullets-large-video",
    name: "Title, Bullets & Large Live Video",
    source: `<Text fontSize={40.5} fontWeight={700} x={8} y={10} w={84} h={15}>Title</Text>\n<Text listType="bullet" fontSize={15} lineHeight={1.6} x={8} y={30} w={30} h={60}>• First point\n• Second point</Text>\n<VideoBlock src="https://www.w3schools.com/html/mov_bbb.mp4" controls="true" x={42} y={25} w={50} h={65} fit="cover" radius={24} enter="fadeIn" />`
  },
  {
    id: "chapter",
    name: "Chapter",
    source: `<Text fontSize={72} fontWeight={800} x={10} y={40} w={80} h={20} textAlign="center" textVerticalAlign="middle">Chapter</Text>`
  },
  {
    id: "only-title",
    name: "Only Title",
    source: `<Text fontSize={48} fontWeight={800} x={8} y={40} w={84} h={20}>Title</Text>`
  },
  {
    id: "agenda",
    name: "Agenda",
    source: `<Text fontSize={40.5} fontWeight={700} x={8} y={10} w={84} h={15}>Agenda</Text>\n<Text listType="bullet" fontSize={18} lineHeight={2} x={8} y={30} w={40} h={60}>• 09:00 - Keynote\n• 10:30 - Strategy\n• 13:00 - Workshop</Text>`
  },
  {
    id: "statement",
    name: "Statement",
    source: `<Text fontSize={36} fontWeight={700} lineHeight={1.4} x={15} y={35} w={70} h={30} textAlign="center">A clear, bold statement that captures attention and delivers the core message.</Text>`
  },
  {
    id: "key-fact",
    name: "Key Fact",
    source: `<Text fontSize={90} fontWeight={900} x={10} y={30} w={80} h={25} textAlign="center">100%</Text>\n<Text fontSize={18} fontWeight={500} x={10} y={60} w={80} h={10} textAlign="center">Key Fact</Text>`
  },
  {
    id: "quote",
    name: "Quote",
    source: `<Text fontSize={45} fontWeight={600} lineHeight={1.3} x={15} y={30} w={70} h={30}>"A profound quote goes here."</Text>\n<Text fontSize={15} fontWeight={400} x={15} y={65} w={70} h={10}>— Author</Text>`
  },
  {
    id: "photos-3",
    name: "Photos - 3 on a page",
    source: `<ImageBlock src="https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&q=85&w=2400" alt="Photo 1" x={8} y={10} w={40} h={80} fit="cover" radius={24} enter="fadeIn" />\n<ImageBlock src="https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&q=85&w=2400" alt="Photo 2" x={52} y={10} w={40} h={38} fit="cover" radius={24} enter="fadeIn" delay={0.1} />\n<ImageBlock src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=85&w=2400" alt="Photo 3" x={52} y={52} w={40} h={38} fit="cover" radius={24} enter="fadeIn" delay={0.2} />`
  },
  {
    id: "photo",
    name: "Photo",
    source: `<ImageBlock src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=85&w=2400" alt="Full Photo" x={0} y={0} w={100} h={100} fit="cover" radius={0} enter="fadeIn" />`
  },
  {
    id: "blank",
    name: "Blank",
    source: ``
  }
] as const;

export type SlideLayout = (typeof slideLayouts)[number];
export type SlideLayoutId = SlideLayout["id"];

const slideLayoutIdSet = new Set<string>(slideLayouts.map(({ id }) => id));

export function isSlideLayoutId(value: string): value is SlideLayoutId {
  return slideLayoutIdSet.has(value);
}

export function getSlideLayout(layoutId: SlideLayoutId) {
  return slideLayouts.find(({ id }) => id === layoutId)!;
}
