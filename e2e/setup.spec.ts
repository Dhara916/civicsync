import {test, expect} from '@playwright/test';
// These tests use the real unconfigured application. No API interception,
// mock records, hardcoded counters or simulated form success is involved.
test('missing configuration shows a truthful setup state without application errors', async ({page}) => {
  const errors:string[]=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'No backend, no invented data'})).toBeVisible();
  await expect(page.getByText('Merge Person 2’s backend', {exact:true})).toBeVisible();
  await expect(page.locator('main')).not.toContainText('NaN');
  expect(errors).toEqual([]);
});
test('a deep project route does not fabricate a record without a backend', async ({page}) => {
  await page.goto('/projects/70000000-0000-4000-8000-000000000001');
  await expect(page.getByRole('heading', {name:'No backend, no invented data'})).toBeVisible();
});
test('unknown routes give a navigable not-found state', async ({page}) => {
  await page.goto('/this-page-does-not-exist');
  await expect(page.getByRole('heading', {name:'This page does not exist'})).toBeVisible();
  await page.getByRole('link', {name:'Go to overview'}).click();
  await expect(page).toHaveURL('/');
});
for(const width of [320,390,768,1440]) {
  test(`setup layout fits a ${width}px viewport`, async ({page})=>{
    await page.setViewportSize({width,height:900}); await page.goto('/setup');
    await expect(page.getByRole('heading', {name:'No backend, no invented data'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  });
}
test('mobile navigation opens, navigates and closes', async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/setup');
  await page.getByRole('button', {name:'Open navigation',exact:true}).click();
  await expect(page.getByRole('button', {name:'Close navigation',exact:true})).toBeVisible();
  await page.locator('aside nav').getByRole('link', {name:'Projects',exact:true}).click();
  await expect(page).toHaveURL('/projects');
  await expect(page.getByRole('button', {name:'Close navigation',exact:true})).toHaveCount(0);
});
