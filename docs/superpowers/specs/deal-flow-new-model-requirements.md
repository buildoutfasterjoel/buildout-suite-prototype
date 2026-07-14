# Deal Flow — New Combined Model (Listings + Deals)

**Status:** First draft, for review — built from the stage-mapping conversation, not yet walked through a live build.
**Companion doc:** `deal-flow-requirements.md` documents the *current* 6-stage deal model (the as-is reference).

---

## 1. What's changing

The current product keeps **listings** (public marketing) and **deals** (pipeline + back office) as separate things. The new model **merges them into one lifecycle** with five stages:

```
Proposal → Active → Under Contract → Close        (Dead reachable from any stage)
```

The listing is no longer a separate object you manage alongside the deal — going public *is* a stage of the deal (Active).

### Crosswalk from the current model

| Current (6) | New (5) | Notes |
|---|---|---|
| Pitching | **Proposal** | Broker sets the deal up to sell a property |
| Sourcing | **Active** | Goes public as a listing; live in market |
| Evaluating | **Under Contract** | Offer accepted; **also absorbs** the Buyer + contract-date capture that used to happen entering Transacting |
| Transacting | **Close** | ⎫ merged |
| Closed | **Close** | ⎭ into one stage |
| Dead | **Dead** | Unchanged; from any stage |

The 6→5 reduction comes from collapsing **Transacting + Closed** into **Close**. Because the old Evaluating gate was empty and the buy-side capture lived at Transacting, that capture shifts forward onto **Under Contract**.

---

## 2. Stages and their gates

Same core mechanic as the current model: moving into a stage opens a gate that captures the fields recommended/required for the deal to be complete at that stage. The new model adds two things the deal-only model never had — an **approval + publish** gate, and the **listing/leads** surface.

### 2.1 Proposal — the broker sets up the deal

The starting stage. Broker creates the deal to sell a property. Expect the current create-form field set to live here: deal type, property (type/subtype/address/size), primary broker + split, economics, and the **Seller**.

### 2.2 Proposal → Active — approve & publish (NEW gate type)

This is the listing↔deal merge point and the most novel part of the model. It is **not** a plain field gate — it's a broker-owned approval that publishes the listing.

**Who:** the **broker** performs the approval themselves, after getting the seller's confirmation offline (no seller-facing step in the product — the broker attests to it).

**Gate conditions (must pass to publish):**

| Condition | Type | Notes |
|---|---|---|
| Seller has confirmed | Broker attestation | Confirmation happens offline; broker asserts it in-app |
| AI-generated documents reviewed | Broker attestation / review checkpoint | Any documents produced by AI must be confirmed reviewed by the broker before going public — a compliance checkpoint |
| Field capture (carried from current Pitching→Sourcing) | Fields | **Seller** (required), broker **Side** (Buy/Sell/Dual), listing dates (Listing Executed / Listing Expires) |

**Effect of passing:** the deal goes **Active** and its listing publishes — **every piece of marketing content that is marked to go public** becomes public. (Reuse the existing Buildout listing marketing object and its per-item "public" visibility flags — the stage transition just flips the listing live.)

### 2.3 Active — live public listing

The deal is a public listing in the market.

- **Marketing:** all items flagged public are visible.
- **Leads:** the existing **leads** subsystem attaches — contacts who inquire into the listing. (Reused as-is, not rebuilt.)
- **Tours & offers:** handled **outside** Buildout. They are not built into the deal; only their outcome is recorded (see next).

### 2.4 Active → Under Contract — record the accepted offer

Triggered when an offer (negotiated externally) is accepted.

| Field | Required | Notes |
|---|---|---|
| **Buyer** | Yes | The party whose offer was accepted — buy-side mirror of the Seller. Set here because tours/offers are external and this is where the accepted party is captured |
| Critical Dates: Contract Executed | — | |
| Critical Dates: Close Date | — | |
| Economics (Sale Price, Gross Commission % / $) | Yes | Carried/confirmed |

### 2.5 Under Contract → Close — hand off to transaction & financials

Contracts signed; invoicing and financials begin.

| Field | Required | Notes |
|---|---|---|
| Critical Dates: Close Date | Yes | |
| Economics | Yes | |

**Effect:** hands off the transaction and financial side of the deal — the back-office records (Voucher / Receivables / Broker Earnings) that the current model creates around Closed. (Exact trigger/gating TBD — see open questions.)

### 2.6 Dead — from any stage

Unchanged from the current model.

| Field | Required |
|---|---|
| Dead Reason | Yes |
| Critical Dates: Close Date | Yes |

---

## 3. New mechanics to prototype (not in the deal-only model)

1. **Approve-and-publish gate** on Proposal → Active: broker attestations (seller confirmed + AI docs reviewed) that gate the publish action. This is a stage transition that also performs a *publish*, not just a save.
2. **AI-document review checkpoint:** a compliance step that blocks going public until AI-generated documents are marked reviewed by the broker.
3. **Marketing publish flags:** "marked to go public" per marketing item; Active publishes exactly the flagged set.
4. **Leads:** existing inquiry subsystem surfaced on the Active stage.
5. **External tours/offers → Buyer capture:** offers live outside Buildout; the accepted party is recorded as the required Buyer entering Under Contract.

---

## 4. Open questions

- **AI-document review UX:** a single "I've reviewed the AI-generated documents" attestation, or a per-document reviewed checklist? And what marks a document as "AI-generated" so the system knows to require review?
- **Seller confirmation:** confirmed as broker-only attestation (no seller-facing flow) — verify there's no future need for a seller-facing confirmation.
- **Close as one stage:** does merging Transacting + Closed lose a needed "in contract, not yet closed" state, or does Under Contract already cover that so Close is purely the post-signing financial phase?
- **Publish scope:** which marketing fields carry a public/private flag today, and does anything need to become newly flaggable for this model.
- **Back-office hand-off:** does entering Close *gate* on financial records (voucher, etc.) or simply create/enable them afterward.
- **Interchangeability:** in the current model any stage can move to any stage. Does the new model keep that (e.g. can a deal go Active → Proposal to un-publish)? Un-publishing behavior on a backward move needs defining.
- **Proposal field set:** confirm the current create-form fields map onto Proposal unchanged.
