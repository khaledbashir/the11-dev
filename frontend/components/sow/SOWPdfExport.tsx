import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer';
import { SOWData, SOWPdfExportProps } from './types';
import {
  formatCurrency,
  calculateScopeTotal,
  calculateScopeHours,
  calculateGrandTotal,
  calculateTotalHours,
} from './utils';

// Register fonts (optional - for better typography)
// Font.register({
//   family: 'Roboto',
//   src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
// });

// Define styles using StyleSheet
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  
  // Header Section Styles
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  logo: {
    width: 150,
    height: 40,
    marginBottom: 15,
  },
  mainTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 6,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clientInfo: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  clientLabel: {
    fontWeight: 'bold',
  },

  // Scope Section Styles
  scopeSection: {
    marginBottom: 25,
  },
  scopeHeader: {
    backgroundColor: '#4A90E2',
    padding: 10,
    marginBottom: 10,
    borderRadius: 3,
  },
  scopeHeaderText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  scopeDescription: {
    fontSize: 10,
    marginBottom: 15,
    lineHeight: 1.5,
    color: '#333333',
  },

  // Table Styles
  table: {
    width: '100%',
    marginBottom: 15,
    border: '1px solid #e0e0e0',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #333333',
    padding: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #e0e0e0',
    padding: 8,
    minHeight: 30,
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  
  // Table Column Styles
  colItems: {
    width: '45%',
    paddingRight: 5,
  },
  colRole: {
    width: '30%',
    paddingRight: 5,
  },
  colHours: {
    width: '10%',
    textAlign: 'right',
    paddingRight: 5,
  },
  colCost: {
    width: '15%',
    textAlign: 'right',
  },
  
  tableHeaderText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#333333',
  },
  tableCellText: {
    fontSize: 9,
    lineHeight: 1.4,
    color: '#333333',
  },
  tableCellTextBold: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#333333',
  },

  // Lists Styles
  listSection: {
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#333333',
    textTransform: 'uppercase',
  },
  listItem: {
    fontSize: 9,
    marginBottom: 4,
    paddingLeft: 15,
    lineHeight: 1.4,
    color: '#333333',
  },
  bullet: {
    marginRight: 5,
  },

  // Totals Section Styles
  totalsSection: {
    marginTop: 20,
    marginBottom: 30,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    marginBottom: 5,
    width: '40%',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  grandTotalRow: {
    flexDirection: 'row',
    width: '40%',
    justifyContent: 'space-between',
    borderTop: '2px solid #333333',
    paddingTop: 10,
    paddingBottom: 5,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333333',
  },
  totalAmount: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333333',
  },
  grandTotalAmount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#4A90E2',
  },

  // Summary Table Styles
  summarySection: {
    marginTop: 30,
    marginBottom: 30,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333333',
    textTransform: 'uppercase',
  },
  summaryTable: {
    width: '100%',
    border: '1px solid #e0e0e0',
  },
  summaryColScope: {
    width: '50%',
    paddingRight: 5,
  },
  summaryColHours: {
    width: '25%',
    textAlign: 'right',
    paddingRight: 5,
  },
  summaryColCost: {
    width: '25%',
    textAlign: 'right',
  },

  // Text Sections
  textSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333333',
    textTransform: 'uppercase',
  },
  sectionContent: {
    fontSize: 10,
    lineHeight: 1.6,
    color: '#333333',
  },

  // Footer Styles
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    borderTop: '1px solid #e0e0e0',
    paddingTop: 10,
  },
});

