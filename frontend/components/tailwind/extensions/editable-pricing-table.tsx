"use client";

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useEffect } from 'react';
import { ROLES } from '@/lib/rateCard';

interface PricingRow {
  role: string;
  description: string;
  hours: number;
  rate: number;
}

const EditablePricingTableComponent = ({ node, updateAttributes }: any) => {
  const [rows, setRows] = useState<PricingRow[]>(node.attrs.rows || []);
  const [discount, setDiscount] = useState(node.attrs.discount || 0);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showTotal, setShowTotal] = useState(node.attrs.showTotal !== undefined ? node.attrs.showTotal : true);
  const [isInitialized, setIsInitialized] = useState(false);

  // ⚠️ CRITICAL FIX: Initialize and normalize rows ONCE on mount
  useEffect(() => {
    if (isInitialized || !node.attrs.rows) return;

    const normalize = (s: string) => (s || '').trim().toLowerCase();
    const initialRows = node.attrs.rows || [];

    // 1) Dedupe by role: combine hours, prefer known rate from ROLES, keep first description
    const roleMap = new Map<string, PricingRow>();
    for (const r of initialRows) {
      const key = normalize(r.role);
      if (!key) continue;
      const existing = roleMap.get(key);
      if (!existing) {
        // Prefer canonical rate from ROLES if available
        const canon = ROLES.find(x => normalize(x.name) === key);
        roleMap.set(key, {
          role: r.role,
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
          role: existing.role,
          description: existing.description || r.description || '',
          hours: mergedHours,
          rate: mergedRate,
        });
      }
    }

    let deduped = Array.from(roleMap.values());

    // 2) Ensure mandatory roles exist
    const ensureRole = (name: string, defaultHours: number, defaultRate?: number, desc?: string) => {
      const key = normalize(name);
      if (!roleMap.has(key)) {
        const canon = ROLES.find(x => normalize(x.name) === key);
        deduped.push({
          role: name,
          description: desc || '',
          hours: defaultHours,
          rate: defaultRate ?? canon?.rate ?? 0,
        });
      }
    };

    ensureRole('Tech - Head Of - Senior Project Management', 3, 365, 'Strategic oversight');
    ensureRole('Tech - Delivery - Project Coordination', 6, 110, 'Delivery coordination');
    ensureRole('Account Management - (Account Manager)', 8, 180, 'Client comms & governance');

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
    
    // Use queueMicrotask to defer the updateAttributes call outside the render cycle
    queueMicrotask(() => {
      updateAttributes({ rows, discount, showTotal });
    });
  }, [rows, discount, showTotal, isInitialized]);

  const updateRow = (index: number, field: keyof PricingRow, value: string | number) => {
    const newRows = [...rows];
    if (field === 'role') {
      const selectedRole = ROLES.find(r => r.name === value);
      newRows[index] = {
        ...newRows[index],
        role: value as string,
        rate: selectedRole?.rate || newRows[index].rate,
      };
    } else {
      newRows[index] = { ...newRows[index], [field]: value };
    }
    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, { role: '', description: '', hours: 0, rate: 0 }]);
  };

  const removeRow = (index: number) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== index));
    }
  };

  const fixDuplicateRoles = () => {
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
    const defaultRoles = [
      "Project Manager",
      "Senior Designer", 
      "Developer",
      "Copywriter",
      "Art Director",
      "Strategist",
      "Account Management"
    ];

    const newRows = rows.map((row, index) => {
      // If this row has the duplicate role, assign a different one
      const isDuplicate = roleCounts[row.role] >= 3;
      if (isDuplicate && index < defaultRoles.length) {
        const newRole = ROLES.find(r => r.name === defaultRoles[index]) || ROLES[index];
        return {
          ...row,
          role: newRole.name,
          rate: newRole.rate
        };
      }
      return row;
    });

    setRows(newRows);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Add a subtle opacity to the dragged row
    (e.target as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIndex(null);
    (e.target as HTMLElement).style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      return;
    }

    // Reorder the rows
    const newRows = [...rows];
    const [draggedRow] = newRows.splice(draggedIndex, 1);
    newRows.splice(dropIndex, 0, draggedRow);
    
    setRows(newRows);
    setDraggedIndex(null);
  };

  const calculateSubtotal = () => {
    return rows.reduce((sum, row) => sum + (row.hours * row.rate), 0);
  };

  const calculateDiscount = () => {
    return calculateSubtotal() * (discount / 100);
  };

  const calculateSubtotalAfterDiscount = () => {
    return calculateSubtotal() - calculateDiscount();
  };

  const calculateGST = () => {
    return calculateSubtotalAfterDiscount() * 0.1;
  };

  const calculateTotal = () => {
    return calculateSubtotalAfterDiscount() + calculateGST();
  };

  const calculateRoundedTotal = () => {
    const total = calculateTotal();
    // Commercial rounding: nearest $100
    return Math.round(total / 100) * 100;
  };

  return (
    <NodeViewWrapper className="editable-pricing-table my-6">
      <style>
        {`
          .pricing-row-dragging {
            opacity: 0.5;
            background-color: #f3f4f6;
          }
          .pricing-row:hover .drag-handle {
            opacity: 1;
          }
          .drag-handle {
            opacity: 0.3;
            transition: opacity 0.2s;
          }
          .pricing-row {
            transition: background-color 0.15s ease;
          }
        `}
      </style>
      <div className="border border-border rounded-lg p-4 bg-background dark:bg-gray-900/50">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground dark:text-gray-100">Project Pricing</h3>
            <p className="text-xs text-gray-500 mt-0.5">💡 Tip: Drag rows to reorder</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fixDuplicateRoles}
              className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
              title="Auto-fix duplicate roles"
            >
              🔧 Fix Roles
            </button>
            <button
              onClick={addRow}
              className="px-3 py-1 bg-[#0e2e33] text-white rounded text-sm hover:bg-[#0a2328] transition-colors"
            >
              + Add Role
            </button>
          </div>
        </div>

        {/* Pricing Table */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#0e2e33] text-white">
                <th className="border border-border px-3 py-2 text-left text-sm">ROLE</th>
                <th className="border border-border px-3 py-2 text-left text-sm w-24">HOURS</th>
                {showTotal && <th className="border border-border px-3 py-2 text-right text-sm w-32">TOTAL COST + GST</th>}
                <th className="border border-border px-3 py-2 text-center text-sm w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr 
                  key={index} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`pricing-row hover:bg-muted dark:bg-gray-800 cursor-move ${
                    draggedIndex === index ? 'pricing-row-dragging' : ''
                  }`}
                  title="💡 Drag to reorder rows"
                >
                  <td className="border border-border p-2">
                    <div className="flex items-center gap-2">
                      <span className="drag-handle text-gray-400 cursor-grab active:cursor-grabbing select-none text-lg" title="Drag to reorder">⋮⋮</span>
                      <select
                        value={row.role}
                        onChange={(e) => updateRow(index, 'role', e.target.value)}
                        
                        className="flex-1 px-2 py-1 text-sm !text-foreground dark:text-gray-100 bg-muted dark:bg-gray-800 border border-border rounded focus:outline-none focus:border-[#0e2e33]"
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
                  <td className="border border-border p-2">
                    <input
                      type="number"
                      value={row.hours || ''}
                      onChange={(e) => updateRow(index, 'hours', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      min="0"
                      step="0.5"
                      
                      className="w-full px-2 py-1 text-sm !text-foreground dark:text-gray-100 bg-muted dark:bg-gray-800 border border-border rounded focus:outline-none focus:border-[#0e2e33] placeholder:text-gray-400"
                    />
                  </td>
                  {showTotal && (
                    <td className="border border-border px-3 py-2 text-right text-sm font-semibold">
                      AUD {(row.hours * row.rate).toFixed(2)} +GST
                    </td>
                  )}
                  <td className="border border-border p-2 text-center">
                    <button
                      onClick={() => removeRow(index)}
                      disabled={rows.length === 1}
                      className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Section */}
        <div className="flex justify-end">
          <div className="w-full max-w-md">
            <div className="bg-muted dark:bg-gray-800 rounded-lg p-4 space-y-2">
              {/* Toggle Button for Total Price - MOVED TO TOP */}
              <div className="flex justify-between items-center border-b border-border pb-2 mb-2">
                <span className="text-sm font-medium text-foreground dark:text-gray-100">Show Pricing</span>
                <button
                  onClick={() => setShowTotal(!showTotal)}
                  className={`px-3 py-1.5 text-xs rounded transition-all ${
                    showTotal 
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                  title={showTotal ? "Hide all pricing" : "Show all pricing"}
                >
                  {showTotal ? "✓ Visible" : "Hidden"}
                </button>
              </div>

              {showTotal && (
                <>
                  <div className="flex justify-between items-center text-sm text-foreground dark:text-gray-100">
                    <span>Discount (%):</span>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      
                      className="w-20 px-2 py-1 text-sm !text-foreground dark:text-gray-100 bg-muted dark:bg-gray-800 border border-border rounded focus:outline-none focus:border-[#0e2e33] text-right placeholder:text-gray-400"
                    />
                  </div>
                  <div className="flex justify-between text-sm text-foreground dark:text-gray-100">
                    <span>Subtotal:</span>
                    <span className="font-semibold">AUD {calculateSubtotal().toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-red-600">
                        <span>Discount ({discount}%):</span>
                        <span>-AUD {calculateDiscount().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-foreground dark:text-gray-100">
                        <span>Subtotal after Discount:</span>
                        <span className="font-semibold">AUD {calculateSubtotalAfterDiscount().toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {/* Show price as "+GST" OR with GST included */}
                  <div className="border-t border-border pt-2 mt-2 space-y-1">
                    <div className="flex justify-between text-base font-bold text-foreground dark:text-gray-100">
                      <span>Total Project Value:</span>
                      <span className="text-[#0e2e33]">AUD {calculateSubtotalAfterDiscount().toFixed(2)} <span className="text-sm font-normal">+GST</span></span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>GST (10%):</span>
                      <span>AUD {calculateGST().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span className="italic">Total incl. GST (unrounded):</span>
                      <span>AUD {calculateTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-foreground dark:text-gray-100">
                      <span className="font-semibold">Total incl. GST (rounded):</span>
                      <span className="font-semibold">AUD {calculateRoundedTotal().toFixed(2)}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 text-right">Rounded to nearest $100</div>
                  </div>
                </>
              )}
              
              {!showTotal && (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
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
        default: [{ role: '', description: '', hours: 0, rate: 0 }],
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
    
    // Ensure mandatory roles exist for render (Head Of, Project Coordination, Account Management)
    const lower = (s: string) => (s || '').toLowerCase();
    const hasAM = originalRows.some(r => lower(r.role).includes('account management') || lower(r.role).includes('account manager'));
    const hasHeadOf = originalRows.some(r => lower(r.role).includes('head of'));
  const hasPC = originalRows.some(r => lower(r.role) === 'tech - delivery - project coordination');
    const amRole = ROLES.find(r => r.name === 'Account Management');
    const headOfRole = ROLES.find(r => r.name === 'Tech - Head Of - Senior Project Management');
  const pcRole = ROLES.find(r => r.name === 'Tech - Delivery - Project Coordination');

    let rows: PricingRow[] = [...originalRows];
    if (!hasHeadOf) {
      rows.unshift({
        role: headOfRole?.name || 'Tech - Head Of - Senior Project Management',
        description: 'Strategic oversight',
        hours: 3,
        rate: headOfRole?.rate || 365,
      });
    }
    if (!hasPC) {
      rows.push({
        role: pcRole?.name || 'Tech - Delivery - Project Coordination',
        description: 'Delivery coordination',
        hours: 6,
        rate: pcRole?.rate || 110,
      });
    }
    if (!hasAM) {
      rows.push({
        role: amRole?.name || 'Account Management - (Account Manager)',
        description: 'Client comms & governance',
        hours: 8,
        rate: amRole?.rate || 180,
      });
    }
    // Ensure Account Management last
    const amIdx = rows.findIndex(r => lower(r.role).includes('account management'));
    if (amIdx !== -1 && amIdx !== rows.length - 1) {
      const tmp = [...rows];
      const [amRow] = tmp.splice(amIdx, 1);
      tmp.push(amRow);
      rows = tmp;
    }
    
    // Calculate totals
  const subtotal = rows.reduce((sum, row) => sum + (row.hours * row.rate), 0);
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
        ...rows.map((row, index) => {
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
