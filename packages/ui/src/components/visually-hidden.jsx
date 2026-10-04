
/**
 * Text for screen readers only.
 * @param {import('react').ComponentProps<'span'>} props
 */
export function VisuallyHidden(props) {
  return <span className="sr-only" {...props} />
}
