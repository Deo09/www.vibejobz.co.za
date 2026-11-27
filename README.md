# VibeJobz ZA — South African Youth & Opportunities Portal


**VibeJobz** (`vibejobz.co.za`) is a full-stack web platform and automated data pipeline built to help South African youth and matriculants discover verified job vacancies, learnerships, bursaries, and university programmes.

## Key Features
* **Automated Opportunities Scraper:** Node.js scraper scheduled via GitHub Actions to fetch, parse, and sync fresh learnerships and job listings directly into Supabase.
* **Live Filtering & Deadline Watchlist:** Real-time filtering across all 9 South African provinces and job types, plus an automated 48-hour "Closing Soon" urgency tracker.
* **Advanced South African APS Calculator:** Custom university admission point score calculator supporting Academic (NSC) and Technical streams, institution-specific counting rules, "what-if" mark sliders, and degree/diploma eligibility matching.
* **After-Matric Resource Hub:** Centralized access to verified free courses, matric past papers, and fully funded study-abroad scholarships.

## Tech Stack
* **Frontend:** HTML5, CSS3, Vanilla JavaScript
* **Backend & Automation:** Node.js (`scraper.js`), GitHub Actions (CI/CD & Scheduled Cron Jobs)
* **Database:** Supabase (PostgreSQL & REST API)

## Planned Roadmap (Active Development)
* Modularizing frontend scripts into dedicated ES modules (`js/aps-calculator.js`, `js/supabase-client.js`).
* Adding automated WhatsApp deadline alert webhooks.
* Expanding scraper coverage and deduplication logic.
