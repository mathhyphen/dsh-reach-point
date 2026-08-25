# Open a real conversation, capture full page + hover preview, report rail geometry.
import sys, os, json
from playwright.sync_api import sync_playwright

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    pg = ctx.new_page()
    pg.goto('http://127.0.0.1:3080/', wait_until='domcontentloaded', timeout=30000)
    pg.wait_for_timeout(5000)
    pg.evaluate("""() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
        let cur
        while ((cur = walker.nextNode())) {
            const t = (cur.textContent||'').trim()
            if (t === '进行中' || t === 'In progress') {
                let list = cur.parentElement && cur.parentElement.parentElement
                if (!list) return null
                const rows = [...list.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.textContent||'').trim().length > 4)
                const target = rows.find(r => r.textContent.length < 60)
                if (target) { target.click(); return target.textContent.trim() }
            }
        }
        return null
    }""")
    pg.wait_for_timeout(6000)
    pg.screenshot(path=os.path.join(out, 'rail-full.png'))
    # rail geometry
    rail = pg.query_selector('.dsh-reach-point-rail, .reach-point-rail')
    box = rail.bounding_box() if rail else None
    print('rail box:', json.dumps(box))
    # hover middle tick
    ticks = pg.query_selector_all('.dsh-reach-point-tick, .reach-point-tick, [data-rp-unloaded]')
    print('ticks:', len(ticks))
    if ticks:
        mid = ticks[len(ticks)//2]
        mid.hover()
        pg.wait_for_timeout(900)
        pg.screenshot(path=os.path.join(out, 'rail-hover.png'))
        print('hovered tick index', len(ticks)//2)
    # also capture with a smaller conversation scale for the rail focus shot later
    b.close()
print('done')
