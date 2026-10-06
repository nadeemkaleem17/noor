// M4-08: the words of the messages. No database. Every customer text stays short and carries no address or full phone number (plan/12-integrations.md sections 4.4 and 10).
import { describe, expect, it } from 'vitest'
import { htmlOf, render } from '../src/modules/notifications/templates.js'

const vars = {
  store: 'Rubaya', name: 'Ayesha', orderNo: 'RB-10458', total: 'Rs 7,240', link: 'https://rubaya.pk/orders/pQ7abcdefghijklmnopqrstuvwxyz0123456789ABC', city: 'Lahore',
  items: 'Embroidered Lawn 3-Piece, Chiffon Dupatta, Silk Kurta +2 more', eta: '9 Oct to 11 Oct', leadDays: '14', courier: 'TCS', tracking: '7788', amountDue: 'Rs 7,240',
  account: 'Rubaya, HBL, PK00HABB0000000000', method: 'cod', adminLink: 'https://admin.rubaya.pk/orders/0192f5aa',
}
const customerTemplates = ['placed', 'confirm_request', 'confirmed', 'confirmed_mto', 'dispatched', 'delivered', 'cancelled', 'returned', 'bank_details'].map((t) => `order.${t}`)

describe('message texts', () => {
  it.each(customerTemplates)('%s fills every variable, stays under 600 characters, and holds no address or phone', (id) => {
    const text = render('en', id, vars)
    expect(text.length).toBeLessThan(600)
    expect(text).not.toMatch(/[{}]/) // nothing left unfilled
    expect(text).not.toMatch(/\b0?3\d{2}[\s-]?\d{7}\b|\+92/) // no phone number
    expect(text).toContain('RB-10458')
  })

  it('the words are the ones of the plan', () => {
    expect(render('en', 'order.placed', vars)).toBe('Hi Ayesha, we received your order RB-10458 for Rs 7,240. We will contact you shortly to confirm it. Track it here: ' + vars.link)
    expect(render('en', 'order.confirmed_mto', vars)).toBe('Thank you Ayesha. Order RB-10458 is confirmed. Your piece will be made in about 14 days. ' + vars.link)
    expect(render('en', 'staff.new_order.subject', vars)).toBe('New order RB-10458 (Rs 7,240)')
  })

  it('a dispatch says the tracking number and the cash to keep ready only when there are some', () => {
    expect(render('en', 'order.dispatched', vars)).toBe(`Order RB-10458 is on its way with TCS, tracking no. 7788. Please keep Rs 7,240 ready for the rider. ${vars.link}`)
    expect(render('en', 'order.dispatched', { ...vars, tracking: 'none', amountDue: 'none' })).toBe(`Order RB-10458 is on its way with TCS. ${vars.link}`)
  })

  it('a locale without its own text says it in English; an unknown template is an error, not the key', () => {
    expect(render('ur', 'order.cancelled', vars)).toBe(render('en', 'order.cancelled', vars))
    expect(() => render('en', 'order.nosuch', vars)).toThrow('no notification text')
  })

  it('the email version escapes the text and links the address', () => {
    expect(htmlOf('Hi <b>"Sana" & co</b>\nSee https://rubaya.pk/orders/abc')).toBe('<p>Hi &lt;b&gt;&quot;Sana&quot; &amp; co&lt;/b&gt;<br>See <a href="https://rubaya.pk/orders/abc">https://rubaya.pk/orders/abc</a></p>')
  })
})
