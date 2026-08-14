import { ChevronDown, ChevronRight } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

export type AccordionSectionProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
  title: string;
  rightElement?: ReactNode;
};

export function AccordionSection({ children, defaultOpen = true, icon = null, title, rightElement = null }: AccordionSectionProps) {
  const contentId = useId();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { tx } = usePitchI18n();

  return (
    <div className="flex flex-col border-b border-white/[0.04] last:border-b-0">
      <div className="flex min-h-12 w-full items-center justify-between py-3">
        <button
          aria-controls={contentId}
          aria-expanded={isOpen}
          type="button"
          className="flex items-center gap-1.5 text-left transition-colors cursor-pointer select-none group"
          onClick={() => setIsOpen((open) => !open)}
        >
          <div className="flex items-center justify-center text-neutral-500 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:text-neutral-300">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          {icon ? <span className="flex items-center justify-center text-neutral-500">{icon}</span> : null}
          <span className="text-[14px] font-medium text-neutral-300 group-hover:text-white transition-colors">
            {tx(title)}
          </span>
        </button>
        {rightElement && (
          <div className="flex items-center">
            {rightElement}
          </div>
        )}
      </div>

      <div
        aria-hidden={!isOpen}
        className={`grid transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        id={contentId}
        inert={!isOpen}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 pb-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
