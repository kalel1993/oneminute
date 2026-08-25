import {test,expect} from '@playwright/test';

test('landing starts Button Rush without a signup or name gate',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/how fast/i})).toBeVisible();
  await page.getByRole('link',{name:/play/i}).first().click();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.getByRole('button',{name:/start 60 seconds/i}).click();
  await expect(page.getByText('3',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Hit target'})).toBeVisible({timeout:5000});
});

test('leaderboard tells the truth when empty',async({page})=>{
  await page.goto('/leaderboard');
  await expect(page.getByText(/board is wide open|loading the pace/i)).toBeVisible();
  await expect(page.getByRole('button',{name:'ALL TIME'})).toBeVisible();
  await expect(page.getByText(/best verified score per player/i)).toBeVisible();
});

test('unknown challenge has a resilient landing',async({page})=>{
  await page.goto('/c/not-real');
  await expect(page.getByRole('heading',{name:/rankings offline/i})).toBeVisible();
});

test('account route does not fall into the game error screen when auth is unavailable',async({page})=>{
  await page.goto('/account');
  await expect(page.getByRole('heading',{name:'ACCOUNT'})).toBeVisible();
  await expect(page.getByText(/login is being connected/i)).toBeVisible();
  await expect(page.getByText(/that missed|one bad second/i)).toHaveCount(0);
});

test('launch legal pages are reachable',async({page})=>{
  for(const path of ['/privacy','/terms','/refunds']){
    await page.goto(path);
    await expect(page.locator('article.legalPage')).toBeVisible();
  }
});
