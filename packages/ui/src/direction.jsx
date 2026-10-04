// Apps wrap their tree in this so Base UI popups, menus and tabs follow the page direction (ADR-0007, RTL spike M0-11).
// It changes component behaviour only: the app must still set `dir` on <html>.
export { DirectionProvider } from '@base-ui/react/direction-provider'
