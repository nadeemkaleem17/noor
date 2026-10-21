# 10.11 — API: Customer accounts

| Field | Value |
|---|---|
| ID | DOC-10.11 |
| Title | Customer accounts (register, sign in, orders, leave) |
| Status | Built 2026-10-21 (owner: "Registration date ... yes, add them") |
| Depends on | DOC-10.0, DOC-10.3 (orders, public), DOC-11 (security) |

Guest checkout stays; an account is optional. Tables `customer_accounts`, `customer_sessions`, `account_orders` (migration `0029`), written only by `modules/accounts`. The `customers` row (one per phone) is not changed by registering.

## 1. The rules

1. **Identity is the mobile number** (normalised to `+92...`) and a password of 8 to 128 characters (not on the common list; `RELAXED_PASSWORDS` only in local development). Argon2id like staff passwords.
2. **Registering does not give the orders of that number.** There is no phone check yet (no SMS gateway is required to run the shop), so an account only sees an order it was *linked to*: placed while signed in (the storefront adds it by its link right after the order exists), or added by the person with the order number and the mobile number (the same proof as "Track your order"). Registering someone else's number therefore shows nothing of theirs, and registering does not rename the customer. If a number was registered by someone who does not own it, staff remove the account (Customers, the customer's page) and the owner can register.
3. **Sessions** are 32 random bytes, kept as SHA-256, 30 days, one per sign-in; they travel as header `X-Customer-Session` from the storefront server (cookie `nc_session`, HttpOnly, SameSite Lax). A changed password ends every other session. Expired ones are deleted nightly (job `accounts.cleanup`).
4. **Sign-in answers one thing** for a wrong password, an unknown number and a malformed number, takes the same time (a dummy hash), and is limited by address (20 per 15 minutes) and by number (8 per 15 minutes), both stored in the database.
5. **A sign-in is the one reliable link between a browser and a person**: `register` and `login` take the browser's visitor number, and its visits become the customer's (the same rule as an order link: a browser stays with the first customer it was linked to).
6. **Leaving** (`account.delete`, password asked) removes the password, the sessions and the list of orders; the customer, the orders and notes stay as the shop's records. Anonymising a customer in the admin removes the account too.

## 2. Routes

| Key | Method & path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `account.register` | `POST /account/register` | public; bucket `accountRegister` (10 per hour per address) | B: `{ name, phone, password, email?, visitor? }` | 201 `{ token, expiresAt, account }` | `password_too_weak` (`reason`), `account_exists`, `validation_failed` |
| `account.login` | `POST /account/login` | public; bucket `accountLogin` | B: `{ phone, password, visitor? }` | 200 `{ token, expiresAt, account }` | `invalid_credentials`, `rate_limited` |
| `account.logout` | `POST /account/logout` | customer session | — | 204 | — |
| `account.me` | `GET /account` | customer session | — | 200 `AccountMe` (name, masked phone, email?, registeredAt) | `unauthenticated` |
| `account.update` | `PUT /account` | customer session | B: `{ name, email? }` | 200 `AccountMe` | — |
| `account.changePassword` | `POST /account/password` | customer session | B: `{ currentPassword, newPassword }` | 204 | `invalid_credentials`, `password_too_weak` |
| `account.delete` | `POST /account/delete` | customer session | B: `{ password }` | 204 | `invalid_credentials` |
| `account.orders` | `GET /account/orders` | customer session | — | 200 `{ items: AccountOrder[] }` (number, date, total, status, `trackingToken` for the order page) | — |
| `account.claimOrder` | `POST /account/orders/claim` | customer session | B: `{ order }` (the order's link token) | 200 `{ orderNumber }` | `not_found` (not this number's, or not an order: one answer) |
| `admin.customers.removeAccount` | `POST /admin/customers/:id/remove-account` | `customers:write` | — | 204; audited `customer.account_removed` (security) | `not_found` (no account) |

`auth: 'customer'` is a route flag like `cart` and `order-token`: the response is never cached; the handler reads the session header.

## 3. In the admin

The Customers list has the **Email** under the name, a **Registered** column ("Guest" for a customer who only ordered) and a **Registered only** filter (`registered=1`). The customer's page has **Account on the shop** (registered, last signed in, **Remove the account**) or says the customer orders as a guest. "Customer since" stays the date of the first order.
