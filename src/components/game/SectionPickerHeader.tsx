import type { ReactNode, RefObject } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { SectionId } from '../../data/index.ts';
import { SECTION_META } from '../sectionMeta.ts';

interface SectionPickerHeaderProps {
  sectionId: SectionId;
  title: string;
  description: ReactNode;
  onBack: () => void;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}

/** Colorful title block at the top of each Section's picker screen. */
export function SectionPickerHeader({
  sectionId,
  title,
  description,
  onBack,
  headingRef,
}: SectionPickerHeaderProps) {
  const meta = SECTION_META[sectionId];
  const Icon = meta.icon;
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="btn btn-ghost btn-sm -ml-2">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Dashboard
      </button>
      <div className="flex items-start gap-4">
        <span
          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{ backgroundColor: meta.color }}
        >
          <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={2.5} />
        </span>
        <div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[1.75rem] font-black sm:text-[2.125rem]"
          >
            {title}
          </h1>
          <p className="mt-1 max-w-2xl text-[1rem] text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>
    </div>
  );
}
