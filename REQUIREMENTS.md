# Fundraising Application Requirements

## Overview

A fundraising application that allows users to create goals, track progress through milestones, and accept donations with a shareable public link.

**Important for AI Agents:**

- Always use the `--profile personal` flag for all AWS CLI and Amplify (`ampx`) commands.
- When deploying Amplify sandbox, use `npx ampx sandbox --profile personal --once` to prevent hanging indefinitely.
- Alternatively, run `npx ampx sandbox --profile personal > sandbox.log 2>&1 &` in the background and monitor `sandbox.log` for deployment progress.

## Core Features

### 1. Fundraising Goals

- Users can create fundraising goals with:
  - Goal name (e.g., "Honeymoon")
  - Target amount
  - Description
  - Multiple milestones

### 2. Milestones

- Each goal contains multiple milestones
- Milestone properties:
  - Name (e.g., "Flights", "First Class Upgrade", "Hotel on Greek Islands")
  - Target amount
  - Order/sequence
- Progress bar shows completion across all milestones
- Visual indication when milestones are reached

### 3. Public Goal Page

- Shareable URL for each goal
- Displays:
  - Goal details
  - Progress bar with milestone markers
  - Donation feed (list of donations)
  - Current amount raised vs target
  - Milestone breakdown
- Publicly accessible (no authentication required)
- **Real-time updates** via Amplify subscriptions:
  - Progress bar updates instantly when donations complete
  - New donations appear in feed without refresh
  - All viewers see updates simultaneously

### 4. Goal Management

- Edit page with password in URL path
- URL format: `/goal/{goalId}/edit/{editPassword}`
- Edit password generated when goal is created
- Only way to edit goal and milestones
- Can update:
  - Goal details
  - Milestones (add, edit, remove)
  - Target amounts

### 5. Donations

- Donation flow:
  1. User clicks "Donate" on public goal page
  2. Enters donation amount
  3. Redirected to 3rd party payment processor
  4. Payment processor handles payment collection
  5. On successful payment, webhook/callback triggers Amplify function
  6. Function creates donation record in database
- Donation record includes:
  - Amount
  - Donor name (optional/anonymous)
  - Message (optional)
  - Timestamp
  - Associated goal ID

## Technical Architecture

### Frontend Stack

**Framework:** React 18+ with TypeScript

**State Management:** TanStack Query (React Query)

- Server state management for API calls
- Automatic caching and refetching
- Optimistic updates for donations
- Real-time progress bar updates

**UI Framework:** Tailwind CSS + shadcn/ui

- Modern, accessible component library
- Customizable progress bars and forms
- Lightweight bundle size
- Copy-paste components (full code ownership)
- Built on Radix UI primitives

**User Notifications:** SweetAlert2

- Use SweetAlert2 for all alerts, confirmations, and notifications
- Never use native JavaScript `alert()`, `confirm()`, or `prompt()`
- Provides beautiful, customizable modals with consistent UX

**Architecture Patterns:**

- Provider/Hooks pattern for shared state
- Custom hooks for data fetching (useGoal, useDonations, etc.)
- Context providers for theme, auth state
- Component composition over inheritance

**Component Guidelines:**

- Keep components small and focused on a single responsibility
- **Maximum 200 lines of code per component file**
- Extract logic into custom hooks when components grow large
- Split complex components into smaller sub-components
- Use composition to combine simple components into complex UIs

**Key Libraries:**

- `@tanstack/react-query` - Server state management
- `@aws-amplify/ui-react` - Amplify UI components (if needed)
- `react-router-dom` - Client-side routing
- `react-hook-form` - Form handling
- `zod` - Schema validation
- `date-fns` - Date formatting
- `sweetalert2` - Beautiful alerts and modals

**Routing:**

- React Router v6+ for client-side navigation
- Routes:
  - `/` - Home/landing page (create goal form)
  - `/goal/:goalId` - Public goal page
  - `/goal/:goalId/edit/:password` - Edit goal page (password in URL path)
  - `/donate/:goalId` - Donation flow (optional, may redirect to Stripe)
  - `/success` - Post-donation success page

**Real-time Updates:**

