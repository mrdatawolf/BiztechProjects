'use strict';

// ── Date helpers ──────────────────────────────────────────────────────────────
function daysAgo(n)  { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0,10); }
function daysFrom(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); }

// ── Seed data ─────────────────────────────────────────────────────────────────
const DEMO_PASSWORD = 'Demo1234!';

const USERS = [
  { email: 'demo@projectplan.app',        name: 'Alex Rivera'  },
  { email: 'sarah.chen@projectplan.app',  name: 'Sarah Chen'   },
  { email: 'mike.torres@projectplan.app', name: 'Mike Torres'  },
];

// Each project defines phases; each phase lists tasks with done/expected_hours.
// doneTasks is the number of tasks (from the top) that are marked done.
const PROJECTS = [
  // ── 1. In Progress — mid-way ─────────────────────────────────────────────
  {
    title: 'E-Commerce Platform Redesign',
    description: 'Complete overhaul of the storefront and checkout experience to improve conversion rates and mobile performance.',
    client: 'Acme Retail Corp',
    status: 'In Progress',
    priority: 'high',
    due_date: daysFrom(45),
    team_size: 4,
    team_lead: 'Sarah Chen',
    links: [
      { label: 'GitHub',   url: 'https://github.com/example/ecommerce-redesign' },
      { label: 'Figma',    url: 'https://figma.com/file/ecommerce-mockups'      },
      { label: 'Staging',  url: 'https://staging.acme-retail.example.com'       },
      { label: 'Jira',     url: 'https://acme.atlassian.net/jira/projects/ECR'  },
    ],
    phases: [
      {
        name: 'Discovery & Planning', subtitle: 'Scope, requirements, and architecture sign-off.',
        status: 'Complete', duration: 'Weeks 1–2', color_class: 'p1', notes: 'Stakeholders approved scope on day 9. Architecture review complete.',
        tasks: [
          { name: 'Define project scope and objectives',              priority: 'h', expected_hours: 4,  done: true  },
          { name: 'Gather requirements from marketing and ops',       priority: 'h', expected_hours: 6,  done: true  },
          { name: 'Audit existing platform pain points',              priority: 'm', expected_hours: 8,  done: true  },
          { name: 'Choose tech stack and hosting provider',           priority: 'm', expected_hours: 3,  done: true  },
          { name: 'Estimate timeline and assign team roles',          priority: 'l', expected_hours: 2,  done: true  },
          { name: 'Stakeholder kick-off and scope sign-off',          priority: 'h', expected_hours: 2,  done: true  },
        ],
        deliverables: ['Requirements Document','Architecture Diagram','Project Timeline','Stakeholder Sign-off'],
      },
      {
        name: 'Design & Prototyping', subtitle: 'UI/UX design system, component library, and prototype approval.',
        status: 'Complete', duration: 'Weeks 3–5', color_class: 'p2', notes: 'Design system approved. Component library handed off to dev.',
        tasks: [
          { name: 'Create new design system and style guide',         priority: 'h', expected_hours: 16, done: true  },
          { name: 'Wireframe product listing and checkout flows',     priority: 'h', expected_hours: 12, done: true  },
          { name: 'High-fidelity mobile and desktop mockups',         priority: 'h', expected_hours: 20, done: true  },
          { name: 'Prototype interactive checkout in Figma',          priority: 'm', expected_hours: 8,  done: true  },
          { name: 'Design review and stakeholder approval',           priority: 'm', expected_hours: 4,  done: true  },
          { name: 'Set up component library in Storybook',            priority: 'l', expected_hours: 10, done: true  },
        ],
        deliverables: ['Design System','Wireframes / Mockups','Interactive Prototype','Design Review Sign-off'],
      },
      {
        name: 'Development & Integration', subtitle: 'Build core storefront, cart, and payment integration.',
        status: 'In Progress', duration: 'Weeks 6–12', color_class: 'p3', notes: 'Backend APIs complete. Frontend 60% done. Payment integration blocked on Stripe sandbox credentials.',
        tasks: [
          { name: 'Set up monorepo, CI/CD pipeline, and environments',priority: 'h', expected_hours: 8,  done: true  },
          { name: 'Build product catalogue and search API',            priority: 'h', expected_hours: 24, done: true  },
          { name: 'Build cart and session management',                 priority: 'h', expected_hours: 16, done: true  },
          { name: 'Implement Stripe payment integration',              priority: 'h', expected_hours: 20, done: false },
          { name: 'Build storefront product pages (frontend)',         priority: 'h', expected_hours: 24, done: false },
          { name: 'Build checkout flow (frontend)',                    priority: 'h', expected_hours: 20, done: false },
          { name: 'Implement authentication and account pages',        priority: 'm', expected_hours: 16, done: false },
          { name: 'Write unit and integration tests',                  priority: 'm', expected_hours: 12, done: false },
          { name: 'Internal code review and security audit',           priority: 'l', expected_hours: 8,  done: false },
        ],
        deliverables: ['Working Storefront','Payment Integration','Test Suite','Code Review Complete'],
      },
      {
        name: 'Testing, Launch & Handoff', subtitle: 'QA, performance testing, go-live, and documentation.',
        status: 'Not Started', duration: 'Weeks 13–14', color_class: 'p4', notes: '',
        tasks: [
          { name: 'End-to-end QA and UAT with stakeholders',          priority: 'h', expected_hours: 16, done: false },
          { name: 'Performance and load testing',                     priority: 'h', expected_hours: 8,  done: false },
          { name: 'Fix bugs from QA round',                           priority: 'h', expected_hours: 12, done: false },
          { name: 'Deploy to production and DNS cut-over',            priority: 'h', expected_hours: 4,  done: false },
          { name: 'Write admin and user documentation',               priority: 'm', expected_hours: 8,  done: false },
          { name: 'Post-launch monitoring and hotfix window',         priority: 'l', expected_hours: 6,  done: false },
        ],
        deliverables: ['QA Report','Production Deployment','User Documentation','Post-Launch Support Plan'],
      },
    ],
    timeEntries: [
      // phase 0 (Discovery)
      { phaseIdx: 0, taskIdx: 0, userIdx: 0, hours: 3.5, daysAgo: 38, note: 'Scope workshop with stakeholders' },
      { phaseIdx: 0, taskIdx: 1, userIdx: 1, hours: 5.0, daysAgo: 36, note: 'Requirements interviews' },
      { phaseIdx: 0, taskIdx: 2, userIdx: 2, hours: 7.5, daysAgo: 34, note: 'Platform audit and heuristic review' },
      // phase 1 (Design)
      { phaseIdx: 1, taskIdx: 0, userIdx: 1, hours: 8.0, daysAgo: 28, note: 'Design system tokens and type scale' },
      { phaseIdx: 1, taskIdx: 0, userIdx: 1, hours: 7.0, daysAgo: 25, note: 'Component library — cards, buttons, forms' },
      { phaseIdx: 1, taskIdx: 2, userIdx: 1, hours: 9.0, daysAgo: 22, note: 'Mobile mockups — product listing' },
      { phaseIdx: 1, taskIdx: 2, userIdx: 0, hours: 6.0, daysAgo: 20, note: 'Desktop mockups — checkout flow' },
      // phase 2 (Dev)
      { phaseIdx: 2, taskIdx: 0, userIdx: 2, hours: 7.5, daysAgo: 14, note: 'Monorepo setup and GitHub Actions' },
      { phaseIdx: 2, taskIdx: 1, userIdx: 2, hours: 8.0, daysAgo: 10, note: 'Product search API with Elasticsearch' },
      { phaseIdx: 2, taskIdx: 1, userIdx: 0, hours: 6.0, daysAgo: 8,  note: 'Catalogue CRUD and image handling' },
      { phaseIdx: 2, taskIdx: 2, userIdx: 2, hours: 5.0, daysAgo: 5,  note: 'Cart service and Redis session store' },
    ],
  },

  // ── 2. Paused — critical priority ────────────────────────────────────────
  {
    title: 'Mobile App v2.0',
    description: 'Native iOS and Android rebuild of the customer-facing app with offline support and push notifications.',
    client: 'TechStart Inc',
    status: 'In Progress',
    priority: 'critical',
    due_date: daysFrom(18),
    paused: true,
    pause_reason: 'Waiting for stakeholder sign-off on revised UX direction',
    team_size: 3,
    team_lead: 'Mike Torres',
    links: [
      { label: 'GitHub',      url: 'https://github.com/example/mobile-v2'        },
      { label: 'Figma',       url: 'https://figma.com/file/mobile-v2-designs'    },
      { label: 'App Store Connect', url: 'https://appstoreconnect.apple.com'     },
    ],
    phases: [
      {
        name: 'Discovery & Planning', subtitle: 'User research, competitive analysis, and feature prioritisation.',
        status: 'Complete', duration: 'Weeks 1–2', color_class: 'p1', notes: 'Research complete. Feature list finalised and approved.',
        tasks: [
          { name: 'User research and interview sessions',              priority: 'h', expected_hours: 12, done: true  },
          { name: 'Competitive analysis of top 5 apps',               priority: 'h', expected_hours: 6,  done: true  },
          { name: 'Define MVP feature list and backlog',              priority: 'h', expected_hours: 4,  done: true  },
          { name: 'Technical architecture and offline-first strategy', priority: 'm', expected_hours: 8,  done: true  },
          { name: 'Set up React Native monorepo',                     priority: 'l', expected_hours: 4,  done: true  },
          { name: 'Sprint planning and team kick-off',                priority: 'l', expected_hours: 2,  done: true  },
        ],
        deliverables: ['User Research Report','Feature Backlog','Architecture Document'],
      },
      {
        name: 'Design & Prototyping', subtitle: 'iOS/Android design system, user flows, and interactive prototype.',
        status: 'In Progress', duration: 'Weeks 3–5', color_class: 'p2', notes: 'Core screens designed. Awaiting stakeholder review on revised onboarding flow — this is the current blocker.',
        tasks: [
          { name: 'Design iOS and Android style guide',               priority: 'h', expected_hours: 10, done: true  },
          { name: 'Map out all user flows and navigation',            priority: 'h', expected_hours: 6,  done: true  },
          { name: 'Design onboarding and auth screens',               priority: 'h', expected_hours: 8,  done: true  },
          { name: 'Design home, feed, and profile screens',           priority: 'h', expected_hours: 16, done: false },
          { name: 'Create interactive prototype for UAT',             priority: 'm', expected_hours: 8,  done: false },
          { name: 'Stakeholder design review and sign-off',           priority: 'h', expected_hours: 3,  done: false },
        ],
        deliverables: ['Mobile Style Guide','User Flow Diagrams','Interactive Prototype'],
      },
      {
        name: 'Development & Integration', subtitle: 'Core app build, offline sync, and third-party integrations.',
        status: 'Not Started', duration: 'Weeks 6–11', color_class: 'p3', notes: '',
        tasks: [
          { name: 'Implement navigation and shell components',        priority: 'h', expected_hours: 12, done: false },
          { name: 'Build auth screens and session management',        priority: 'h', expected_hours: 10, done: false },
          { name: 'Implement offline data sync with SQLite',          priority: 'h', expected_hours: 24, done: false },
          { name: 'Build core feature screens',                       priority: 'h', expected_hours: 40, done: false },
          { name: 'Push notification integration',                   priority: 'm', expected_hours: 8,  done: false },
          { name: 'Analytics and crash reporting setup',              priority: 'l', expected_hours: 4,  done: false },
        ],
        deliverables: ['Working App Build','Offline Sync','Test Coverage Report'],
      },
      {
        name: 'Testing, Submission & Handoff', subtitle: 'QA, App Store / Play Store submission, and launch.',
        status: 'Not Started', duration: 'Weeks 12–13', color_class: 'p4', notes: '',
        tasks: [
          { name: 'Device testing matrix (iOS + Android)',            priority: 'h', expected_hours: 16, done: false },
          { name: 'Fix bugs from QA',                                 priority: 'h', expected_hours: 10, done: false },
          { name: 'App Store and Play Store submission',              priority: 'h', expected_hours: 4,  done: false },
          { name: 'Write user-facing help documentation',             priority: 'm', expected_hours: 6,  done: false },
          { name: 'Launch comms and internal training',               priority: 'l', expected_hours: 3,  done: false },
        ],
        deliverables: ['QA Report','App Store Listings','User Guide'],
      },
    ],
    timeEntries: [
      { phaseIdx: 0, taskIdx: 0, userIdx: 2, hours: 6.0, daysAgo: 25, note: 'User interviews — batch 1' },
      { phaseIdx: 0, taskIdx: 0, userIdx: 1, hours: 5.5, daysAgo: 23, note: 'User interviews — batch 2' },
      { phaseIdx: 0, taskIdx: 1, userIdx: 0, hours: 5.0, daysAgo: 20, note: 'Competitive analysis write-up' },
      { phaseIdx: 1, taskIdx: 0, userIdx: 1, hours: 9.0, daysAgo: 15, note: 'iOS design tokens and typography' },
      { phaseIdx: 1, taskIdx: 2, userIdx: 1, hours: 7.5, daysAgo: 10, note: 'Onboarding flow — v1 screens' },
      { phaseIdx: 1, taskIdx: 2, userIdx: 1, hours: 4.0, daysAgo: 7,  note: 'Onboarding revisions after internal review' },
    ],
  },

  // ── 3. Complete ───────────────────────────────────────────────────────────
  {
    title: 'Internal HR Portal',
    description: 'Self-service HR portal for employees to manage leave requests, payslips, and benefits enrolment.',
    client: 'Internal — People & Culture',
    status: 'Complete',
    priority: 'medium',
    due_date: daysAgo(5),
    team_size: 2,
    team_lead: 'Sarah Chen',
    links: [
      { label: 'GitHub',      url: 'https://github.com/example/hr-portal'   },
      { label: 'Production',  url: 'https://hr.internal.example.com'        },
      { label: 'Confluence',  url: 'https://confluence.example.com/hr-docs' },
    ],
    phases: [
      {
        name: 'Discovery & Planning', subtitle: 'HR requirements, compliance review, and data privacy sign-off.',
        status: 'Complete', duration: 'Weeks 1–2', color_class: 'p1', notes: 'GDPR and local compliance requirements reviewed with legal.',
        tasks: [
          { name: 'Requirements workshops with HR team',              priority: 'h', expected_hours: 6,  done: true  },
          { name: 'Data privacy and compliance review with legal',    priority: 'h', expected_hours: 4,  done: true  },
          { name: 'Map existing manual processes to automate',        priority: 'm', expected_hours: 5,  done: true  },
          { name: 'Technical stack selection',                        priority: 'm', expected_hours: 2,  done: true  },
          { name: 'Timeline and milestone sign-off',                  priority: 'l', expected_hours: 1,  done: true  },
        ],
        deliverables: ['Requirements Document','Compliance Sign-off','Project Timeline'],
      },
      {
        name: 'Design & Prototyping', subtitle: 'Portal UI aligned with company brand guidelines.',
        status: 'Complete', duration: 'Weeks 3–4', color_class: 'p2', notes: 'Design approved by HR director on first review.',
        tasks: [
          { name: 'Design portal layout and navigation',              priority: 'h', expected_hours: 8,  done: true  },
          { name: 'Leave request and approval flow wireframes',       priority: 'h', expected_hours: 6,  done: true  },
          { name: 'Benefits enrolment flow',                         priority: 'm', expected_hours: 6,  done: true  },
          { name: 'Design review and approval',                       priority: 'm', expected_hours: 2,  done: true  },
          { name: 'Set up development environment and repo',          priority: 'l', expected_hours: 3,  done: true  },
        ],
        deliverables: ['Wireframes','Design Review'],
      },
      {
        name: 'Development & Integration', subtitle: 'Portal build, HRIS integration, and payslip generation.',
        status: 'Complete', duration: 'Weeks 5–10', color_class: 'p3', notes: 'HRIS integration took longer than expected due to legacy API limitations.',
        tasks: [
          { name: 'Employee authentication via SSO',                  priority: 'h', expected_hours: 8,  done: true  },
          { name: 'Leave request and approval workflow',              priority: 'h', expected_hours: 16, done: true  },
          { name: 'HRIS system integration (BambooHR)',               priority: 'h', expected_hours: 24, done: true  },
          { name: 'Payslip PDF generation and storage',               priority: 'm', expected_hours: 12, done: true  },
          { name: 'Benefits enrolment module',                        priority: 'm', expected_hours: 14, done: true  },
          { name: 'Email notification system',                        priority: 'l', expected_hours: 6,  done: true  },
          { name: 'Unit and integration tests',                       priority: 'l', expected_hours: 10, done: true  },
        ],
        deliverables: ['Working Portal','HRIS Integration','Test Suite'],
      },
      {
        name: 'Testing, Deployment & Handoff', subtitle: 'UAT with HR team, production deployment, and training.',
        status: 'Complete', duration: 'Weeks 11–12', color_class: 'p4', notes: 'Launched on time. HR team trained. Received positive feedback from employees.',
        tasks: [
          { name: 'UAT sessions with HR team',                        priority: 'h', expected_hours: 8,  done: true  },
          { name: 'Bug fixes from UAT',                               priority: 'h', expected_hours: 6,  done: true  },
          { name: 'Production deployment and data migration',         priority: 'h', expected_hours: 4,  done: true  },
          { name: 'Employee training sessions (3 cohorts)',           priority: 'm', expected_hours: 6,  done: true  },
          { name: 'Admin and user documentation',                     priority: 'm', expected_hours: 8,  done: true  },
          { name: 'Post-launch support and bug triage',               priority: 'l', expected_hours: 4,  done: true  },
        ],
        deliverables: ['QA Report','Production Deployment','Training Materials','User Documentation'],
      },
    ],
    timeEntries: [
      { phaseIdx: 0, taskIdx: 0, userIdx: 0, hours: 5.5, daysAgo: 75, note: 'HR requirements workshops' },
      { phaseIdx: 1, taskIdx: 0, userIdx: 1, hours: 7.0, daysAgo: 65, note: 'Portal layout design' },
      { phaseIdx: 2, taskIdx: 0, userIdx: 0, hours: 7.5, daysAgo: 50, note: 'SSO implementation with Azure AD' },
      { phaseIdx: 2, taskIdx: 1, userIdx: 0, hours: 8.0, daysAgo: 45, note: 'Leave workflow — manager approval flow' },
      { phaseIdx: 2, taskIdx: 2, userIdx: 0, hours: 8.0, daysAgo: 40, note: 'BambooHR API integration — day 1' },
      { phaseIdx: 2, taskIdx: 2, userIdx: 2, hours: 7.5, daysAgo: 38, note: 'BambooHR API integration — day 2' },
      { phaseIdx: 2, taskIdx: 3, userIdx: 2, hours: 6.0, daysAgo: 32, note: 'Payslip PDF with WeasyPrint' },
      { phaseIdx: 3, taskIdx: 0, userIdx: 1, hours: 4.0, daysAgo: 18, note: 'UAT session 1 — leave flows' },
      { phaseIdx: 3, taskIdx: 0, userIdx: 1, hours: 3.5, daysAgo: 15, note: 'UAT session 2 — payslips and benefits' },
      { phaseIdx: 3, taskIdx: 2, userIdx: 0, hours: 4.0, daysAgo: 10, note: 'Production deployment and smoke tests' },
    ],
  },

  // ── 4. New — just kicked off ──────────────────────────────────────────────
  {
    title: 'API Integration Suite',
    description: 'Build a unified integration layer connecting CRM, ERP, and third-party logistics providers via a central API gateway.',
    client: 'DataFlow Systems',
    status: 'New',
    priority: 'low',
    due_date: daysFrom(90),
    team_size: 3,
    team_lead: 'Alex Rivera',
    links: [
      { label: 'GitHub', url: 'https://github.com/example/api-suite' },
      { label: 'Notion', url: 'https://notion.so/api-suite-brief'    },
    ],
    phases: [
      {
        name: 'Discovery & Planning', subtitle: 'Map all integration endpoints, data formats, and auth requirements.',
        status: 'In Progress', duration: 'Weeks 1–3', color_class: 'p1', notes: 'Started initial discovery calls with DataFlow engineering team.',
        tasks: [
          { name: 'Map all source systems and integration points',     priority: 'h', expected_hours: 8,  done: true  },
          { name: 'Document CRM API capabilities and rate limits',     priority: 'h', expected_hours: 4,  done: false },
          { name: 'Document ERP data model and export formats',        priority: 'h', expected_hours: 4,  done: false },
          { name: 'Define error handling and retry strategy',          priority: 'm', expected_hours: 3,  done: false },
          { name: 'Estimate effort and risk assessment',               priority: 'm', expected_hours: 4,  done: false },
          { name: 'Architecture sign-off',                            priority: 'h', expected_hours: 2,  done: false },
        ],
        deliverables: ['Integration Map','API Contracts','Risk Register'],
      },
      {
        name: 'Design & Prototyping', subtitle: 'Gateway design, schema mapping, and proof-of-concept.',
        status: 'Not Started', duration: 'Weeks 4–5', color_class: 'p2', notes: '',
        tasks: [
          { name: 'Design API gateway schema and routing',            priority: 'h', expected_hours: 8,  done: false },
          { name: 'Build proof-of-concept CRM → ERP sync',           priority: 'h', expected_hours: 12, done: false },
          { name: 'Design event queue and async processing',          priority: 'm', expected_hours: 6,  done: false },
          { name: 'Internal design review',                           priority: 'm', expected_hours: 2,  done: false },
        ],
        deliverables: ['Gateway Design','PoC Demonstration'],
      },
      {
        name: 'Development & Integration', subtitle: 'Build, test, and harden all integration adapters.',
        status: 'Not Started', duration: 'Weeks 6–12', color_class: 'p3', notes: '',
        tasks: [
          { name: 'Build CRM adapter',                                priority: 'h', expected_hours: 24, done: false },
          { name: 'Build ERP adapter',                                priority: 'h', expected_hours: 24, done: false },
          { name: 'Build logistics provider adapter',                 priority: 'h', expected_hours: 20, done: false },
          { name: 'Implement central event bus',                      priority: 'h', expected_hours: 16, done: false },
          { name: 'Monitoring, alerting, and dead-letter queues',     priority: 'm', expected_hours: 10, done: false },
          { name: 'Integration and load tests',                       priority: 'm', expected_hours: 12, done: false },
        ],
        deliverables: ['Integration Adapters','Event Bus','Test Suite'],
      },
      {
        name: 'Testing, Deployment & Handoff', subtitle: 'End-to-end testing, staging, and production roll-out.',
        status: 'Not Started', duration: 'Weeks 13–14', color_class: 'p4', notes: '',
        tasks: [
          { name: 'End-to-end testing in staging',                    priority: 'h', expected_hours: 12, done: false },
          { name: 'Performance and failover testing',                 priority: 'h', expected_hours: 8,  done: false },
          { name: 'Production deployment',                            priority: 'h', expected_hours: 4,  done: false },
          { name: 'Runbook and ops documentation',                    priority: 'm', expected_hours: 6,  done: false },
        ],
        deliverables: ['QA Report','Runbook','Production Deployment'],
      },
    ],
    timeEntries: [
      { phaseIdx: 0, taskIdx: 0, userIdx: 0, hours: 3.0, daysAgo: 3, note: 'Discovery call with DataFlow engineering' },
    ],
  },

  // ── 5. In Progress — early stage ─────────────────────────────────────────
  {
    title: 'Customer Analytics Dashboard',
    description: 'Real-time analytics dashboard giving the sales and ops teams visibility into customer behaviour, churn risk, and revenue trends.',
    client: 'Insight Partners',
    status: 'In Progress',
    priority: 'high',
    due_date: daysFrom(55),
    team_size: 3,
    team_lead: 'Mike Torres',
    links: [
      { label: 'GitHub',       url: 'https://github.com/example/analytics-dash'    },
      { label: 'Figma',        url: 'https://figma.com/file/analytics-wireframes'  },
      { label: 'Data Catalog', url: 'https://datahub.insight-partners.example.com' },
    ],
    phases: [
      {
        name: 'Discovery & Planning', subtitle: 'KPI definition, data source audit, and warehouse readiness assessment.',
        status: 'Complete', duration: 'Weeks 1–2', color_class: 'p1', notes: 'Three data sources confirmed. Warehouse team will provide read-only credentials by week 3.',
        tasks: [
          { name: 'Define key metrics with sales and ops leads',       priority: 'h', expected_hours: 6,  done: true  },
          { name: 'Audit available data sources and quality',          priority: 'h', expected_hours: 8,  done: true  },
          { name: 'Assess data warehouse readiness',                   priority: 'h', expected_hours: 4,  done: true  },
          { name: 'Choose visualisation framework',                    priority: 'm', expected_hours: 2,  done: true  },
          { name: 'Estimate timeline and resource plan',               priority: 'l', expected_hours: 2,  done: true  },
          { name: 'Stakeholder alignment and sign-off',                priority: 'h', expected_hours: 2,  done: true  },
        ],
        deliverables: ['KPI Framework','Data Source Map','Project Timeline'],
      },
      {
        name: 'Design & Prototyping', subtitle: 'Dashboard layouts, chart types, and interactive mockups.',
        status: 'In Progress', duration: 'Weeks 3–4', color_class: 'p2', notes: 'Overview and revenue dashboards complete. Churn risk screen in review.',
        tasks: [
          { name: 'Design information architecture and nav',           priority: 'h', expected_hours: 6,  done: true  },
          { name: 'Wireframe overview and revenue dashboards',         priority: 'h', expected_hours: 10, done: true  },
          { name: 'Wireframe churn risk and cohort screens',           priority: 'h', expected_hours: 10, done: false },
          { name: 'High-fidelity mockups and component set',           priority: 'm', expected_hours: 12, done: false },
          { name: 'Prototype review with sales team',                  priority: 'm', expected_hours: 3,  done: false },
          { name: 'Set up dev environment and data pipeline skeleton', priority: 'l', expected_hours: 4,  done: false },
        ],
        deliverables: ['Dashboard Wireframes','Component Set','Prototype Review'],
      },
      {
        name: 'Development & Integration', subtitle: 'Data pipelines, chart components, and real-time refresh.',
        status: 'Not Started', duration: 'Weeks 5–10', color_class: 'p3', notes: '',
        tasks: [
          { name: 'Build ETL pipeline for customer events',            priority: 'h', expected_hours: 20, done: false },
          { name: 'Build revenue and ARR trend charts',                priority: 'h', expected_hours: 16, done: false },
          { name: 'Build churn risk model and scoring',                priority: 'h', expected_hours: 24, done: false },
          { name: 'Implement real-time refresh with WebSockets',       priority: 'm', expected_hours: 12, done: false },
          { name: 'Role-based access control',                         priority: 'm', expected_hours: 8,  done: false },
          { name: 'Test suite and data accuracy validation',           priority: 'l', expected_hours: 10, done: false },
        ],
        deliverables: ['Data Pipelines','Dashboard Application','Test Coverage'],
      },
      {
        name: 'Testing, Launch & Handoff', subtitle: 'UAT, performance benchmarking, and handoff training.',
        status: 'Not Started', duration: 'Weeks 11–12', color_class: 'p4', notes: '',
        tasks: [
          { name: 'UAT with sales and ops teams',                      priority: 'h', expected_hours: 8,  done: false },
          { name: 'Performance benchmarking under load',               priority: 'h', expected_hours: 6,  done: false },
          { name: 'Fix issues from UAT',                               priority: 'h', expected_hours: 8,  done: false },
          { name: 'Production deployment',                             priority: 'h', expected_hours: 3,  done: false },
          { name: 'Dashboard user guide and training session',         priority: 'm', expected_hours: 6,  done: false },
        ],
        deliverables: ['UAT Report','Production Deployment','User Guide'],
      },
    ],
    timeEntries: [
      { phaseIdx: 0, taskIdx: 0, userIdx: 2, hours: 5.0, daysAgo: 20, note: 'KPI workshop with sales team' },
      { phaseIdx: 0, taskIdx: 1, userIdx: 0, hours: 7.0, daysAgo: 17, note: 'Data source audit — Salesforce and Stripe' },
      { phaseIdx: 0, taskIdx: 2, userIdx: 0, hours: 3.5, daysAgo: 14, note: 'Warehouse readiness call with data team' },
      { phaseIdx: 1, taskIdx: 0, userIdx: 1, hours: 5.5, daysAgo: 9,  note: 'IA and nav design — v1' },
      { phaseIdx: 1, taskIdx: 1, userIdx: 1, hours: 8.0, daysAgo: 6,  note: 'Revenue dashboard wireframes' },
    ],
  },
];

module.exports = { daysAgo, daysFrom, DEMO_PASSWORD, USERS, PROJECTS };
