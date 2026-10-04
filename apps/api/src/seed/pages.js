// The drafted texts of the pages every shop needs (plan/06-storefront/08-cms-pages.md section 3, README A-09). Numbers come from settings
// through tokens, so a fee changed in the admin changes these pages without a content edit. Staff should read them before launch.

/** @type {{ slug: string, title: string, locked: boolean, bodyMd: string }[]} */
export const requiredPages = [
  {
    slug: 'shipping-returns',
    title: 'Shipping & returns',
    locked: true,
    bodyMd: `## Delivery

We deliver across Pakistan. Orders are dispatched within 1–2 working days and usually arrive in 3–7 days, depending on your city.

Delivery from {{shipping.fee}}. Orders over {{shipping.freeAbove}} are delivered free.

Payment is **cash on delivery**: you pay the rider when the parcel arrives. We call you to confirm every order before it is dispatched.

## Returns

You can return an unworn, unwashed item with its tags within {{returns.days}} days of delivery.

**We cannot take back:** cut unstitched fabric, made-to-order pieces, sale items and anything worn or altered.

## How to return

Call or message us on {{store.phone}} (WhatsApp {{store.whatsapp}}) with your order number. We will arrange the pickup and refund you once the item reaches us.`,
  },
  {
    slug: 'privacy',
    title: 'Privacy policy',
    locked: true,
    bodyMd: `## What we collect

When you order we ask for your name, phone number, delivery address and, if you choose, your email. We keep your order history so we can support you.

## Who sees it

Only our team and the courier who delivers your parcel. We do not sell your details. Payment providers, if we offer them later, receive only what they need to take a payment.

## Your choices

You can ask us to correct or delete your details. Write to {{store.email}} or call {{store.phone}}. We keep the minimum records the law requires for orders already placed.`,
  },
  {
    slug: 'terms',
    title: 'Terms of service',
    locked: true,
    bodyMd: `## Prices and availability

Prices are in Pakistani rupees and include everything except delivery, which is shown before you order. If an item sells out while you shop, we tell you before your order is placed.

## Orders

An order is confirmed when we have spoken to you by phone. We may cancel an order we cannot confirm.

## Cancellation

You can cancel before your order is dispatched. Call {{store.phone}} or message us on WhatsApp.

## Cash on delivery

Please accept the parcel you ordered. Repeated refusals at the door may mean we ask for payment in advance on later orders.`,
  },
  {
    slug: 'contact',
    title: 'Contact us',
    locked: true,
    bodyMd: `Call {{store.phone}}, message us on WhatsApp {{store.whatsapp}} or write to {{store.email}}.

{{store.address}}

We usually reply within a few hours, every day except public holidays.`,
  },
  {
    slug: 'about',
    title: 'About us',
    locked: false,
    bodyMd: `Rubaya is a Pakistani fashion label. We make clothes for the way women dress here: lawn for the summer, khaddar for winter, and something beautiful for every wedding.

Everything we sell is described honestly, priced in rupees, and delivered to your door.`,
  },
]
