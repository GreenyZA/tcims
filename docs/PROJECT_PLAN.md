# TCIMS — Project Implementation Plan

> Source of truth: `/home/warpuppy/Projects/SkyEye/SkyEye/src/Project Implementation Strategy.txt`
> Canonical copy kept here so it travels with the repo. Do not delete without the owner's go-ahead.

## Overview
The Community Incident Mapping System (TCIMS) — an interactive web app to manage and track
community incidents (electricity outages, crime, wildfires, floods, etc.). Users place pins on a
map with detail (photos, updates). A full analytics dashboard supports backend management,
including projected-path estimation for events like riots.

## Stack
- Frontend: Next.js (App Router) + TypeScript
- Styling: Tailwind CSS + shadcn/ui
- Map: Leaflet + React-Leaflet
- Database: Supabase (PostgreSQL + PostGIS + Auth + Storage)
- Auth: Supabase Auth
- Deploy: Vercel (frontend) + Supabase (backend)

## Phased plan (28 days)

### Project Initialization
- Day 1: Repo + `create-next-app` (TS, Tailwind, ESLint, App Router)
- Day 2: Install Leaflet, React-Leaflet, Supabase, shadcn/ui

### Supabase Project Setup
- Day 3: Supabase project; Auth with email + anonymous
- Day 4: Connect Supabase client; configure env vars

### Basic Layout & Navigation
- Day 5: Responsive layout (sidebar for categories/filters + top nav) + dark mode

### Database Schema Design
- Day 6: `incidents` table: id, type, location (PostGIS), description, photos, user_id, status, created_at
- Day 7: Enable PostGIS; basic insert test

### TypeScript Types & Data Fetching
- Day 8: TS types for schema
- Day 9: Supabase utility functions
- Day 10: Fetch + display sample incidents on a list page

### Interactive Map Core
- Day 11: Leaflet map centered on community area
- Day 12: Zoom, layers, tile provider functionality
- Day 13: Colored category pins + legend
- Day 14: Click map → form to add new incident (category dropdown, description, photo upload)
- Day 15: Image upload to Supabase Storage with preview
- Day 16: Save incidents to DB + optimistic UI
- Day 17: Subscribe to real-time changes (live updates)

### Features & History
- Day 18: Filters/search (category, date range, status)
- Day 19: Incident detail modal + history timeline
- Day 20: Privacy settings (anonymous toggle, data visibility)
- Day 21: Moderation queue (approve/reject/edit)
- Day 22: Per-incident chat/comments via Supabase realtime

### Polish, Analytics & Deployment
- Day 23: Dashboard analytics (count by type/week, heatmap)
- Day 24: Responsive + mobile testing
- Day 25: Error handling, loading states, toast notifications
- Day 26: Deploy frontend to Vercel + Supabase production config
- Day 27: Docs (README + contribution guide)
- Day 28: Final testing

### Post-Week 4 (Advanced)
- Notifications for new incidents/updates
- Advanced admin panel
- Data export
- Performance optimization

## Progress tracker
Completed in-session (not necessarily in Day order):
- [x] Map core: satellite (Esri) + street layers w/ switcher (Day 12)
- [x] Colored category pins + legend (Day 13)
- [x] Click-to-place draggable draft pin synced to form lat/lng (Day 14, form-side)
- [x] Dark-mode contrast fixes across form, legend, incident cards
- [x] Flood category added to shared category list

## Feature Stream: Land-Owner Property Claims (user-requested, PRIORITY)
Owner-driven requirement that precedes Day 15 in practice — central to the app's value.

Goal: a land owner registers, plots a polygon on the map claiming it as their property,
and any incident occurring inside that polygon gets priority in that owner's notifications.

Implied work:
- Registration / login portal (initially simple username + password).
- User identity tied to sessions (no anonymous-only mode for claimed properties).
- Polygon draw tool on the map (Leaflet draw integration).
- `properties` table: id, owner_user_id, name, geometry (PostGIS polygon), created_at.
- Spatial containment query (PostGIS `ST_Contains`) to match incidents to a property.
- Notification priority flag for incidents inside a claimed polygon.

Security note (owner-acknowledged, "beef up later"): even the simple version must NOT
store plaintext passwords. Use Postgres `pgcrypto` `crypt()` hashing (or Supabase Auth)
from day one; MFA / email verification / rate-limiting are the later hardening.

### Progress
- [x] Auth foundation: Supabase SSR clients + session middleware + register/login portal
      (username + email + password; passwords hashed by Supabase Auth, never plaintext).
- [x] Migration 0002: profiles (username) + properties (PostGIS polygon) + RLS + property_for_point() helper.
      (Applied to live DB + schema cache reloaded; verified readable via REST.)
- [x] Polygon draw + claim flow on map: custom click-to-place drawer (single-click vertices,
      double-click finishes excluding that point), "Claim a plot" UI with Accept/Clear, save to
      properties (lib/properties.ts createProperty/getMyProperties), render claimed plots as filled
      translucent green polygons. Pin placement works anywhere incl. inside a claimed plot.
- [x] Spatial containment (ST_Contains) → priority flag: migration 0003 adds is_priority + property_id
      to incidents, trigger set_incident_priority() uses property_for_point() to auto-flag incidents
      inside a claimed polygon on insert/update; priority incidents show a red ring on the map + red
      PRIORITY badge/border in the Recent Incidents list, sorted to top. VERIFIED working end-to-end.
- [x] App gated to registered users: standalone /login route + middleware route protection (unauth → /login).
- [x] Open self-registration (owner decision 2026-07-28): keep open for now, lock down later.
- [x] Pin right-click context menu (Day 15 image upload delivered here): migration 0004 adds
      incident_comments + incident_reports tables + is_poi column + append_incident_photo() RPC + RLS.
      Right-click a pin -> 4 actions: Upload image (to incident-photos bucket, shows on card),
      Leave a message (incident_comments thread), Mark as POI (is_poi + amber POI badge),
      Report for removal (incident_reports row, pin stays visible, admin reviews later).
      DB objects verified present (1/1/1). VERIFIED working end-to-end.

Outstanding:
- Lock down registration — DONE: `app_config` table (0010 migration) + signup_mode toggle in admin dashboard + AuthPortal gating.
- Admin moderation UI for incident_reports — DONE: admin role on profiles (0009) + moderation page at `/admin/reports` + middleware protection + IncidentReport/ReportActions/SignupModeToggle components.
- (Live-DB steps for 0002/0003/0004 are DONE: migrations applied + schema cache reloaded.)
