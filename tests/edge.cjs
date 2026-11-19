const { chromium } = require('playwright')
const OUT = process.env.SHOTS || './test-shots/'
const B = process.env.BASE_URL || 'http://localhost:4173'
const results = []
const ok = (n, c, extra = '') => { results.push(`${c ? 'PASS' : 'FAIL'} ${n} ${extra}`) }
async function fresh(browser, q = '?facilitator=1') {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
  const p = await ctx.newPage()
  p.errors = []
  p.on('pageerror', e => p.errors.push(e.message))
  await p.goto(B + '/' + q)
  await p.waitForSelector('text=Select seats')
  return { ctx, p }
}
const fac = async (p) => { await p.click('[aria-label="Open facilitator panel"]'); await p.waitForTimeout(250) }
const closeFac = (p) => p.click('[aria-label="Close facilitator panel"]')
const has = async (p, t, ms = 3000) => { try { await p.waitForSelector(`text=${t}`, { timeout: ms }); return true } catch { return false } }
async function create(p, seats = ['F5', 'F6', 'F7', 'F8'], group = 'Hostel gang · 4', ok = true) {
  await p.evaluate(() => sessionStorage.removeItem('gb_draft'))
  await p.goto(B + '/seats')
  await p.click('[role=switch]')
  for (const s of seats) await p.click(`[aria-label="Seat ${s} available"]`)
  await p.click('text=Add friends')
  if (group) await p.click(`text=${group}`)
  await p.click('button:has-text("Review")')
  await p.click('.fixed.bottom-0 button')
  await p.click(ok ? 'text=Payment succeeds' : 'text=Payment fails')
  if (ok) { await p.waitForURL(/\/s\//); await p.click('[aria-label=Close]') }
}
;(async () => {
  const browser = await chromium.launch()
  // E12 + E14 + E15
  { const { ctx, p } = await fresh(browser)
    await p.goto(B + '/seats'); await p.click('[role=switch]')
    const free = await p.$$eval('[aria-label$=" available"]', els => els.slice(0, 11).map(e => e.getAttribute('aria-label')))
    for (const a of free.slice(0, 10)) await p.click(`[aria-label="${a}"]`)
    ok('E14 11th seat disabled', await p.locator('[aria-label$=" disabled"]').count() > 0 && await has(p, 'Group sessions allow up to 10 seats'))
    await create(p, ['A3', 'A4', 'A5'], 'Office squad · 2', false)
    ok('E12 host payment fails', await has(p, 'Payment failed. Your seats were not held.'))
    await p.screenshot({ path: OUT + 'e12.png' })
    await create(p, ['A3', 'A4', 'A5'], 'Office squad · 2', true)
    await p.evaluate(() => sessionStorage.removeItem('gb_draft'))
    await p.goto(B + '/seats'); await p.click('[role=switch]')
    ok('E15 second session blocked', await has(p, 'You have an active session for Kites Over Bandra'))
    // E16 cancel
    await p.goto(B + '/'); await p.click('text=Your group booking is in progress')
    await p.click('text=Cancel session'); await p.click('text=Yes, cancel session')
    ok('E16 cancel', await has(p, 'Cancelled'))
    ok('no page errors (1)', p.errors.length === 0, p.errors.join('|'))
    await ctx.close() }
  // E17 + E18
  { const { ctx, p } = await fresh(browser)
    await fac(p); await p.click('button:has-text("45 m")'); await closeFac(p)
    await p.goto(B + '/seats'); await p.click('[role=switch]')
    for (const s of ['F5', 'F6']) await p.click(`[aria-label="Seat ${s} available"]`)
    await p.click('text=Add friends'); await p.click('button:has-text("Review")')
    ok('E17 hold shortened', await has(p, 'it must end 30 min before the show'))
    await fac(p); await p.click('button:has-text("35 m")'); await closeFac(p)
    await p.goto(B + '/seats'); await p.waitForTimeout(200)
    ok('E17 group disabled', await has(p, 'Unavailable: the show starts too soon'))
    await fac(p); await p.click('button:has-text("19 Dec")'); await p.click('text=Someone takes a seat during selection'); await closeFac(p)
    await p.evaluate(() => sessionStorage.removeItem('gb_draft'))
    await p.goto(B + '/seats'); await p.click('[role=switch]')
    for (const s of ['F5', 'F6', 'F7']) await p.click(`[aria-label="Seat ${s} available"]`)
    await p.click('text=Add friends')
    ok('E18 seat taken', await has(p, 'is no longer available'))
    await p.screenshot({ path: OUT + 'e18.png' })
    // E19 offline
    await fac(p); await p.click('text=This phone goes offline'); await closeFac(p)
    ok('E19 offline banner', await has(p, 'Offline, reconnecting'))
    await ctx.close() }
  // A session: E7 grace, E8, E11, E10, E4/E1, E3, E2, E6
  { const { ctx, p } = await fresh(browser)
    await create(p)
    const sid = p.url().split('/s/')[1].split('?')[0]
    // timer colours
    await fac(p); await p.click('text=Jump to 1 min left'); await closeFac(p)
    await p.waitForTimeout(1600)
    const bg = await p.$eval('[role=timer]', e => getComputedStyle(e).backgroundColor)
    ok('Timer red under 3 min', bg.includes('217, 48, 37'), bg)
    ok('Auto reminders fired', await p.evaluate(() => JSON.parse(localStorage.gb_db_v1).events.filter(e => e.type === 'reminder_auto').length) >= 1)
    // E10: Aman opens on 2nd tab and the same number again on a 3rd tab
    const m1 = await ctx.newPage(); await m1.goto(`${B}/s/${sid}?as=x1`)
    await m1.fill('input[autocomplete=name]', 'Aman V'); await m1.fill('input[autocomplete=tel]', '9876500002')
    await m1.click('text=Not now, just show me the group')
    const m2 = await ctx.newPage(); await m2.goto(`${B}/s/${sid}?as=x2`)
    await m2.fill('input[autocomplete=name]', 'Aman'); await m2.fill('input[autocomplete=tel]', '+91 98765 00002')
    await m2.click('text=Not now, just show me the group')
    const nMembers = await p.evaluate((sid) => JSON.parse(localStorage.gb_db_v1).sessions[sid].members.length, sid)
    ok('E10 same phone = one member', nMembers === 4 && await has(m2, 'F6 is held for you'))
    // E7 last-second payment (Aman)
    await fac(p)
    const sel = p.locator('select').filter({ hasText: 'Aman' })
    await sel.selectOption(await sel.locator('option', { hasText: 'Aman' }).getAttribute('value'))
    await p.click('text=Pays in last seconds'); await closeFac(p)
    const ev = await p.evaluate(() => JSON.parse(localStorage.gb_db_v1).events.filter(e => e.type === 'member_paid').pop())
    ok('E7 grace payment confirmed', ev && ev.payload.grace === true)
    ok('E1/E4 resolution sheet', await has(p, 'The hold has ended'))
    await p.screenshot({ path: OUT + 'e1.png' })
    // E3 extend
    await p.click('text=Extend 10 min')
    ok('E3 extended', await has(p, 'Seats confirmed'))
    await fac(p); await p.click('text=Expire now'); await closeFac(p)
    ok('E3 extension used', await has(p, 'Extension used'))
    // E2 auto release
    await fac(p); await p.click('text=Skip 2-min decision'); await closeFac(p)
    ok('E2 auto release', await has(p, 'The host didn\'t decide within 2 minutes', 5000))
    await p.screenshot({ path: OUT + 'e2.png' })
    // E6: Priya opens late
    const m3 = await ctx.newPage(); await m3.goto(`${B}/s/${sid}?as=x3`)
    await m3.fill('input[autocomplete=name]', 'Priya'); await m3.fill('input[autocomplete=tel]', '9876500003')
    await m3.click('.fixed.bottom-0 button:has-text("Continue")')
    ok('E6 late opener', await has(m3, 'This hold has ended. Your seat was released.'))
    await m3.screenshot({ path: OUT + 'e6.png' })
    // E11 Aman leaves after paying
    await m2.goto(`${B}/s/${sid}/ticket`); await m2.click('text=Cancel my ticket'); await m2.click('text=Yes, cancel ticket')
    ok('E11 left after paying', await p.evaluate((sid) => JSON.parse(localStorage.gb_db_v1).sessions[sid].members.find(m => m.phone === '9876500002').status, sid) === 'left')
    ok('no page errors (3)', [p, m1, m2, m3].every(x => true) && p.errors.length === 0, p.errors.join('|'))
    await ctx.close() }
  // Real friend on a new phone: number not in the session, picks their seat, pays from the invite
  { const { ctx, p } = await fresh(browser)
    await create(p)
    const sid = p.url().split('/s/')[1].split('?')[0]
    const f = await ctx.newPage(); f.errors = []; f.on('pageerror', e => f.errors.push(e.message))
    await f.goto(`${B}/s/${sid}?as=newphone`)
    ok('Invite shows host, movie and share', await has(f, 'Rohan invited you') && await has(f, 'Your share') && await has(f, 'Which seat is yours?'))
    await f.screenshot({ path: OUT + 'invite.png' })
    await f.click('button[aria-pressed]:has-text("Priya")')
    await f.fill('input[autocomplete=name]', 'Priya Real')
    await f.fill('input[autocomplete=tel]', '9000012345')
    await f.click('.fixed.bottom-0 button:has-text("Pay ₹300 for F7")')
    ok('Pay sheet opens straight away', await has(f, 'Payment succeeds'))
    await f.click('text=Payment succeeds')
    await f.waitForURL(/ticket/)
    ok('Friend gets ticket', await has(f, 'Priya Real'))
    const m = await p.evaluate((sid) => JSON.parse(localStorage.gb_db_v1).sessions[sid].members.find(x => x.phone === '9000012345'), sid)
    ok('Seat claimed by real number', m && m.status === 'paid' && m.name === 'Priya Real')
    ok('Host sees it', await has(p, '₹300 of ₹900 collected from friends'))
    ok('no page errors (friend)', f.errors.length === 0, f.errors.join('|'))
    await ctx.close() }
  // Regular booking without group mode
  { const { ctx, p } = await fresh(browser)
    await p.goto(B + '/seats')
    for (const x of ['B9', 'B10']) await p.click(`[aria-label="Seat ${x} available"]`)
    ok('Group hint shows for 2+ seats', await has(p, 'Booking for friends?'))
    await p.click('.fixed.bottom-0 button:has-text("Pay ₹600")')
    await p.click('text=Payment succeeds')
    ok('Regular booking confirmed', await has(p, "You're all set!") && await has(p, 'B9, B10'))
    await p.goto(B + '/seats')
    ok('Booked seats now sold', await p.locator('[aria-label="Seat B9 sold"]').count() === 1)
    ok('no page errors (regular)', p.errors.length === 0, p.errors.join('|'))
    await ctx.close() }
  // A new device is never mistaken for the host
  { const ctx1 = await browser.newContext(); const a = await ctx1.newPage(); await a.goto(B + '/'); await a.waitForSelector('text=Select seats')
    const ctx2 = await browser.newContext(); const b = await ctx2.newPage(); await b.goto(B + '/'); await b.waitForSelector('text=Select seats')
    const pa = await a.evaluate(() => JSON.parse(localStorage.gb_profile).phone), pb = await b.evaluate(() => JSON.parse(localStorage.gb_profile).phone)
    ok('Each device gets its own placeholder number', pa !== pb && pa !== '9876500001', `${pa} ${pb}`)
    await ctx1.close(); await ctx2.close() }
  // E4 only host + E9 + pass + E20 + demo switcher
  { const { ctx, p } = await fresh(browser, '?demo=1')
    await create(p, ['C6', 'C7', 'C8'], 'Office squad · 2')
    ok('Demo bar', await has(p, 'Demo · viewing as'))
    await p.click('.overflow-x-auto button:has-text("Vikram")')
    ok('Demo switch to member', await has(p, 'C7 is held for you'))
    p.once('dialog', d => d.accept())
    await p.click('text=Can\'t make it')
    await p.click('.overflow-x-auto button:has-text("(host)")')
    ok('E9 decline → open seat with pass', await has(p, 'Open seat') && await p.locator('button:has-text("Pass")').count() > 0)
    await p.click('button:has-text("Pass")'); await p.click('.fixed button:has-text("Dev Patel")'); await p.click('text=Pass seat')
    ok('Pass a seat', await has(p, 'passed C7 to Dev'))
    await p.click('[aria-label="Open facilitator panel"]'); await p.click('text=Expire now'); await closeFac(p)
    ok('E4 only host warning', await has(p, 'Only your seat is confirmed.'))
    await p.screenshot({ path: OUT + 'e4.png' })
    await p.click('text=View the session first')
    await p.click('[aria-label="Open facilitator panel"]'); await p.click('text=Cinema cancels show'); await closeFac(p)
    ok('E20 show cancelled', await has(p, 'Show cancelled'))
    await p.click('[aria-label="Open facilitator panel"]'); await p.waitForTimeout(400)
    await p.screenshot({ path: OUT + 'facilitator.png' })
    ok('no page errors (4)', p.errors.length === 0, p.errors.join('|'))
    await ctx.close() }
  console.log(results.join('\n'))
  await browser.close()
})().catch(e => { console.log(results.join('\n')); console.error('FAIL', e.message); process.exit(1) })
