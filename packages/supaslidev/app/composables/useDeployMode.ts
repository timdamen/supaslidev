export function useDeployMode() {
  const config = useRuntimeConfig();
  const deployMode = computed(() => !!config.public.deployMode);
  return { deployMode };
}
