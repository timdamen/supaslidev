<script setup lang="ts">
defineProps<{
  colors: readonly { name: string; value: string }[];
  modelValue: string | undefined;
  name: string;
  label: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <fieldset
    class="flex items-center gap-4 rounded-xl w-fit p-2 -m-2 has-[input:focus-visible]:outline-[0.375rem] has-[input:focus-visible]:outline-double has-[input:focus-visible]:outline-primary has-[input:focus-visible]:shadow-[0_0_0_0.25rem_white]"
  >
    <legend class="sr-only">{{ label }}</legend>
    <label
      v-for="color in colors"
      :key="color.name"
      class="size-6 rounded-full cursor-pointer transition-transform duration-150 hover:scale-110 has-checked:outline-2 has-checked:outline-black dark:has-checked:outline-white has-checked:outline-offset-2"
      :style="{ backgroundColor: color.value }"
      :title="color.name"
    >
      <input
        type="radio"
        :name="name"
        class="sr-only"
        :checked="modelValue === color.name"
        :aria-label="color.name"
        :value="color.name"
        @change="emit('update:modelValue', color.name)"
      />
    </label>
  </fieldset>
</template>
