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

Still open / next:
- [ ] >> PRIORITY << Registration + login portal (username + password, hashed — see security note)
- [ ] Polygon draw + claim flow on map, saved to `properties` table
- [ ] Spatial containment (ST_Contains) → priority notifications for property owners
- [ ] Day 15: Image upload to Supabase Storage with preview
- [ ] Remaining Days 1–10 scaffolding gaps (typed Supabase client, auth wiring, schema/types reconciliation)
- [ ] Days 16–28 (optimistic save, realtime, filters, detail modal, analytics, deploy, docs)
