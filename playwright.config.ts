import {defineConfig,devices} from '@playwright/test';export default defineConfig({testDir:'./e2e',timeout:30000,use:{baseURL:'http://localhost:3000',trace:'retain-on-failure'},webServer:{command:'npm run dev',url:'http://localhost:3000',reuseExistingServer:true,timeout:120000},projects:[{name:'chromium',use:{...devices['Desktop Chrome'],channel:'chrome'}}]})

