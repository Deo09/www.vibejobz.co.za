const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function scrapeRealLearnerships() {
  console.log('Starting live scraper for South African learnerships...');
  const targetUrl = 'https://www.graduates24.com/learnerships'; 
  
  try {
    const { data } = await axios.get(targetUrl);
    const $ = cheerio.load(data);
    const jobsToInsert = [];

    $('*').each((index, element) => {
      const textContent = $(element).text() || '';
      
      if (textContent.includes('Posted:') && textContent.includes('Closes:')) {
        const titleElement = $(element).find('a, h4, h3, strong').first();
        const title = titleElement.text().trim() || 'Learnership Opportunity';
        
        let url = $(element).find('a').attr('href') || targetUrl;
        if (url.startsWith('/')) {
            url = 'https://www.graduates24.com' + url;
        }

        const dateMatch = textContent.match(/Closes:\s*(\d{1,2}\s+[a-zA-Z]{3}\s+\d{4})/i);
        let closingDate = null;
        
        if (dateMatch) {
           closingDate = new Date(`${dateMatch[1]} 23:59:59`).toISOString();
        }

        if (closingDate) {
           jobsToInsert.push({
              title: title,
              url: url,
              type: 'learnership',
              closing_date: closingDate,
              source: 'graduates24'
           });
        }
      }
    });

    if (jobsToInsert.length > 0) {
      console.log(`Found ${jobsToInsert.length} learnerships. Pushing to Supabase...`);
      const { error } = await supabase
        .from('jobs')
        .upsert(jobsToInsert, { onConflict: 'url', ignoreDuplicates: true }); 
        
      if (error) throw error;
      console.log('Successfully synced real learnerships.');
    } else {
      console.log('No new learnerships found matching the criteria.');
    }

  } catch (error) {
    console.error('Scraper failed:', error.message);
    process.exit(1); 
  }
}

scrapeRealLearnerships();