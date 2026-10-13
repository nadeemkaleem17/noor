// The drafted texts of the pages every shop needs (plan/06-storefront/08-cms-pages.md section 3, README A-09). Numbers and contact details come from settings
// through tokens, so a fee changed in the admin changes these pages without a content edit. They say only what this shop's software does (cash on delivery,
// a phone call to confirm, cancel before dispatch, a tracking link). They are drafts, not legal advice: the owner reads every word before launch (DOC-16 LAUNCH-10).

/** @type {{ slug: string, title: string, locked: boolean, bodyMd: string }[]} */
export const requiredPages = [
  {
    slug: 'shipping-returns',
    title: 'Shipping & returns',
    locked: true,
    bodyMd: `## Delivery

We deliver across Pakistan. Orders are dispatched within 1–2 working days and usually arrive in 3–7 days, depending on your city. Checkout shows the delivery time and the fee for your city before you order.

Delivery from {{shipping.fee}}. Orders over {{shipping.freeAbove}} are delivered free.

## Paying

Payment is **cash on delivery**: you pay the rider when the parcel arrives. We call you to confirm every order before it is dispatched, so please check that the number you gave us is the one you answer.

Very large orders, and orders from a number that has refused parcels before, may need payment in advance. We tell you before we dispatch.

## Following your order

After you order, we give you a link to your order page. You can also look it up at any time, with your order number and mobile number: [track your order](/track).

## Made-to-order pieces

Bridal and made-to-order pieces are cut for you, so their delivery time is longer. It is shown on the product page, together with the deposit we ask for to start the order. They cannot be returned.

## Returns

You can return an unworn, unwashed item with its tags within {{returns.days}} days of delivery.

**We cannot take back:** cut unstitched fabric, made-to-order pieces, sale items and anything worn, washed or altered.

If an item arrives damaged, or is not what you ordered, call or message us the same day and send a picture. We will replace it or refund it, and we pay for the return.

## How to return

Call or message us on {{store.phone}} (WhatsApp {{store.whatsapp}}) with your order number. We will arrange the pickup. Once the item reaches us and we have checked it, we refund the price of the item (not the delivery fee, unless the item was our mistake) by bank transfer or mobile wallet.`,
  },
  {
    slug: 'privacy',
    title: 'Privacy policy',
    locked: true,
    bodyMd: `## What we collect

When you order we ask for your name, mobile number and delivery address, and, if you choose, your email. If you write a review we keep what you write and any picture you add. We keep your order history so we can support you.

We do not use advertising or tracking services on this site. Your browser keeps two small cookies that the shop needs to work: one remembers your cart, the other your wishlist. We measure how fast our pages load, without knowing who you are, so that we can fix slow ones.

## Why we use it

To confirm your order by phone, deliver it, tell you where it is, handle a return, and keep a record of what we sold. We also use order history to spot fake orders and parcels that are repeatedly refused.

## Who sees it

Our team, and the courier who delivers your parcel (your name, number and address, and what you owe). The companies that host this site and send our messages handle data on our behalf and only for that. We do not sell your details, and we do not give them to anyone for advertising.

## How we protect it

Only staff who need it can see customer details, and a person who does not need your phone number sees it with the middle hidden. Staff accounts are protected by a password, and the accounts that can see everything by a second step as well. Every change a staff member makes is recorded.

## How long we keep it

We keep order records for as long as the law and our accounts require. If you ask us to remove your details, we replace your name, number, address and notes on your orders with placeholders; the amounts and dates stay, because our accounts need them.

## Your choices

You can ask us to correct or delete your details, or to stop contacting you. Write to {{store.email}} or call {{store.phone}}.

## Children

The shop is for adults. We do not knowingly collect details from children.

## Changes

If we change this policy we change this page.`,
  },
  {
    slug: 'terms',
    title: 'Terms of service',
    locked: true,
    bodyMd: `## Using this site

By placing an order you agree to these terms and to our [shipping and returns](/pages/shipping-returns) policy and [privacy policy](/pages/privacy).

## Prices and availability

Prices are in Pakistani rupees and include all taxes. Delivery is extra unless the page says it is free, and its fee is shown before you order. If an item sells out while you shop, we tell you before your order is placed. Colours and fabrics can look a little different on a screen than in your hands.

## Orders

An order is confirmed when we have spoken to you by phone. We may cancel an order we cannot confirm, an order that looks fake, or one for an item we find we cannot supply; if so we tell you.

## Cancellation

You can cancel before your order is dispatched, on your order page, by calling {{store.phone}} or by message on WhatsApp. After dispatch, please refuse nothing you ordered: use the returns process instead.

## Cash on delivery

Please accept the parcel you ordered. Repeated refusals at the door may mean we ask for payment in advance on later orders, or stop taking cash-on-delivery orders from that number.

## Delivery

The delivery times we give are estimates, not promises. A courier delay, a strike, weather or an address we cannot find can make a parcel late; we will help you follow it up. A wrong or incomplete address is the customer's responsibility.

## Made-to-order pieces

A made-to-order piece is made from the measurements you give. We start when the deposit shown on the product page is received. Because it is made for you, it cannot be cancelled once cutting starts, and it cannot be returned.

## Our responsibility

We stand behind what we sell: see the returns policy for damaged or wrong items. Beyond that, and as far as the law allows, we are not responsible for loss that could not reasonably be foreseen, and our responsibility for any order is limited to what you paid for it.

## Our content

The pictures, text and designs on this site belong to us or are used with permission. Please do not copy them for sale or for another shop.

## The law

These terms are governed by the laws of Pakistan, and the courts of Pakistan decide any dispute we cannot settle between us.

## Changes

We may change these terms. The terms in force when you place an order are the ones that apply to it.

## Questions

Call {{store.phone}} or write to {{store.email}}.`,
  },
  {
    slug: 'contact',
    title: 'Contact us',
    locked: true,
    bodyMd: `Call {{store.phone}}, message us on WhatsApp {{store.whatsapp}} or write to {{store.email}}.

{{store.address}}

We usually reply within a few hours, every day except public holidays.

If your question is about an order, have your order number ready, or [look it up](/track) first.`,
  },
  {
    slug: 'about',
    title: 'About us',
    locked: false,
    bodyMd: `Rubaya is a Pakistani fashion label. We make clothes for the way women dress here: lawn for the summer, khaddar for winter, and something beautiful for every wedding.

Everything we sell is described honestly, priced in rupees, and delivered to your door.`,
  },
]
