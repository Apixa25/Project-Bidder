# ProjectXBidX — Design Principles

## 1. False confidence is much worse than no confidence

When the system lacks enough signal to make an accurate statement, it must **say nothing** rather than guess. Every number, label, and breakdown shown to users must be backed by real data or clearly marked as unverified.

Concrete rules that follow from this:

- **Never fabricate pricing.** Do not split a customer's stated budget evenly across trades and present the result as an "estimate." If there is no historical bid data or independent price research for a trade, show "Need more signal" instead of a number.
- **Never present algorithm defaults as AI insight.** If the LLM did not run (or failed), the UI must make that visible — not silently swap in template questions and call them "AI-generated."
- **Ask rather than assume.** When scope details are missing, the system should ask the customer a specific clarifying question rather than filling in an assumption and hiding it.
- **Show your work.** When the AI produces an estimate, it must show the quantities, unit prices, and sources it used so that human estimators can judge and adjust.

## 2. One unified estimate — never split by trade

The system produces **one** itemized draft per project, not one per trade. Rationale:

- Materials and quantities are the same regardless of who performs the work.
- Only the labor rate varies by contractor type.
- Showing separate "Handyman estimate" and "General Work estimate" confuses users and fabricates a false distinction.

**Labor is always priced at the highest licensed professional rate** from the internal wage sheet (`src/lib/trade-wages.ts`). This ensures the estimate sits at the top of the realistic range — actual bids can only be equal or lower.

## 3. Internal wage sheet — never search the internet

The system uses a static prevailing-wage sheet (`src/lib/trade-wages.ts`) based on California DIR union rates. This is the **single source of truth** for labor pricing.

- Updated periodically (annually) as new DIR determinations are published.
- Never call external APIs or search the web for wage data at runtime.
- The AI prompt includes the relevant rate so the LLM can factor it in.

## 4. The AI estimator's north-star

The long-term vision is:

1. The LLM breaks the project down into discrete work items with quantities.
2. Material prices come from research; labor prices come from the internal wage sheet.
3. It builds its own baseline estimate from that data.
4. Human estimators (bidders) see the AI's quantities, prices, and assumptions as a starting guide — not as gospel.
5. Over time, real bid data from the marketplace feeds back into the system so historical benchmarks replace guesswork.

Until step 5 has enough data, the system should be transparent about what it does and does not know.
