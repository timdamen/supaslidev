<script setup lang="ts">
import { ref } from 'vue';

const copied = ref(false);
const command = 'pnpm create supaslidev';

async function copyCommand() {
  await navigator.clipboard.writeText(command);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}
</script>

<template>
  <section class="cta">
    <div class="cta-content">
      <div class="cta-badge">
        <span class="badge-dot" />
        Ready to present
      </div>

      <h2 class="cta-title">Start managing your<br />Slidev presentations in seconds</h2>

      <div class="install-box">
        <div class="install-terminal">
          <span class="install-prompt">$</span>
          <code class="install-command">{{ command }}</code>
          <button class="copy-btn" :class="{ 'copy-btn--copied': copied }" @click="copyCommand">
            <UIcon v-if="copied" name="i-lucide-check" class="w-4 h-4" />
            <UIcon v-else name="i-lucide-copy" class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="cta-actions">
        <UButton to="/getting-started/introduction" size="xl" class="cta-btn cta-btn--primary">
          Read the Docs
          <template #trailing>
            <UIcon name="i-lucide-arrow-right" />
          </template>
        </UButton>
        <UButton
          to="https://github.com/timdamen/supaSliDev"
          external
          variant="outline"
          size="xl"
          class="cta-btn"
        >
          <template #leading>
            <UIcon name="i-simple-icons-github" />
          </template>
          Star on GitHub
        </UButton>
      </div>
    </div>

    <div class="cta-decoration">
      <img src="/ssl-logo.png" class="floating-logo" />
      <div class="decoration-ring decoration-ring--1" />
      <div class="decoration-ring decoration-ring--2" />
    </div>
  </section>
</template>

<style scoped>
.cta {
  padding: 8rem 2rem;
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, var(--ui-bg) 0%, transparent 15%, transparent 85%, var(--ui-bg) 100%),
    radial-gradient(ellipse 80% 50% at 50% 50%, rgba(43, 164, 169, 0.08) 0%, transparent 70%);
}

.cta::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(43, 164, 169, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(43, 164, 169, 0.02) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse 60% 40% at 50% 50%, black 20%, transparent 70%);
  pointer-events: none;
}

.cta-content {
  position: relative;
  z-index: 10;
  text-align: center;
  max-width: 700px;
  margin: 0 auto;
}

.cta-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: #27c93f;
  background: rgba(39, 201, 63, 0.1);
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  border: 1px solid rgba(39, 201, 63, 0.2);
  margin-bottom: 2rem;
}

.badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #27c93f;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.9);
  }
}

.cta-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  color: var(--ui-text);
  line-height: 1.2;
  margin-bottom: 2.5rem;
}

.install-box {
  margin-bottom: 2.5rem;
}

.install-terminal {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 1rem;
  background: var(--ui-bg);
  border: 1px solid var(--supaslidev-border);
  padding: 1rem 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.install-prompt {
  color: #f5ca35;
}

.install-command {
  color: var(--ui-text);
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--supaslidev-header-bg);
  border: 1px solid var(--supaslidev-border);
  border-radius: 6px;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-btn:hover {
  border-color: #2ba4a9;
  color: #2ba4a9;
}

.copy-btn--copied {
  border-color: #27c93f;
  color: #27c93f;
  background: rgba(39, 201, 63, 0.1);
}

.cta-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.cta-btn {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
}

.cta-btn--primary {
  background: linear-gradient(135deg, #2ba4a9 0%, #3ab8b8 100%);
  border: none;
}

.cta-decoration {
  position: absolute;
  right: 5%;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.floating-logo {
  width: 200px;
  height: 200px;
  opacity: 0.1;
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-20px) rotate(5deg);
  }
}

.decoration-ring {
  position: absolute;
  border: 1px solid rgba(43, 164, 169, 0.1);
  border-radius: 50%;
}

.decoration-ring--1 {
  width: 300px;
  height: 300px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: ringPulse 4s ease-in-out infinite;
}

.decoration-ring--2 {
  width: 400px;
  height: 400px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: ringPulse 4s ease-in-out infinite 1s;
}

@keyframes ringPulse {
  0%,
  100% {
    opacity: 0.3;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(1.1);
  }
}

@media (max-width: 1024px) {
  .cta-decoration {
    display: none;
  }
}

@media (max-width: 640px) {
  .install-terminal {
    font-size: 0.75rem;
    padding: 0.75rem 1rem;
  }
}
</style>
