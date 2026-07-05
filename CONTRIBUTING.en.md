# Contribution Guide

[日本語版 CONTRIBUTING はこちら](CONTRIBUTING.md)

## Core Principle

This project adopts a **plan-driven** contribution model.

```
Review plans, not code.
Sound plans are accepted; AI ensures implementation quality.
```

---

## Contribution Workflow

### 1. Include the "Trigger" at the Top of Issues / PRs

All Issues and PRs should include the context that triggered the improvement:

```markdown
## Trigger
- Original prompt/conversation: (summary or link)
- Idea source: (blog post, other project, personal insight, etc.)
- Related Issue: #XX
```

This is not about code attribution — it's for **tracking the lineage of ideas**.

### 2. Include a Plan File

PRs that involve implementation should include a plan file:

```
docs/plans/NNNN-title.md
```

Plan files should contain:

```markdown
# Plan: Title

## Motivation
Why is this change needed?

## Design
How will it be implemented? (Does it align with CLAUDE.md policies?)

## Impact Scope
Which modules/files will be affected?
```

### 3. Review Process

```
Plan quality → Human decides (Accept / Reject / Needs Discussion)
Code details → CLAUDE.md + CI ensures quality
```

- **What humans review**: Direction of the plan, architectural decisions
- **What humans don't review**: Code style, implementation details, refactoring techniques
- **What AI ensures**: CLAUDE.md compliance, adherence to restrictions, code quality

---

## Modifying CLAUDE.md

CLAUDE.md is the project's constitution. Improvement proposals are welcome, but:

1. First, explain your proposal in an Issue
2. Get owner approval before creating a PR
3. Changes to CLAUDE.md are always reviewed by humans

---

## What We Don't Do

- Line-by-line code style reviews
- Trivial debates like "this method name should be..."
- Code-only PRs without a plan (except single-line bug fix patches)
