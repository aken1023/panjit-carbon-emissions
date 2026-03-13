# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

This is a Carbon Emissions Management SaaS platform (碳排計算系統) for Panjit International (強茂科技). The goal is to help enterprises manage greenhouse gas (GHG) inventory, reporting, and disclosure in a consistent, credible, and sustainable carbon management framework supporting net-zero transition.

## Parent Project Reference

The sibling project at `../pm/` is a mature Next.js project that shares the same tech stack. Refer to it for patterns, conventions, and configuration examples:
- Stack: Next.js (App Router) + React + TypeScript + Tailwind CSS v4 + shadcn/ui + Prisma + SQLite
- Pattern: Server Components + Server Actions (no REST API for mutations)
- Auth: Cookie-based session middleware

## Domain Language

- **碳盤查** — GHG inventory / carbon footprint assessment
- **溫室氣體 (GHG)** — Greenhouse gas (CO₂, CH₄, N₂O, HFCs, PFCs, SF₆, NF₃)
- **範疇一/二/三** — Scope 1 / 2 / 3 emissions
- **盤查邊界** — Inventory boundary (organizational / operational)
- **排放係數** — Emission factor
- **碳揭露** — Carbon disclosure (CDP, TCFD, GRI)
- **淨零轉型** — Net-zero transition
- **碳管理體系** — Carbon management system

## Standards & Frameworks to Support

- **ISO 14064-1** — GHG quantification & reporting at organization level
- **GHG Protocol** — Corporate standard for Scope 1/2/3
- **TCFD** — Task Force on Climate-related Financial Disclosures
- **CDP** — Carbon Disclosure Project reporting
- **GRI 305** — Emissions disclosure standard
- **CBAM** — EU Carbon Border Adjustment Mechanism
- **金管會** — Taiwan FSC climate disclosure requirements for listed companies

## UI Language

Traditional Chinese (繁體中文) for all UI text.
