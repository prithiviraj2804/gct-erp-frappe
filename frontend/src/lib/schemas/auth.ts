import { z } from 'zod'

export const LOGIN_ERRORS = {
  USR_REQUIRED: 'Enter your email or username.',
  PWD_REQUIRED: 'Enter your password.',
} as const

/**
 * Deliberately NOT `.email()`. Frappe's `usr` resolves through `User.find_by_credentials`,
 * which accepts a username as well as an email — and `Administrator` is a username, so
 * requiring an email would lock the primary account out of its own login page.
 */
export const loginSchema = z.object({
  usr: z.string().trim().min(1, LOGIN_ERRORS.USR_REQUIRED),
  pwd: z.string().min(1, LOGIN_ERRORS.PWD_REQUIRED),
})

export type LoginValues = z.infer<typeof loginSchema>