- Use Amplify Data subscriptions for live donation updates
- Subscribe to donation creation events on goal page
- Automatically update progress bar and donation feed when new donations arrive
- No page refresh needed - updates appear instantly for all viewers

### Data Model (Amplify Data)

All data is publicly readable.

**Goal**

- id (auto-generated)
- name
- description
- targetAmount
- stripeAccountId (Stripe Connect account ID)
- editPassword (hashed)
- createdAt
- updatedAt

**Note:** `currentAmount` is calculated by summing all completed donations for the goal, not stored.

**Milestone**

- id (auto-generated)
- goalId (foreign key)
- name
- targetAmount
- order
- createdAt

**Donation**

- id (auto-generated)
- goalId (foreign key)
- amount
- donorName (optional)
- message (optional)
- paymentId (from payment processor)
- status (pending/completed/failed)
- createdAt

### Functions

**donate (Amplify Function)**

- Triggered by payment processor webhook/callback
- Validates payment confirmation
- Creates donation record
- Returns success/failure

### Payment Integration

**Decision: Stripe** ✅

Using Stripe Checkout for payment collection with webhook integration.

**Why Stripe:**

- Best developer experience with excellent documentation
- Stripe Checkout handles PCI compliance entirely
- Robust webhook system for reliable payment confirmation
- No monthly fees (2.9% + $0.30 per transaction)
- Built-in fraud protection (Radar)
- Easy testing with comprehensive test mode
- Supports cards, Apple Pay, Google Pay, ACH
- Straightforward integration with Amplify functions
- No donor account required

**Implementation:**

1. Create Stripe Checkout Session via Amplify function
2. Redirect donor to Stripe hosted payment page
3. Stripe webhook triggers donate function on successful payment
4. Function creates donation record and updates goal progress
5. Redirect donor back to goal page with success message

**Payout Solution: Stripe Connect Express** ✅

Each goal creator connects their own Stripe account for direct payouts.

**Why Stripe Connect:**

- Legal compliance - avoids money transmitter regulations
- Automatic payouts - Stripe deposits directly to creator's bank (2-7 days)
- No liability - platform never holds user funds
- Scalable - works for unlimited users
- Tax simplicity - each creator gets their own 1099 from Stripe
- Optional platform fee - can charge 1-5% if desired

**Updated Goal Creation Flow:**

1. User fills out goal details and milestones
2. Click "Connect Bank Account" → Stripe Connect onboarding (embedded)
3. User provides bank details (one-time, ~2 minutes)
4. Goal created with Stripe connected account ID
5. All donations go directly to creator's connected account
6. Stripe automatically handles payouts to their bank

## User Flows

### Create Goal Flow

1. User fills out goal creation form
2. Adds milestones with amounts
3. Clicks "Connect Bank Account"
4. Redirected to Stripe Connect Express onboarding
5. Provides bank account details and identity verification
6. Returns to app, submits goal form
7. System generates:
   - Unique goal ID
   - Edit password
   - Stores Stripe connected account ID
   - Public URL: `/goal/{goalId}`
   - Edit URL: `/goal/{goalId}/edit/{editPassword}`
8. Display both URLs to user (save edit URL!)

### Donate Flow

1. Visitor views public goal page
2. Clicks "Donate"
3. Enters amount and optional info
4. Redirected to Stripe Checkout
5. Completes payment
6. Stripe webhook triggers donate function
7. Donation record created
8. Redirected back to goal page with success message
9. **All viewers see progress bar and donation feed update in real-time via Amplify subscriptions**

### Edit Goal Flow

1. Creator visits edit URL with password
2. System validates password
3. Display edit form with current data
4. Creator updates goal/milestones
5. Saves changes
6. Redirected to public goal page

## Security Considerations

- Edit passwords should be hashed (bcrypt/argon2)
- Validate all payment webhooks with signature verification
- Rate limit donation function to prevent abuse
- Sanitize user input (goal names, descriptions, messages)
- HTTPS only for all pages

## Future Enhancements (Out of Scope for MVP)

- User accounts and goal management dashboard
- Email notifications for donations
- Social sharing buttons
- Goal categories/tags
- Search/browse goals
- Recurring donations
- Goal expiration dates
- Withdrawal/payout system
