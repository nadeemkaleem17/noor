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

## Fees and times by area

{{shipping.table}}

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

We do not use advertising or tracking services on this site. Your browser keeps a few small cookies that the shop needs to work: one remembers your cart, one your wishlist, and, if you make an account, one keeps you signed in. We measure how fast our pages load, without knowing who you are, so that we can fix slow ones.

If you accept, we also count how often a browser comes back to the shop, using one random number in a cookie. It holds no name, address or browser details, and nothing is counted unless you accept (you can change your choice at the foot of any page). If you then place an order or sign in, the visits of that browser are shown to our team next to your orders.

If you make an account, we keep your name, mobile number and a scrambled form of your password (never the password itself), and your email if you give one. You can delete the account yourself from your account page; the records of orders you placed stay as described below.

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

Everything we sell is described honestly, priced in rupees, and delivered to your door.

## How an order is made and sent

Most pieces are in stock and leave us within 1–2 working days. Bridal and made-to-order pieces are cut for you: the product page says how long they take and what deposit starts the order. Before anything is dispatched we call or message you on the number you gave us, so you always know what is coming.

## Where we are

{{store.address}}

Call {{store.phone}}, message us on WhatsApp {{store.whatsapp}} or write to {{store.email}}.

## What we promise

Payment is cash on delivery. You can return an unworn item within {{returns.days}} days ([how](/pages/shipping-returns)). If something is wrong, tell us the same day and we make it right.`,
  },
  {
    slug: 'faq',
    title: 'Questions and answers',
    locked: false,
    bodyMd: `## Ordering

### How do I order?
Choose a piece, choose your size, add it to your bag and check out. You do not need an account. We ask for your name, mobile number, city and address.

### Why do you call me after I order?
We confirm every order by phone or WhatsApp before dispatch, so a wrong number or address is found before the parcel leaves. Please keep your phone on.

### Can I change or cancel my order?
Yes, until it is dispatched. Open your order page from the link we gave you, or [look it up](/track) with your order number and mobile number.

## Paying and delivery

### How do I pay?
Cash on delivery: you pay the rider when the parcel arrives. Very large orders may need a deposit; we tell you before we dispatch.

### How much is delivery and how long does it take?
It depends on your city; checkout shows the fee and the days before you order. Orders over {{shipping.freeAbove}} are delivered free. The full list is on the [shipping page](/pages/shipping-returns).

### How do I follow my parcel?
Once it is dispatched your order page shows the courier and the tracking number with a link to the courier's page.

## Sizes

### How do I choose a size?
Each stitched piece has a size guide next to the sizes, with garment measurements and how to measure. If you are between two sizes, we suggest the larger one for lawn and the smaller for stretch fabric; message us on WhatsApp and we will help.

### Can you make a piece to my measurements?
Made-to-order pieces ask for your measurements on the product page. They take longer and cannot be returned.

## Returns

### Can I return something?
Unworn, unwashed items with their tags can be returned within {{returns.days}} days of delivery. Cut fabric, made-to-order pieces and sale items cannot. See [shipping and returns](/pages/shipping-returns).

## Care

### How do I wash my clothes?
See the [fabric and care guide](/pages/care).`,
  },
  {
    slug: 'care',
    title: 'Fabric and care',
    locked: false,
    bodyMd: `Care labels on the garment come first. These are the rules we follow for the fabrics we sell.

## Lawn and cotton

Wash in cool water with a mild soap, turn printed pieces inside out and dry them in the shade. Iron on the reverse at a medium heat. Wash dark colours alone the first time.

## Khaddar

Wash gently in cool water; hot water can shrink it. Do not wring. Dry flat or in the shade and iron while it is still slightly damp.

## Chiffon and organza

Dry clean, or hand wash very gently in cold water with a mild liquid soap. Never twist. Steam rather than iron, and keep away from rough surfaces that can snag it.

## Silk and embroidered pieces

Dry clean only. Store hung, in a cotton cover, with the embroidery not pressed against anything. Perfume and deodorant go on before you dress, not after.

## Bridal and heavy embroidery

Dry clean only, and only by someone who has handled embroidery. Fold in tissue, never in plastic.

## Fabric that is not stitched

Unstitched fabric is cut for you by your tailor. Wash and dry a small corner first; if it shrinks, pre-wash the whole piece before it is cut.`,
  },
]
