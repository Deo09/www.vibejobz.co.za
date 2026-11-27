const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const TARGETS = [
  { url: 'https://www.graduates24.com/learnerships', type: 'learnership' },
  { url: 'https://www.graduates24.com/internships', type: 'internship' }
];

async function scrapeOpportunities() {
  console.log('Starting live scraper for South African learnerships & internships...');
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    // 1. Auto-delete expired records from Supabase first
    console.log('Cleaning up expired listings...');
    const { error: deleteError } = await supabase
      .from('jobs')
      .delete()
      .lt('closing_date', nowIso);

    if (deleteError) {
      console.error('Warning - could not delete expired jobs:', deleteError.message);
    } else {
      console.log('Expired listings removed.');
    }

    // 2. Scrape both learnerships and internships
    const uniqueJobsMap = new Map();

    for (const target of TARGETS) {
      console.log(`Scraping ${target.type}s from ${target.url}...`);
      const { data } = await axios.get(target.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(data);

      $('div, article, li').each((index, element) => {
        const textContent = $(element).text() || '';

        // Match individual listing cards that contain both Posted and Closes dates
        if (textContent.includes('Posted:') && textContent.includes('Closes:') && textContent.length < 1500) {
          const linkEl = $(element).find('a').first();
          const titleEl = $(element).find('h2, h3, h4, strong, a').first();
          const title = titleEl.text().trim();

          let url = linkEl.attr('href');
          if (!title || !url || url === '#') return;

          if (url.startsWith('/')) {
            url = 'https://www.graduates24.com' + url;
          }

          const dateMatch = textContent.match(/Closes:\s*(\d{1,2}\s+[a-zA-Z]{3,9}\s+\d{4})/i);
          if (!dateMatch) return;

          const parsedDate = new Date(`${dateMatch[1]} 23:59:59`);
          if (isNaN(parsedDate.getTime())) return;

          // Skip if already expired
          if (parsedDate < now) return;

          // Deduplicate by URL before upserting
          if (!uniqueJobsMap.has(url)) {
            uniqueJobsMap.set(url, {
              title: title,
              url: url,
              type: target.type,
              job_type: target.type,
              closing_date: parsedDate.toISOString(),
              source: 'graduates24'
            });
          }
        }
      });
    }

    const jobsToInsert = Array.from(uniqueJobsMap.values());

    // 3. Push fresh, active listings to Supabase
    if (jobsToInsert.length > 0) {
      console.log(`Found ${jobsToInsert.length} active opportunities. Pushing to Supabase...`);
      const { error } = await supabase
        .from('jobs')
        .upsert(jobsToInsert, { onConflict: 'url', ignoreDuplicates: true });

      if (error) throw error;
      console.log('Successfully synced active learnerships and internships.');
    } else {
      console.log('No new active opportunities found.');
    }

  } catch (error) {
    console.error('Scraper failed:', error.message);
    process.exit(1);
  }
}

scrapeOpportunities();

    
