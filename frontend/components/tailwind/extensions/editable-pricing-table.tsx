"use client";

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { ROLES } from '@/lib/rateCard';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PricingRow {
  id: string;
  role: string;
  description: string;
  hours: number;
  rate: number;
}

// Memoized sortable row component for optimal performance
const DND_ENABLED = false; // quick kill-switch for demo stability (disabled per user feedback)

const SortableRow = memo(({ 
  row, 
  index, 
  showTotal, 
  visibleRowsLength,
  onUpdateRow, 
  onRemoveRow 
}: { 
  row: PricingRow;
  index: number;
  showTotal: boolean;
  visibleRowsLength: number;
  onUpdateRow: (id: string, field: keyof PricingRow, value: string | number) => void;
  onRemoveRow: (id: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, disabled: !DND_ENABLED });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleRoleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateRow(row.id, 'role', e.target.value);
  }, [row.id, onUpdateRow]);

  const handleHoursChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateRow(row.id, 'hours', parseFloat(e.target.value) || 0);
  }, [row.id, onUpdateRow]);

  const handleRemove = useCallback(() => {
    onRemoveRow(row.id);
  }, [row.id, onRemoveRow]);

  const rowTotal = useMemo(() => row.hours * row.rate, [row.hours, row.rate]);

  return (
    <tr 
      ref={setNodeRef}
      style={style}
      className="pricing-row group hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-150"
    >
      <td className="border border-gray-300 dark:border-gray-600 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            {...(DND_ENABLED ? attributes : {})}
            {...(DND_ENABLED ? listeners : {})}
            disabled={!DND_ENABLED}
            className={`drag-handle text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ${DND_ENABLED ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed'} select-none text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
            title={DND_ENABLED ? "Drag to reorder" : "Drag disabled for demo stability"}
            aria-label="Drag to reorder row"
          >
            ⋮⋮
          </button>
          <select
            value={row.role}
            onChange={handleRoleChange}
            className="flex-1 px-3 py-2 text-sm !text-foreground dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select role...</option>
            {ROLES.map((role) => (
              <option key={role.name} value={role.name}>
                {role.name} - AUD {role.rate}/hr
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className="border border-gray-300 dark:border-gray-600 px-4 py-3">
        <input
          type="number"
          value={row.hours || ''}
          onChange={handleHoursChange}
          placeholder="0"
          min="0"
          step="0.5"
          className="w-full px-3 py-2 text-sm text-right !text-foreground dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
        />
      </td>
      {showTotal && (
        <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-right text-sm font-semibold tabular-nums">
          AUD {rowTotal.toFixed(2)} +GST
        </td>
      )}
      <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center">
        <button
          type="button"
          onClick={handleRemove}
          disabled={visibleRowsLength === 1}
          className="text-red-600 hover:text-red-800 dark:hover:text-red-400 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors text-lg font-bold"
          aria-label="Remove row"
        >
          ✕
        </button>
      </td>
    </tr>
  );
});

SortableRow.displayName = 'SortableRow';

// Ghost overlay component for smooth drag preview
const DragOverlayRow = ({ row, showTotal }: { row: PricingRow; showTotal: boolean }) => {
  const rowTotal = row.hours * row.rate;
  
  return (
    <table className="w-full border-collapse shadow-2xl">
      <tbody>
        <tr className="bg-blue-100 dark:bg-blue-900 opacity-90">
          <td className="border border-blue-300 dark:border-blue-700 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-xl">⋮⋮</span>
              <div className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md">
                {row.role || 'Select role...'}
              </div>
            </div>
          </td>
          <td className="border border-blue-300 dark:border-blue-700 px-4 py-3 text-right tabular-nums">
            {row.hours || 0}
          </td>
          {showTotal && (
            <td className="border border-blue-300 dark:border-blue-700 px-4 py-3 text-right text-sm font-semibold tabular-nums">
              AUD {rowTotal.toFixed(2)} +GST
            </td>
          )}
          <td className="border border-blue-300 dark:border-blue-700 px-4 py-3 text-center">
            <span className="text-red-600 text-lg">✕</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

const EditablePricingTableComponent = ({ node, updateAttributes }: any) => {
  const [rows, setRows] = useState<PricingRow[]>(node.attrs.rows || []);
  const [discount, setDiscount] = useState(node.attrs.discount || 0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showTotal, setShowTotal] = useState(node.attrs.showTotal !== undefined ? node.attrs.showTotal : true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ⚠️ CRITICAL FIX: Initialize and normalize rows ONCE on mount
  useEffect(() => {
    if (isInitialized || !node.attrs.rows) return;
    // Robust normalizer: lowercase, trim, collapse whitespace, normalize hyphen spacing
    const normalize = (s: string) => (s || '')
      .toLowerCase()
      .replace(/\s*-/g, '-')
      .replace(/-\s*/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
    const initialRows = node.attrs.rows || [];

    // 1) Dedupe by role: combine hours, prefer known rate from ROLES, keep first description
    // CRITICAL: Filter out completely empty roles BEFORE processing
    const roleMap = new Map<string, PricingRow>();
    for (const r of initialRows) {
      const key = normalize(r.role);
      // Skip rows with empty, whitespace-only, or placeholder roles
      // Check for: empty string, "Select role...", "Select role", or any whitespace
      if (!key || key.length === 0 || key === 'select role...' || key === 'select role' || !r.role || r.role.trim() === '') continue;
      
      const existing = roleMap.get(key);
      if (!existing) {
        // Prefer canonical rate from ROLES if available
        const canon = ROLES.find(x => normalize(x.name) === key);
        roleMap.set(key, {
          id: r.id || `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          // Snap to canonical role name if found to ensure <select> matches an option value
          role: canon?.name || r.role,
          description: r.description || '',
          hours: Number(r.hours) || 0,
          rate: typeof r.rate === 'number' && r.rate > 0 ? r.rate : (canon?.rate || 0),
        });
      } else {
        // Merge hours; keep first description; prefer non-zero rate or canonical
        const canon = ROLES.find(x => normalize(x.name) === key);
        const mergedHours = (Number(existing.hours) || 0) + (Number(r.hours) || 0);
        const mergedRate = existing.rate > 0 ? existing.rate : (r.rate > 0 ? r.rate : (canon?.rate || 0));
        roleMap.set(key, {
          id: existing.id,
          role: canon?.name || existing.role,
          description: existing.description || r.description || '',
          hours: mergedHours,
          rate: mergedRate,
        });
      }
    }

    let deduped = Array.from(roleMap.values());

    // 2) Do not auto-insert mandatory roles here; pricing calculator provides governance rows deterministically

    // 3) Ensure Account Management is at the bottom
    const amIndex = deduped.findIndex(r => normalize(r.role).includes('account management'));
    if (amIndex !== -1 && amIndex !== deduped.length - 1) {
      const temp = [...deduped];
      const [amRow] = temp.splice(amIndex, 1);
      temp.push(amRow);
      deduped = temp;
    }

    setRows(deduped);
    setIsInitialized(true);
  }, [isInitialized, node.attrs.rows]);

  // ⚠️ CRITICAL FIX: Update attributes ONLY when state actually changes
  // This runs AFTER state updates, preventing render cycle violations
  useEffect(() => {
    if (!isInitialized) return; // Don't sync until initial setup is done
    
    // 🔧 FILTER: Remove any empty rows before syncing to attributes
    const validRows = rows.filter(r => {
      const roleName = (r.role || '').trim();
      return roleName && roleName.length > 0 && roleName.toLowerCase() !== 'select role...' && roleName.toLowerCase() !== 'select role';
    });
    
    // Use queueMicrotask to defer the updateAttributes call outside the render cycle
    queueMicrotask(() => {
      updateAttributes({ rows: validRows, discount, showTotal });
    });
  }, [rows, discount, showTotal, isInitialized]);

  // Memoized callback for updating a single row field
  const updateRow = useCallback((id: string, field: keyof PricingRow, value: string | number) => {
    setRows(prevRows => {
      const newRows = prevRows.map(row => {
        if (row.id !== id) return row;
        
        if (field === 'role') {
          const selectedRole = ROLES.find(r => r.name === value);
          return {
            ...row,
            role: value as string,
            rate: selectedRole?.rate || row.rate,
          };
        }
        
        return { ...row, [field]: value };
      });
      return newRows;
    });
  }, []);

  // Memoized callback for adding a new row
  const addRow = useCallback(() => {
    const newRow: PricingRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: '',
      description: '',
      hours: 0,
      rate: 0
    };
    setRows(prev => [...prev, newRow]);
  }, []);

  // Memoized callback for removing a row
  const removeRow = useCallback((id: string) => {
    setRows(prevRows => {
      // Only prevent deletion if this is the last row with a role selected
      const rowsWithRoles = prevRows.filter(r => r.role && r.role.trim().length > 0);
      const rowToRemove = prevRows.find(r => r.id === id);
      
      // If removing a row with a role and it's the last one, don't allow it
      if (rowToRemove?.role && rowToRemove.role.trim().length > 0 && rowsWithRoles.length <= 1) {
        return prevRows;
      }
      
      return prevRows.filter(row => row.id !== id);
    });
  }, []);

  const fixDuplicateRoles = useCallback(() => {
    // Check if all/most rows have the same role
    const roleCounts: Record<string, number> = {};
    rows.forEach(row => {
      if (row.role) {
        roleCounts[row.role] = (roleCounts[row.role] || 0) + 1;
      }
    });

    // Find if there's a role that appears too many times
    const maxCount = Math.max(...Object.values(roleCounts));
    if (maxCount < 3) return; // No need to fix if no role appears 3+ times

    // Auto-assign varied roles while keeping hours
    // Use canonical roles from the rate card to ensure select values match options
    const canonicalFallbacks = [
      'Tech - Head Of - Senior Project Management',
      'Tech - Delivery - Project Coordination',
      'Tech - Producer - Development',
      'Tech - Integrations',
      'Tech - Producer - Campaign Strategy',
      'Tech - Producer - Landing Page (Onshore)',
      'Account Management - (Account Manager)'
    ];

    setRows(prevRows => {
      return prevRows.map((row, index) => {
        // If this row has the duplicate role, assign a different one
        const isDuplicate = roleCounts[row.role] >= 3;
        if (isDuplicate) {
          const desired = canonicalFallbacks[index % canonicalFallbacks.length];
          const newRole = ROLES.find(r => r.name === desired) || ROLES[index % ROLES.length];
          return {
            ...row,
            role: newRole.name,
            rate: newRole.rate
          };
        }
        return row;
      });
    });
  }, [rows]);

  // Drag and drop handlers using @dnd-kit
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setRows((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    
    setActiveId(null);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // Filter rows with actual roles for calculations (but show all rows in UI for editing)
  const rowsWithRoles = useMemo(() => rows.filter(r => r.role && r.role.trim().length > 0), [rows]);

  // Memoized calculations for better performance (only calculate for rows with roles)
  const calculations = useMemo(() => {
    const subtotal = rowsWithRoles.reduce((sum, row) => sum + (row.hours * row.rate), 0);
    const discountAmount = subtotal * (discount / 100);
    const subtotalAfterDiscount = subtotal - discountAmount;
    const gst = subtotalAfterDiscount * 0.1;
    const total = subtotalAfterDiscount + gst;
    const roundedTotal = Math.round(total / 100) * 100;

    return {
      subtotal,
      discountAmount,
      subtotalAfterDiscount,
      gst,
      total,
      roundedTotal,
    };
  }, [rowsWithRoles, discount]);

  // Get the active dragging row for overlay
  const activeRow = useMemo(() => {
    return activeId ? rows.find(row => row.id === activeId) : null;
  }, [activeId, rows]);

  return (
    <NodeViewWrapper className="editable-pricing-table my-6">
      <style>
        {`
          .pricing-row {
            transition: background-color 0.15s ease;
          }
          .editable-pricing-table {
            width: 100%;
            max-width: 100%;
            min-width: 0; /* Allow shrinking */
          }
          .pricing-table-container {
            position: relative;
            width: 100%;
            max-width: 100%;
            overflow-x: auto;
            overflow-y: visible;
          }
          /* Drop indicator styling */
          .drop-indicator {
            height: 3px;
            background: linear-gradient(90deg, #3b82f6, #60a5fa);
            border-radius: 2px;
            box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
          }
        `}
      </style>
      <div className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-[#0E0F0F] shadow-sm w-full max-w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Project Pricing</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">💡 Drag the ⋮⋮ icon to reorder rows</p>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            + Add Role
          </button>
        </div>

        {/* Pricing Table with DnD */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="pricing-table-container overflow-x-auto mb-6">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#0E0F0F]">
                  <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-left text-sm font-bold text-white uppercase tracking-wide min-w-[300px]">
                    Role
                  </th>
                  <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-right text-sm font-bold text-white uppercase tracking-wide w-32">
                    Hours
                  </th>
                  {showTotal && (
                    <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-right text-sm font-bold text-white uppercase tracking-wide w-40">
                      Total Cost + GST
                    </th>
                  )}
                  <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center text-sm font-bold text-white uppercase tracking-wide w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {rows.map((row, index) => (
                    <SortableRow
                      key={row.id}
                      row={row}
                      index={index}
                      showTotal={showTotal}
                      visibleRowsLength={rowsWithRoles.length}
                      onUpdateRow={updateRow}
                      onRemoveRow={removeRow}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </div>

          {/* Drag Overlay - Ghost Preview */}
          <DragOverlay dropAnimation={null}>
            {activeRow ? <DragOverlayRow row={activeRow} showTotal={showTotal} /> : null}
          </DragOverlay>
        </DndContext>

        {/* Additional Actions */}
        {rows.some(r => {
          const roleCounts: Record<string, number> = {};
          rows.forEach(row => {
            if (row.role) roleCounts[row.role] = (roleCounts[row.role] || 0) + 1;
          });
          return Object.values(roleCounts).some(count => count >= 3);
        }) && (
          <div className="mb-4">
            <button
              type="button"
              onClick={fixDuplicateRoles}
              className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 transition-colors shadow-sm"
              title="Auto-fix duplicate roles"
            >
              🔧 Fix Duplicate Roles
            </button>
          </div>
        )}

        {/* Summary Section */}
        <div className="flex justify-end">
          <div className="w-full max-w-md">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 space-y-3 shadow-sm">
              {/* Toggle Button for Total Price - MOVED TO TOP */}
              <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3 mb-1">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Show Pricing</span>
                <button
                  onClick={() => setShowTotal(!showTotal)}
                  className={`px-4 py-2 text-xs font-medium rounded-lg transition-all shadow-sm ${
                    showTotal 
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                  title={showTotal ? "Hide all pricing" : "Show all pricing"}
                >
                  {showTotal ? "✓ Visible" : "Hidden"}
                </button>
              </div>

              {showTotal && (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Discount (%):</span>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      className="w-20 px-3 py-1.5 text-sm text-right !text-foreground dark:text-gray-100 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>Subtotal:</span>
                    <span className="font-semibold tabular-nums">AUD {calculations.subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                        <span>Discount ({discount}%):</span>
                        <span className="tabular-nums">-AUD {calculations.discountAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                        <span>Subtotal after Discount:</span>
                        <span className="font-semibold tabular-nums">AUD {calculations.subtotalAfterDiscount.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {/* Show price as "+GST" OR with GST included */}
                  <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-3 mt-2 space-y-2">
                    <div className="flex justify-between text-base font-bold text-gray-900 dark:text-gray-100">
                      <span>Total Project Value:</span>
                      <span className="text-blue-600 dark:text-blue-400 tabular-nums">
                        AUD {calculations.subtotalAfterDiscount.toFixed(2)} <span className="text-sm font-normal text-gray-500">+GST</span>
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>GST (10%):</span>
                      <span className="tabular-nums">AUD {calculations.gst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 italic">
                      <span>Total incl. GST (unrounded):</span>
                      <span className="tabular-nums">AUD {calculations.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-900 dark:text-gray-100">
                      <span className="font-bold">Total incl. GST (rounded):</span>
                      <span className="font-bold tabular-nums">AUD {calculations.roundedTotal.toFixed(2)}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 text-right">Rounded to nearest $100</div>
                  </div>
                </>
              )}
              
              {!showTotal && (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-3">
                  💡 Pricing hidden - toggle to show investment details
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export const EditablePricingTable = Node.create({
  name: 'editablePricingTable',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      rows: {
        // Avoid inserting a default blank row; rows will be provided by the caller
        default: [],
      },
      discount: {
        default: 0,
      },
      showTotal: {
        default: true,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="editable-pricing-table"]',
      },
    ];
  },

  // Markdown serialization: skip markdown and use HTML only
  // This custom node is not suitable for markdown export
  renderMarkdown() {
    return null; // Skip markdown rendering for this node
  },

  renderHTML({ node, HTMLAttributes }) {
    const originalRows: PricingRow[] = node.attrs.rows || [];
    const discount = node.attrs.discount || 0;
    const showTotal: boolean = node.attrs.showTotal !== undefined ? node.attrs.showTotal : true;

    const norm = (s: string) => (s || '')
      .toLowerCase()
      .replace(/\s*-/g, '-')
      .replace(/-\s*/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    // Start with provided rows; do not inject governance rows here
    let rows: PricingRow[] = [...originalRows];

    // Ensure Account Management last if present
    const amIdx = rows.findIndex(r => norm(r.role).includes('account management'));
    if (amIdx !== -1 && amIdx !== rows.length - 1) {
      const tmp = [...rows];
      const [amRow] = tmp.splice(amIdx, 1);
      tmp.push(amRow);
      rows = tmp;
    }

    // Exclude any zero-cost rows for PDF/HTML rendering (clarity for clients)
    const exportRows = rows.filter(r => (Number(r.hours) || 0) * (Number(r.rate) || 0) > 0);

    // Calculate totals
  const subtotal = exportRows.reduce((sum, row) => sum + (row.hours * row.rate), 0);
  const discountAmount = (subtotal * discount) / 100;
  const subtotalAfterDiscount = subtotal - discountAmount;
  const gst = subtotalAfterDiscount * 0.10;
  const total = subtotalAfterDiscount + gst;
  const roundedTotal = Math.round(total / 100) * 100;
    
    // Build proper DOM structure for rendering
    const tableContent: any[] = [
      'table',
      { style: 'width:100%; border-collapse:collapse; margin:1.5rem 0; border:2px solid #0e2e33;' },
      [
        'thead',
        {},
        [
          'tr',
          {},
          ['th', { style: 'background:#0e2e33; color:white; padding:0.875rem 1rem; text-align:left; border:1px solid #0e2e33;' }, 'Role'],
          ['th', { style: 'background:#0e2e33; color:white; padding:0.875rem 1rem; text-align:left; border:1px solid #0e2e33;' }, 'Description'],
          ...(showTotal ? [
            ['th', { style: 'background:#0e2e33; color:white; padding:0.875rem 1rem; text-align:right; border:1px solid #0e2e33;' }, 'Hours'],
            ['th', { style: 'background:#0e2e33; color:white; padding:0.875rem 1rem; text-align:right; border:1px solid #0e2e33;' }, 'Rate'],
            ['th', { style: 'background:#0e2e33; color:white; padding:0.875rem 1rem; text-align:right; border:1px solid #0e2e33;' }, 'Total'],
          ] : []),
        ]
      ],
      [
        'tbody',
        {},
        ...exportRows.map((row, index) => {
          const rowTotal = row.hours * row.rate;
          const bgColor = index % 2 === 0 ? '#f9fafb' : 'white';
          return [
            'tr',
            { style: `background:${bgColor};` },
            ['td', { style: 'padding:0.875rem 1rem; border:1px solid #d1d5db;' }, row.role],
            ['td', { style: 'padding:0.875rem 1rem; border:1px solid #d1d5db;' }, row.description || ''],
            ...(showTotal ? [
              ['td', { style: 'padding:0.875rem 1rem; border:1px solid #d1d5db; text-align:right;' }, row.hours.toString()],
              ['td', { style: 'padding:0.875rem 1rem; border:1px solid #d1d5db; text-align:right;' }, `AUD ${row.rate.toFixed(2)}`],
              ['td', { style: 'padding:0.875rem 1rem; border:1px solid #d1d5db; text-align:right; font-weight:600;' }, `AUD ${rowTotal.toFixed(2)} +GST`],
            ] : []),
          ];
        })
      ]
    ];
    
    // Build totals section (respect visibility)
    const totalsSection: any[] = [
      'div',
      { style: 'margin-top:1.5rem; padding-top:1rem; border-top:2px solid #0e2e33;' },
      [
        'div',
        { style: 'max-width:400px; margin-left:auto;' },
        ['div', { style: 'display:flex; justify-content:space-between; padding:0.5rem 0;' },
          ['span', { style: 'font-weight:600; color:#0e2e33;' }, 'Subtotal:'],
          ['span', { style: 'font-weight:600; color:#0e2e33;' }, `AUD ${subtotal.toFixed(2)}`]
        ],
        ...(discount > 0 ? [
          ['div', { style: 'display:flex; justify-content:space-between; padding:0.5rem 0; color:#ef4444;' },
            ['span', {}, `Discount (${discount}%):`],
            ['span', {}, `-AUD ${discountAmount.toFixed(2)}`]
          ],
        ['div', { style: 'display:flex; justify-content:space-between; padding:0.5rem 0;' },
          ['span', { style: 'font-weight:600;' }, 'Subtotal After Discount:'],
          ['span', { style: 'font-weight:600;' }, `AUD ${subtotalAfterDiscount.toFixed(2)}`]
        ]
      ] : []),
        ['div', { style: 'display:flex; justify-content:space-between; padding:0.5rem 0;' },
          ['span', {}, 'GST (10%):'],
          ['span', {}, `AUD ${gst.toFixed(2)}`]
        ],
        ['div', { style: 'display:flex; justify-content:space-between; padding:0.25rem 0; border-top:2px solid #0e2e33; margin-top:0.5rem; font-style:italic; color:#6b7280;' },
          ['span', {}, 'Total incl. GST (unrounded):'],
          ['span', {}, `AUD ${total.toFixed(2)}`]
        ],
        ['div', { style: 'display:flex; justify-content:space-between; padding:0.5rem 0;' },
          ['span', { style: 'font-size:1.10rem; font-weight:700; color:#0e2e33;' }, 'Total Investment (rounded):'],
          ['span', { style: 'font-size:1.10rem; font-weight:700; color:#0e2e33;' }, `AUD ${roundedTotal.toFixed(2)}`]
        ],
        ['div', { style: 'text-align:right; font-size:10px; color:#6b7280;' }, 'Rounded to nearest $100']
      ]
    ];
    
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'editable-pricing-table' }),
      tableContent,
      ...(showTotal ? [totalsSection] : [])
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EditablePricingTableComponent);
  },
});
