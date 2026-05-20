import { useDraggable } from '@dnd-kit/core';
import { Package, Wrench, GripVertical, CalendarOff } from 'lucide-react';
import type { SourceCard } from '../types';

interface Props {
  card: SourceCard;
}

export default function DraggableCard({ card }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `source-${card.id}`,
    data: { card },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const isEquipment = card.type === 'equipment';
  const isDayOff = card.type === 'dayoff';

  const bgClass = isDayOff
    ? 'bg-rose-50 border-rose-200 hover:shadow-md hover:shadow-rose-100'
    : isEquipment
      ? 'bg-orange-50 border-orange-200 hover:shadow-md hover:shadow-orange-100'
      : 'bg-purple-50 border-purple-200 hover:shadow-md hover:shadow-purple-100';

  const iconBgClass = isDayOff
    ? 'bg-rose-100 text-rose-600'
    : isEquipment
      ? 'bg-orange-100 text-orange-600'
      : 'bg-purple-100 text-purple-600';

  const badgeBgClass = isDayOff
    ? 'bg-rose-100 text-rose-700'
    : isEquipment
      ? 'bg-orange-100 text-orange-700'
      : 'bg-purple-100 text-purple-700';

  const badgeLabel = isDayOff ? 'day off' : card.type;

  const Icon = isDayOff ? CalendarOff : isEquipment ? Package : Wrench;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-grab select-none transition-shadow
        ${bgClass}
        ${isDragging ? 'opacity-50 shadow-lg ring-2 ring-orange-400' : ''}
      `}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBgClass}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate text-gray-800">{card.title}</p>
        <p className="text-xs text-gray-500 truncate">{card.subtitle}</p>
      </div>
      <span
        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${badgeBgClass}`}
      >
        {badgeLabel}
      </span>
    </div>
  );
}
