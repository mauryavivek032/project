# Waste2Power — Hackathon Pitch & Demo Checklist

## One-line pitch
Waste2Power helps people decide what to do with a waste item, record sorted waste, understand the limits of resale/energy estimates, and discover relevant local recycling searches in one place.

## The problem
People often do not know how to sort waste, whether an item can be repaired or recycled, where to look for a handler, or whether a quoted resale value is reliable. That uncertainty can lead to mixed disposal and missed reuse opportunities.

## What the prototype demonstrates
1. **Waste logging:** photo preview, category selection, weight entry, disposal guidance and a persistent local log.
2. **AI-assisted category suggestion:** optional Gemini integration; user confirms the suggested category. It is not a validated waste classifier.
3. **Panipat discovery:** embedded Google Maps search filters for recyclers, scrap dealers, e-waste and plastic recyclers, plus open-in-Google-Maps links.
4. **Repair/reuse guidance:** prompts users to consider repair and safe reuse before disposal.
5. **Impact dashboard:** transparent illustrative estimates based on entered weights and documented assumptions.
6. **Marketplace concept:** sample listings and local-browser listing flow to demonstrate the proposed experience.
7. **Safety and transparency:** estimates are labelled as estimates; sample bin levels, local storage and demo sign-in are explicitly disclosed.

## 2-minute live demo
- 0:00–0:15 — State the problem and show the dashboard.
- 0:15–0:45 — Scan/log one item, for example a clean plastic bottle; explain that the user confirms the category and enters the weight.
- 0:45–1:05 — Show the saved waste log and how the dashboard changes.
- 1:05–1:25 — Open the Panipat map, switch to e-waste or scrap search, and open the results in Google Maps.
- 1:25–1:45 — Show repair/reuse and safe e-waste advice.
- 1:45–2:00 — State what is real today and the next validated build step: backend, verified recycler onboarding and measured impact data.

## What not to claim
- Do not say the app has a trained/validated AI classifier; AI detection is optional and requires a configured API key.
- Do not call the sign-in secure authentication; it is a local demo sign-in.
- Do not claim marketplace listings are public or shared; they are saved in this browser.
- Do not present estimated material value or energy potential as a guaranteed price, measured saving or guaranteed electricity generation.
- Do not call sample bin fill levels live IoT data or the route a live optimized route.
- Google Maps provides search results; the app does not own/verify every listing or guarantee a business accepts household waste.

## Before presenting
- [ ] Test the app in the actual browser and on the presentation laptop.
- [ ] Test sign-in, navigation, photo preview, add/delete waste entry and dashboard updates.
- [ ] Test Google Maps filters and “Open in Google Maps” on the event Wi-Fi/mobile hotspot.
- [ ] If using Gemini, test with the configured key and check quota/connectivity; otherwise present manual category selection.
- [ ] Use a prepared sample photo and known weight; avoid relying on live network calls as the only demo path.
- [ ] Explain prototype limitations confidently rather than overstating functionality.
- [ ] Keep the demo under two minutes and rehearse once with a timer.

## Next engineering milestones
1. Add backend authentication and a shared database with access controls.
2. Add verified recycler profiles, consent-based listings and moderation.
3. Add a backend proxy for AI calls; never expose a production API key in client-side code.
4. Evaluate image classification on a labelled dataset and show confidence/uncertainty.
5. Replace illustrative impact coefficients with traceable, locally relevant data.
6. Add consent-based location use and real collection routing only after a reliable data source exists.
