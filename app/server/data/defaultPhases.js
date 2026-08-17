'use strict';

// Default phases matching the original template
const DEFAULT_PHASES = [
  {
    position: 0, name: 'Discovery & Planning', color_class: 'p1',
    subtitle: 'Define scope, gather requirements, design architecture',
    duration: 'Weeks 1-2',
    deliverables: ['Requirements Document', 'Architecture Diagram', 'Project Timeline', 'Stakeholder Sign-off'],
    tasks: [
      { position: 0, name: 'Define project scope and objectives', priority: 'h' },
      { position: 1, name: 'Gather functional requirements from stakeholders', priority: 'h' },
      { position: 2, name: 'Identify technical stack and dependencies', priority: 'm' },
      { position: 3, name: 'Create initial architecture diagram', priority: 'm' },
      { position: 4, name: 'Estimate timeline and resource needs', priority: 'l' },
      { position: 5, name: 'Get stakeholder approval on scope', priority: 'h' }
    ]
  },
  {
    position: 1, name: 'Design & Prototyping', color_class: 'p2',
    subtitle: 'UI/UX design, database schema, API contracts',
    duration: 'Weeks 3-4',
    deliverables: ['Wireframes / Mockups', 'Database Schema', 'API Specification', 'Design Review'],
    tasks: [
      { position: 0, name: 'Create wireframes or UI mockups', priority: 'h' },
      { position: 1, name: 'Design database schema', priority: 'h' },
      { position: 2, name: 'Define API endpoints and contracts', priority: 'm' },
      { position: 3, name: 'Review design with stakeholders', priority: 'm' },
      { position: 4, name: 'Set up development environments', priority: 'l' },
      { position: 5, name: 'Create version control repo and branching strategy', priority: 'l' }
    ]
  },
  {
    position: 2, name: 'Development & Integration', color_class: 'p3',
    subtitle: 'Build core features, integrate services, write tests',
    duration: 'Weeks 5-10',
    deliverables: ['Working Application', 'Test Suite', 'Integration Points', 'Code Review Complete'],
    tasks: [
      { position: 0, name: 'Build core application features (backend)', priority: 'h' },
      { position: 1, name: 'Build front-end interface', priority: 'h' },
      { position: 2, name: 'Implement authentication and authorization', priority: 'h' },
      { position: 3, name: 'Integrate third-party APIs/services', priority: 'm' },
      { position: 4, name: 'Write unit and integration tests', priority: 'm' },
      { position: 5, name: 'Conduct internal code review', priority: 'l' },
      { position: 6, name: 'Document code and functions', priority: 'l' }
    ]
  },
  {
    position: 3, name: 'Testing, Deployment & Handoff', color_class: 'p4',
    subtitle: 'QA, staging deploy, go-live, documentation',
    duration: 'Weeks 11-12',
    deliverables: ['QA Report', 'Production Deployment', 'User Documentation', 'Post-Launch Support Plan'],
    tasks: [
      { position: 0, name: 'Perform QA and user acceptance testing (UAT)', priority: 'h' },
      { position: 1, name: 'Fix bugs identified during testing', priority: 'h' },
      { position: 2, name: 'Deploy to staging environment', priority: 'm' },
      { position: 3, name: 'Final stakeholder review and sign-off', priority: 'h' },
      { position: 4, name: 'Deploy to production', priority: 'h' },
      { position: 5, name: 'Write user and admin documentation', priority: 'm' },
      { position: 6, name: 'Schedule post-launch support check-in', priority: 'l' }
    ]
  }
];

// Minimal alternative to DEFAULT_PHASES for users who don't want the full
// four-phase methodology scaffold — one blank phase, one blank task.
const SIMPLE_PHASE = [
  {
    position: 0, name: 'Phase 1', color_class: 'p1',
    subtitle: '', duration: '',
    deliverables: [],
    tasks: [
      { position: 0, name: 'First task', priority: 'm' }
    ]
  }
];

module.exports = { DEFAULT_PHASES, SIMPLE_PHASE };
