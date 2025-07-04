export function useLLM() {
  const models = [
    'gpt-4.1-mini',
    'gpt-4.1',
    'gpt-4o',
    'gpt-4o-mini',
  ]
  const model = useCookie<string>('llm-model', { default: () => 'gpt-4.1' })

  return {
    models,
    model
  }
}