const SOWPdfExport: React.FC<SOWPdfExportProps> = ({ sowData }) => {
  const {
    company,
    clientName,
    projectTitle,
    projectSubtitle,
    projectOverview,
    budgetNotes,
    scopes,
    currency,
    gstApplicable,
    generatedDate,
  } = sowData;

  const grandTotal = calculateGrandTotal(scopes);
  const totalHours = calculateTotalHours(scopes);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          {company.logoUrl && (
            <Image
              src={company.logoUrl}
              style={styles.logo}
            />
          )}
          <Text style={styles.mainTitle}>{projectTitle}</Text>
          <Text style={styles.subtitle}>{projectSubtitle}</Text>
          <Text style={styles.clientInfo}>
            <Text style={styles.clientLabel}>Client: </Text>
            {clientName}
          </Text>
        </View>

        {/* Scopes Section */}
        {scopes.map((scope, scopeIndex) => (
          <View key={scope.id} style={styles.scopeSection} wrap={false}>
            {/* Scope Header */}
            <View style={styles.scopeHeader}>
              <Text style={styles.scopeHeaderText}>
                Scope {scope.id}: {scope.title}
              </Text>
            </View>

            {/* Scope Description */}
            <Text style={styles.scopeDescription}>{scope.description}</Text>

            {/* Items Table */}
            <View style={styles.table}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <View style={styles.colItems}>
                  <Text style={styles.tableHeaderText}>ITEMS</Text>
                </View>
                <View style={styles.colRole}>
                  <Text style={styles.tableHeaderText}>ROLE</Text>
                </View>
                <View style={styles.colHours}>
                  <Text style={styles.tableHeaderText}>HOURS</Text>
                </View>
                <View style={styles.colCost}>
                  <Text style={styles.tableHeaderText}>
                    TOTAL COST {gstApplicable ? '+ GST' : ''}
                  </Text>
                </View>
              </View>

              {/* Table Rows */}
              {scope.items.map((item, itemIndex) => (
                <View
                  key={itemIndex}
                  style={[
                    styles.tableRow,
                    itemIndex % 2 === 1 ? styles.tableRowAlt : {},
                  ]}
                >
                  <View style={styles.colItems}>
                    <Text style={styles.tableCellText}>{item.description}</Text>
                  </View>
                  <View style={styles.colRole}>
                    <Text style={styles.tableCellText}>{item.role}</Text>
                  </View>
                  <View style={styles.colHours}>
                    <Text style={styles.tableCellText}>{item.hours}</Text>
                  </View>
                  <View style={styles.colCost}>
                    <Text style={styles.tableCellTextBold}>
                      {formatCurrency(item.cost, currency)}
                    </Text>
                  </View>
                </View>
              ))}

              {/* Scope Total Row */}
              <View style={[styles.tableRow, { backgroundColor: '#f0f0f0' }]}>
                <View style={styles.colItems}>
                  <Text style={styles.tableCellTextBold}>Scope Total</Text>
                </View>
                <View style={styles.colRole}>
                  <Text style={styles.tableCellText}></Text>
                </View>
                <View style={styles.colHours}>
                  <Text style={styles.tableCellTextBold}>
                    {calculateScopeHours(scope.items)}
                  </Text>
                </View>
                <View style={styles.colCost}>
                  <Text style={styles.tableCellTextBold}>
                    {formatCurrency(calculateScopeTotal(scope.items), currency)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Deliverables */}
            {scope.deliverables && scope.deliverables.length > 0 && (
              <View style={styles.listSection}>
                <Text style={styles.listTitle}>Deliverables:</Text>
                {scope.deliverables.map((deliverable, index) => (
                  <Text key={index} style={styles.listItem}>
                    <Text style={styles.bullet}>• </Text>
                    {deliverable}
                  </Text>
                ))}
              </View>
            )}

            {/* Assumptions */}
            {scope.assumptions && scope.assumptions.length > 0 && (
              <View style={styles.listSection}>
                <Text style={styles.listTitle}>Assumptions:</Text>
                {scope.assumptions.map((assumption, index) => (
                  <Text key={index} style={styles.listItem}>
                    <Text style={styles.bullet}>• </Text>
                    {assumption}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Grand Total Section */}
        <View style={styles.totalsSection}>
          <View style={styles.grandTotalRow}>
            <Text style={styles.totalLabel}>TOTAL:</Text>
            <Text style={styles.grandTotalAmount}>
              {formatCurrency(grandTotal, currency)}
            </Text>
          </View>
        </View>

        {/* Scope & Price Overview Table */}
        <View style={styles.summarySection} wrap={false}>
          <Text style={styles.summaryTitle}>Scope & Price Overview</Text>
          <View style={styles.summaryTable}>
            {/* Summary Table Header */}
            <View style={styles.tableHeader}>
              <View style={styles.summaryColScope}>
                <Text style={styles.tableHeaderText}>SCOPE</Text>
              </View>
              <View style={styles.summaryColHours}>
                <Text style={styles.tableHeaderText}>ESTIMATED TOTAL HOURS</Text>
              </View>
              <View style={styles.summaryColCost}>
                <Text style={styles.tableHeaderText}>TOTAL COST</Text>
              </View>
            </View>

            {/* Summary Table Rows */}
            {scopes.map((scope, index) => (
              <View
                key={scope.id}
                style={[
                  styles.tableRow,
                  index % 2 === 1 ? styles.tableRowAlt : {},
                ]}
              >
                <View style={styles.summaryColScope}>
                  <Text style={styles.tableCellText}>
                    Scope {scope.id}: {scope.title}
                  </Text>
                </View>
                <View style={styles.summaryColHours}>
                  <Text style={styles.tableCellText}>
                    {calculateScopeHours(scope.items)}
                  </Text>
                </View>
                <View style={styles.summaryColCost}>
                  <Text style={styles.tableCellTextBold}>
                    {formatCurrency(calculateScopeTotal(scope.items), currency)}
                  </Text>
                </View>
              </View>
            ))}

            {/* Summary Total Row */}
            <View style={[styles.tableRow, { backgroundColor: '#f0f0f0' }]}>
              <View style={styles.summaryColScope}>
                <Text style={styles.tableCellTextBold}>TOTAL PROJECT</Text>
              </View>
              <View style={styles.summaryColHours}>
                <Text style={styles.tableCellTextBold}>{totalHours}</Text>
              </View>
              <View style={styles.summaryColCost}>
                <Text style={styles.tableCellTextBold}>
                  {formatCurrency(grandTotal, currency)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Project Overview Section */}
        {projectOverview && (
          <View style={styles.textSection} wrap={false}>
            <Text style={styles.sectionTitle}>Project Overview</Text>
            <Text style={styles.sectionContent}>{projectOverview}</Text>
          </View>
        )}

        {/* Budget Notes Section */}
        {budgetNotes && (
          <View style={styles.textSection} wrap={false}>
            <Text style={styles.sectionTitle}>Budget Notes</Text>
            <Text style={styles.sectionContent}>{budgetNotes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            {company.name} | Generated on {generatedDate}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default SOWPdfExport;
