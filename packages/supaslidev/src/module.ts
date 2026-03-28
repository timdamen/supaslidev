import { type NuxtModule, defineNuxtModule } from '@nuxt/kit';

const module: NuxtModule = defineNuxtModule({
  meta: {
    name: 'supaslidev',
    configKey: 'supaslidev',
  },
  setup() {
    // Runtime config is handled via nuxt.config.ts and env vars
    // This module is a placeholder for future supaslidev-specific setup
  },
});

export default module;
