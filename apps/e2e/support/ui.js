// A choice chip (a size, a colour) hides its input and draws the label: a person presses the drawn part, so a journey does too.
/** @param {import('@playwright/test').Locator} input */
export const pressChip = (input) => input.locator('xpath=ancestor::label[1]').locator('span').first().click()
