<template>
  <UApp>
    <div class="min-h-screen bg-default flex flex-col">
      <UContainer class="py-6 sm:py-8 lg:py-10 flex-1">
        <slot />
      </UContainer>

      <footer class="footer">
        <p class="footer-text">
          Built on
          <a href="https://sli.dev" target="_blank" rel="noopener" class="footer-link">Sli.dev</a>
          by
          <a href="https://github.com/antfu" target="_blank" rel="noopener" class="footer-link"
            >Anthony Fu</a
          >, Created with ❤️ by
          <a href="https://github.com/timdamen" target="_blank" rel="noopener" class="footer-link"
            >Tim Damen</a
          >
          in 🇳🇱
        </p>
      </footer>
    </div>
  </UApp>
</template>

<style scoped>
.footer {
  margin-top: auto;
  padding: 2rem 0;
  text-align: center;
}

.footer-text {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
}

.footer-link {
  color: var(--ui-primary);
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.footer-link:hover {
  opacity: 0.8;
  text-decoration: underline;
}
</style>
