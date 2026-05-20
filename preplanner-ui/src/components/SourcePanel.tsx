import { Search, Plus, Filter, CalendarOff } from 'lucide-react';
import { usePlannerStore } from '../store';
import type { FilterMode } from '../types';
import DraggableCard from './DraggableCard';

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'custom', label: 'Custom Jobs' },
];

export default function SourcePanel() {
  const {
    filterMode,
    setFilterMode,
    searchQuery,
    setSearchQuery,
    getSourceCards,
    openCustomJobModal,
    openHolidayModal,
  } = usePlannerStore();

  const cards = getSourceCards();

  return (
    <section className="bg-white rounded-xl shadow-sm border border-orange-100 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
          Booked Equipment & Custom Tasks
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={openHolidayModal}
            className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <CalendarOff className="w-4 h-4" />
            Manage Holidays
          </button>
          <button
            onClick={openCustomJobModal}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Custom Job
          </button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search equipment or jobs…"
            className="w-full pl-9 pr-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div className="flex items-center border border-orange-200 rounded-lg overflow-hidden">
          <Filter className="w-4 h-4 text-gray-400 ml-2" />
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterMode(opt.value)}
              className={`px-3 py-2 text-xs font-medium transition-colors
                ${filterMode === opt.value
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable card list */}
      <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
        {/* Day Off draggable card — always visible */}
        <div className="shrink-0 w-72">
          <DraggableCard
            card={{
              id: '__dayoff__',
              type: 'dayoff',
              title: 'Day Off',
              subtitle: 'Drag onto timeline to block a day',
            }}
          />
        </div>

        {cards.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center w-full">No items match your filters.</p>
        )}
        {cards.map((card) => (
          <div key={card.id} className="shrink-0 w-72">
            <DraggableCard card={card} />
          </div>
        ))}
      </div>
    </section>
  );
}
