// Authoritative Social Garden rate card (AUD/hr)
// Source: Official spreadsheet provided by Social Garden (Oct 2025)
export type RoleRate = { name: string; rate: number };

export const ROLES: RoleRate[] = [
  { name: "Account Management - (Senior Account Director)", rate: 365 },
  { name: "Account Management - (Account Director)", rate: 295 },
  { name: "Account Management - (Account Manager)", rate: 180 },
  { name: "Account Management (Off)", rate: 120 },
  { name: "Account Management - (Senior Account Manager)", rate: 210 },

  { name: "Project Management - (Account Director)", rate: 295 },
  { name: "Project Management - (Account Manager)", rate: 180 },
  { name: "Project Management - (Senior Account Manager)", rate: 210 },

  { name: "Tech - Delivery - Project Coordination", rate: 110 },
  { name: "Tech - Delivery - Project Management", rate: 150 },

  { name: "Tech - Head Of - Customer Experience Strategy", rate: 365 },
  { name: "Tech - Head Of - Program Strategy", rate: 365 },
  { name: "Tech - Head Of - Senior Project Management", rate: 365 },
  { name: "Tech - Head Of - System Setup", rate: 365 },

  { name: "Tech - Integrations", rate: 170 },
  { name: "Tech - Integrations (Srn MAP)", rate: 295 },
  { name: "Tech - Keyword Research", rate: 120 },
  { name: "Tech - Landing Page - (Offshore)", rate: 120 },
  { name: "Tech - Landing Page - (Onshore)", rate: 210 },

  { name: "Tech - Producer - Admin Configuration", rate: 120 },
  { name: "Tech - Producer - Campaign Build", rate: 120 },
  { name: "Tech - Producer - Chat Bot / Live Chat", rate: 120 },
  { name: "Tech - Producer - Copywriting", rate: 120 },
  { name: "Tech - Producer - Deployment", rate: 120 },
  { name: "Tech - Producer - Design", rate: 120 },
  { name: "Tech - Producer - Development", rate: 120 },
  { name: "Tech - Producer - Documentation Setup", rate: 120 },
  { name: "Tech - Producer - Email Production", rate: 120 },
  { name: "Tech - Producer - Field / Property Setup", rate: 120 },
  { name: "Tech - Producer - Integration Assistance", rate: 120 },
  { name: "Tech - Producer - Landing Page Production", rate: 120 },
  { name: "Tech - Producer - Lead Scoring Setup", rate: 120 },
  { name: "Tech - Producer - Reporting", rate: 120 },
  { name: "Tech - Producer - Services", rate: 120 },
  { name: "Tech - Producer - SMS Setup", rate: 120 },
  { name: "Tech - Producer - Support & Monitoring", rate: 120 },
  { name: "Tech - Producer - Testing", rate: 120 },
  { name: "Tech - Producer - Training", rate: 120 },
  { name: "Tech - Producer - Web Development", rate: 120 },
  { name: "Tech - Producer - Workflows", rate: 120 },

  { name: "Tech - SEO Producer", rate: 120 },
  { name: "Tech - SEO Strategy", rate: 180 },

  { name: "Tech - Specialist - Admin Configuration", rate: 180 },
  { name: "Tech - Specialist - Campaign Optimisation", rate: 180 },
  { name: "Tech - Specialist - Campaign Orchestration", rate: 180 },
  { name: "Tech - Specialist - Database Management", rate: 180 },
  { name: "Tech - Specialist - Email Production", rate: 180 },
  { name: "Tech - Specialist - Integration Configuration", rate: 180 },
  { name: "Tech - Specialist - Integration Services", rate: 190 },
  { name: "Tech - Specialist - Lead Scoring Setup", rate: 180 },
  { name: "Tech - Specialist - Program Management", rate: 180 },
  { name: "Tech - Specialist - Reporting", rate: 180 },
  { name: "Tech - Specialist - Services", rate: 180 },
  { name: "Tech - Specialist - Testing", rate: 180 },
  { name: "Tech - Specialist - Training", rate: 180 },
  { name: "Tech - Specialist - Workflows", rate: 180 },

  { name: "Tech - Sr. Architect - Approval & Testing", rate: 365 },
  { name: "Tech - Sr. Architect - Consultancy Services", rate: 365 },
  { name: "Tech - Sr. Architect - Data Strategy", rate: 365 },
  { name: "Tech - Sr. Architect - Integration Strategy", rate: 365 },

  { name: "Tech - Sr. Consultant - Admin Configuration", rate: 295 },
  { name: "Tech - Sr. Consultant - Advisory & Consultation", rate: 295 },
  { name: "Tech - Sr. Consultant - Approval & Testing", rate: 295 },
  { name: "Tech - Sr. Consultant - Campaign Optimisation", rate: 295 },
  { name: "Tech - Sr. Consultant - Campaign Strategy", rate: 295 },
  { name: "Tech - Sr. Consultant - Database Management", rate: 295 },
  { name: "Tech - Sr. Consultant - Reporting", rate: 295 },
  { name: "Tech - Sr. Consultant - Services", rate: 295 },
  { name: "Tech - Sr. Consultant - Strategy", rate: 295 },
  { name: "Tech - Sr. Consultant - Training", rate: 295 },

  { name: "Tech - Website Optimisation", rate: 120 },

  { name: "Content - Campaign Strategy (Onshore)", rate: 180 },
  { name: "Content - Keyword Research (Offshore)", rate: 120 },
  { name: "Content - Keyword Research (Onshore)", rate: 150 },
  { name: "Content - Optimisation (Onshore)", rate: 150 },
  { name: "Content - Reporting (Offshore)", rate: 120 },
  { name: "Content - Reporting (Onshore)", rate: 150 },
  { name: "Content - SEO Copywriting (Onshore)", rate: 150 },
  { name: "Content - SEO Strategy (Onshore)", rate: 210 },
  { name: "Content - Website Optimisations (Offshore)", rate: 120 },

  { name: "Copywriting (Offshore)", rate: 120 },
  { name: "Copywriting (Onshore)", rate: 180 },

  { name: "Design - Digital Asset (Offshore)", rate: 140 },
  { name: "Design - Digital Asset (Onshore)", rate: 190 },
  { name: "Design - Email (Offshore)", rate: 120 },
  { name: "Design - Email (Onshore)", rate: 295 },
  { name: "Design - Landing Page (Onshore)", rate: 190 },
  { name: "Design - Landing page (Offshore)", rate: 120 },

  { name: "Dev (orTech) - Landing Page - (Offshore)", rate: 120 },
  { name: "Dev (orTech) - Landing Page - (Onshore)", rate: 210 },
];

export const RATE_CARD_MAP: Record<string, number> = Object.fromEntries(
  ROLES.map(r => [r.name, r.rate])
);

export const getRateForRole = (name: string): number => RATE_CARD_MAP[name] ?? 0;
