export function getLogoProps(variant: 'header' | 'footer' = 'header') {
  return {
    size: variant === 'header' ? 'md' : ('lg' as 'md' | 'lg'),
  }
}
