import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('Starting global setup - waiting for services...');
  
  const baseURL = process.env.E2E_BASE_URL || config.projects[0].use.baseURL;
  console.log(`Testing connectivity to: ${baseURL}`);
  
  // Launch browser for connectivity testing
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  let retries = 30;
  let lastError: any;
  
  while (retries > 0) {
    try {
      console.log(`Attempt ${31 - retries}: Checking if frontend is ready...`);
      
      // Try to reach the frontend and wait for config.json
      const response = await page.goto(baseURL || '', { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      if (response && response.ok()) {
        // Also check if config.json is accessible (confirms backend connectivity)
        try {
          const configResponse = await page.request.get(`${baseURL}/config.json`);
          if (configResponse.ok()) {
            console.log('✅ Services are ready!');
            break;
          } else {
            throw new Error(`Config endpoint not ready: ${configResponse.status()}`);
          }
        } catch (configError) {
          throw new Error(`Config check failed: ${configError}`);
        }
      } else {
        throw new Error(`Frontend not ready: ${response?.status()}`);
      }
    } catch (error) {
      lastError = error;
      console.log(`❌ Attempt ${31 - retries} failed: ${error}`);
      retries--;
      
      if (retries > 0) {
        console.log(`Waiting 3 seconds before retry... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  
  await browser.close();
  
  if (retries === 0) {
    console.error('💥 Services failed to become ready within timeout period');
    throw new Error(`Services not ready after 30 attempts. Last error: ${lastError}`);
  }
  
  console.log('🚀 Global setup completed successfully');
}

export default globalSetup;
