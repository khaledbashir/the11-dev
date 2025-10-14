import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useEffect } from 'react';

// Social Garden 82 roles with AUD rates
const ROLES = [
  { name: "Project Manager", rate: 160 },
  { name: "Project Coordination", rate: 140 },
  { name: "Account Management", rate: 150 },
  { name: "Strategy Director", rate: 180 },
  { name: "Senior Strategist", rate: 160 },
  { name: "Strategist", rate: 140 },
  { name: "Creative Director", rate: 180 },
  { name: "Senior Art Director", rate: 160 },
  { name: "Art Director", rate: 140 },
  { name: "Senior Copywriter", rate: 160 },
  { name: "Copywriter", rate: 140 },
  { name: "Senior Designer", rate: 150 },
  { name: "Designer", rate: 130 },
  { name: "Junior Designer", rate: 110 },
  { name: "Senior UX Designer", rate: 160 },
  { name: "UX Designer", rate: 140 },
  { name: "Senior UI Designer", rate: 160 },
  { name: "UI Designer", rate: 140 },
  { name: "Motion Designer", rate: 150 },
  { name: "Senior Motion Designer", rate: 170 },
  { name: "3D Designer", rate: 160 },
  { name: "Illustrator", rate: 150 },
  { name: "Photographer", rate: 180 },
  { name: "Videographer", rate: 180 },
  { name: "Video Editor", rate: 150 },
  { name: "Sound Designer", rate: 140 },
  { name: "Technical Director", rate: 180 },
  { name: "Senior Developer", rate: 160 },
  { name: "Developer", rate: 140 },
  { name: "Junior Developer", rate: 120 },
  { name: "Front-End Developer", rate: 150 },
  { name: "Senior Front-End Developer", rate: 170 },
  { name: "Back-End Developer", rate: 160 },
  { name: "Senior Back-End Developer", rate: 180 },
  { name: "Full-Stack Developer", rate: 160 },
  { name: "Senior Full-Stack Developer", rate: 180 },
  { name: "DevOps Engineer", rate: 170 },
  { name: "Senior DevOps Engineer", rate: 190 },
  { name: "QA Engineer", rate: 140 },
  { name: "Senior QA Engineer", rate: 160 },
  { name: "Data Analyst", rate: 150 },
  { name: "Senior Data Analyst", rate: 170 },
  { name: "SEO Specialist", rate: 140 },
  { name: "Senior SEO Specialist", rate: 160 },
  { name: "Content Strategist", rate: 140 },
  { name: "Senior Content Strategist", rate: 160 },
  { name: "Social Media Manager", rate: 130 },
  { name: "Senior Social Media Manager", rate: 150 },
  { name: "Community Manager", rate: 120 },
  { name: "Email Marketing Specialist", rate: 130 },
  { name: "Senior Email Marketing Specialist", rate: 150 },
  { name: "Marketing Automation Specialist", rate: 150 },
  { name: "CRM Specialist", rate: 140 },
  { name: "Senior CRM Specialist", rate: 160 },
  { name: "Web Analytics Specialist", rate: 150 },
  { name: "Conversion Rate Optimization Specialist", rate: 160 },
  { name: "UX Researcher", rate: 150 },
  { name: "Senior UX Researcher", rate: 170 },
  { name: "Product Manager", rate: 170 },
  { name: "Senior Product Manager", rate: 190 },
  { name: "Business Analyst", rate: 150 },
  { name: "Senior Business Analyst", rate: 170 },
  { name: "Scrum Master", rate: 160 },
  { name: "Agile Coach", rate: 180 },
  { name: "Solutions Architect", rate: 190 },
  { name: "Enterprise Architect", rate: 200 },
  { name: "Security Specialist", rate: 170 },
  { name: "Senior Security Specialist", rate: 190 },
  { name: "Cloud Architect", rate: 190 },
  { name: "Database Administrator", rate: 160 },
  { name: "Senior Database Administrator", rate: 180 },
  { name: "Systems Administrator", rate: 150 },
  { name: "Network Engineer", rate: 160 },
  { name: "Support Engineer", rate: 130 },
  { name: "Senior Support Engineer", rate: 150 },
  { name: "Training Specialist", rate: 140 },
  { name: "Documentation Specialist", rate: 130 },
  { name: "Accessibility Specialist", rate: 150 },
  { name: "Localization Specialist", rate: 140 },
  { name: "Brand Manager", rate: 160 },
  { name: "Production Manager", rate: 150 },
  { name: "Traffic Manager", rate: 130 },
];

