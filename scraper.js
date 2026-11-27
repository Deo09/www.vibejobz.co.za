require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables.');
  process.exit(1);
}

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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 15000
      });

      const $ = cheerio.load(data);

      $('div, article, li').each((index, element) => {
        const el = $(element);
        const textContent = el.text() || '';

        if (!textContent.includes('Posted:') || !textContent.includes('Closes:') || textContent.length > 1200) {
          return;
        }

        // Skip outer wrapper elements that contain smaller child cards with their own dates
        const hasChildCard = el.find('div, article, li').toArray().some((child) => {
          const childText = $(child).text() || '';
          return childText.includes('Posted:') && childText.includes('Closes:');
        });
        if (hasChildCard) return;

        // Target job detail links specifically (avoid navigation/category links)
        const linkEl = el.find('a[href*="/learnership"], a[href*="/internship"], a[href*="/job"], h2 a, h3 a, h4 a').first();
        const fallbackLink = linkEl.length ? linkEl : el.find('a').first();
        let url = fallbackLink.attr('href');

        const titleEl = el.find('h2, h3, h4, strong').first();
        const title = (titleEl.text() || fallbackLink.text()).trim();

        if (!title || !url || url === '#' || url.endsWith('/learnerships') || url.endsWith('/internships')) {
          return;
        }

        if (url.startsWith('/')) {
          url = 'https://www.graduates24.com' + url;
        }

        const dateMatch = textContent.match(/Closes:\s*(\d{1,2}\s+[a-zA-Z]{3,9}\s+\d{4})/i);
        if (!dateMatch) return;

        const parsedDate = new Date(`${dateMatch[1]} 23:59:59`);
        if (isNaN(parsedDate.getTime()) || parsedDate < now) return;

        if (!uniqueJobsMap.has(url)) {
          uniqueJobsMap.set(url, {
            title,
            url,
            type: target.type,
            job_type: target.type,
            closing_date: parsedDate.toISOString(),
            source: 'graduates24'
          });
        }
      });
    }

    const jobsToInsert = Array.from(uniqueJobsMap.values());

    // 3. Push fresh, active listings to Supabase
    if (jobsToInsert.length > 0) {
      console.log(`Found ${jobsToInsert.length} active opportunities. Sample:`, jobsToInsert[0]);
      const { data: upsertedData, error } = await supabase
        .from('jobs')
        .upsert(jobsToInsert, { onConflict: 'url' })
        .select();

      if (error) throw error;
      console.log(`Successfully synced ${upsertedData?.length ?? jobsToInsert.length} rows to Supabase.`);
    } else {
      console.log('No active opportunities matched the parser. Check if Graduates24 changed its HTML or blocked the request.');
    }
  } catch (error) {
    console.error('Scraper failed:', error.response ? `HTTP ${error.response.status} - ${error.message}` : error.message);
    process.exit(1);
  }
}

scrapeOpportunities();

    
