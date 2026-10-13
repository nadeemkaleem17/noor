/** The customer of the journeys: a Lahore address and a mobile number in the format people type. */
export const buyer = { name: 'Ayesha Khan', phone: '0321 7654321', address: 'House 12, Street 4, Gulberg III', city: 'Lahore' }

let counter = Math.floor(Math.random() * 900_000)
/** A mobile number nobody has used in this run: the API allows five orders from one number in ten minutes, so each journey that only needs "a customer" gets its own. */
export const uniquePhone = () => `0345 ${String(1_000_000 + counter++).slice(-7)}`