interface PricingRow {
  role: string;
  description: string;
  hours: number;
  rate: number;
}

const EditablePricingTableComponent = ({ node, updateAttributes }: any) => {
  const [rows, setRows] = useState<PricingRow[]>(node.attrs.rows || []);
  const [discount, setDiscount] = useState(node.attrs.discount || 0);

  useEffect(() => {
    updateAttributes({ rows, discount });
  }, [rows, discount]);

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

  return (
    <NodeViewWrapper className="editable-pricing-table my-6">
      <div className="border border-gray-300 rounded-lg p-4 bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Project Pricing</h3>
          <button
            onClick={addRow}
            className="px-3 py-1 bg-[#2C823D] text-white rounded text-sm hover:bg-[#25703A]"
          >
            + Add Role
          </button>
        </div>

        {/* Pricing Table */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#2C823D] text-white">
                <th className="border border-gray-300 px-3 py-2 text-left text-sm">Role</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm">Description</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm w-24">Hours</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm w-24">Rate</th>
                <th className="border border-gray-300 px-3 py-2 text-right text-sm w-32">Cost</th>
                <th className="border border-gray-300 px-3 py-2 text-center text-sm w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-2">
                    <select
                      value={row.role}
                      onChange={(e) => updateRow(index, 'role', e.target.value)}
                      style={{ color: '#111827', backgroundColor: '#f9fafb' }}
                      className="w-full px-2 py-1 text-sm !text-gray-900 bg-gray-50 border border-gray-300 rounded focus:outline-none focus:border-[#2C823D]"
                    >
                      <option value="">Select role...</option>
                      {ROLES.map((role) => (
                        <option key={role.name} value={role.name}>
                          {role.name} - ${role.rate}/hr
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-gray-300 p-2">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) => updateRow(index, 'description', e.target.value)}
                      placeholder="Description..."
                      style={{ color: '#000000', backgroundColor: '#e5e7eb' }}
                      className="w-full px-2 py-1 text-sm !text-black bg-gray-200 border border-gray-300 rounded focus:outline-none focus:border-[#2C823D] placeholder:text-gray-500"
                    />
                  </td>
                  <td className="border border-gray-300 p-2">
                    <input
                      type="number"
                      value={row.hours || ''}
                      onChange={(e) => updateRow(index, 'hours', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      min="0"
                      step="0.5"
                      style={{ color: '#111827', backgroundColor: '#f9fafb' }}
                      className="w-full px-2 py-1 text-sm !text-gray-900 bg-gray-50 border border-gray-300 rounded focus:outline-none focus:border-[#2C823D] placeholder:text-gray-400"
                    />
                  </td>
                  <td className="border border-gray-300 p-2">
                    <input
                      type="number"
                      value={row.rate || ''}
                      onChange={(e) => updateRow(index, 'rate', parseFloat(e.target.value) || 0)}
                      placeholder="$0"
                      min="0"
                      style={{ color: '#111827', backgroundColor: '#f9fafb' }}
                      className="w-full px-2 py-1 text-sm !text-gray-900 bg-gray-50 border border-gray-300 rounded focus:outline-none focus:border-[#2C823D] placeholder:text-gray-400"
                    />
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold" style={{ color: '#000000' }}>
                    ${(row.hours * row.rate).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
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
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center text-sm text-gray-900">
                <span>Discount (%):</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  style={{ color: '#111827', backgroundColor: '#f9fafb' }}
                  className="w-20 px-2 py-1 text-sm !text-gray-900 bg-gray-50 border border-gray-300 rounded focus:outline-none focus:border-[#2C823D] text-right placeholder:text-gray-400"
                />
              </div>
              <div className="flex justify-between text-sm text-gray-900">
                <span>Subtotal:</span>
                <span className="font-semibold">${calculateSubtotal().toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <>
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Discount ({discount}%):</span>
                    <span>-${calculateDiscount().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-900">
                    <span>After Discount:</span>
                    <span className="font-semibold">${calculateSubtotalAfterDiscount().toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm text-gray-900">
                <span>GST (10%):</span>
                <span>${calculateGST().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-300 pt-2 mt-2">
                <span>Total Project Value:</span>
                <span className="text-[#2C823D]">${calculateTotal().toFixed(2)}</span>
              </div>
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
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="editable-pricing-table"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'editable-pricing-table' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EditablePricingTableComponent);
  },
});
