export function useLLM() {
  const models = [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4.1',
  ]
  const model = useCookie<string>('llm-model', { default: () => 'gpt-4o-mini' })

  return {
    models,
    model
  }
}
