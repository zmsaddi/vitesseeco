export function useLocalized(field: Record<string, string> | undefined | null): string {
  if (!field) return ''
  const { locale } = useI18n()
  return field[locale.value] || field.fr || ''
}

export function useLocalizedField() {
  const { locale } = useI18n()
  return (field: Record<string, string> | undefined | null): string => {
    if (!field) return ''
    return field[locale.value] || field.fr || ''
  }
}
