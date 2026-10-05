// How the query cache tells the app that the session ended ('unauthenticated') or that a screen asked for more than the user may do ('forbidden').
export const sessionEvents = new EventTarget()
