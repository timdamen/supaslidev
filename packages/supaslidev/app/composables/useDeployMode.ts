export function useDeployMode() {
  const config = useRuntimeConfig();
  const deployMode = computed(() => !!config.public.deployMode);

  function showDeployDemoToast() {
    const toast = useToast();
    toast.add({
      title: 'Dev Mode Only',
      description:
        'This functionality is only available in dev mode. It is shown here for demo purposes.',
      color: 'warning',
      icon: 'i-lucide-info',
      duration: 0,
    });
  }

  return { deployMode, showDeployDemoToast };
}
