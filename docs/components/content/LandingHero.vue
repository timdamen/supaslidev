<script setup lang="ts">
import { ref, onMounted } from 'vue';

const command = 'pnpm create supaslidev';
const copied = ref(false);

const videoRef = ref<HTMLVideoElement | null>(null);
const shouldLoadVideo = ref(false);

async function copyCommand() {
  await navigator.clipboard.writeText(command);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

onMounted(() => {
  if (!videoRef.value) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting) {
        shouldLoadVideo.value = true;
        observer.disconnect();
      }
    },
    { rootMargin: '200px' },
  );

  observer.observe(videoRef.value);
});
</script>

<template>
  <section class="hero">
    <div class="hero-bg">
      <div class="scanlines" />
      <div class="glow-orb glow-orb--teal" />
      <div class="glow-orb glow-orb--yellow" />
      <div class="grid-pattern" />
    </div>

    <div class="hero-content">
      <div class="logo-container">
        <div class="logo-glow" />
        <img src="/ssl-logo.png" alt="Supaslidev" class="hero-logo" />
        <div class="logo-ring" />
      </div>

      <h1 class="hero-title">Manage all your Slidev<br />presentations with ease</h1>

      <p class="hero-description">
        A unified workspace with a visual dashboard, powerful command palette, and seamless export
        workflows—focus on content, not configuration.
      </p>

      <div class="terminal-prompt" @click="copyCommand">
        <span class="prompt-char">$</span>
        <span class="command-text">{{ command }}</span>
        <button class="copy-btn" :class="{ 'copy-btn--copied': copied }">
          <UIcon v-if="copied" name="i-lucide-check" class="w-4 h-4" />
          <UIcon v-else name="i-lucide-copy" class="w-4 h-4" />
        </button>
      </div>

      <div class="hero-actions">
        <UButton to="/getting-started/introduction" size="xl" class="cta-btn cta-btn--primary">
          <template #leading>
            <span class="btn-prompt">$</span>
          </template>
          Get Started
        </UButton>
        <UButton
          to="https://demo.supasli.dev/"
          external
          variant="outline"
          size="xl"
          class="cta-btn"
        >
          <template #leading>
            <UIcon name="i-lucide-globe" />
          </template>
          Live Demo
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
          View on GitHub
        </UButton>
      </div>

      <div class="video-showcase">
        <div class="video-frame">
          <video
            ref="videoRef"
            class="demo-video"
            autoplay
            muted
            loop
            playsinline
            poster="/videos/demo-poster.jpg"
          >
            <source v-if="shouldLoadVideo" src="/videos/supaslidev-demo.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding: 6rem 2rem 4rem;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #f8fafb 0%, #f0f4f8 50%, #e8eef3 100%);
}

.dark .hero-bg {
  background: linear-gradient(135deg, #0a0f0d 0%, #0d1117 50%, #0a0a0a 100%);
}

.scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.03) 2px,
    rgba(0, 0, 0, 0.03) 4px
  );
  pointer-events: none;
  z-index: 10;
}

.dark .scanlines {
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.15) 2px,
    rgba(0, 0, 0, 0.15) 4px
  );
}

.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(150px);
  opacity: 0.2;
  animation: float 12s ease-in-out infinite;
}

.dark .glow-orb {
  opacity: 0.4;
}

.glow-orb--teal {
  width: 800px;
  height: 800px;
  background: radial-gradient(circle, #2ba4a9 0%, transparent 70%);
  top: -300px;
  right: -200px;
}

.glow-orb--yellow {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, #f5ca35 0%, transparent 70%);
  bottom: -200px;
  left: -150px;
  animation-delay: -6s;
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(40px, -40px) scale(1.05);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.95);
  }
}

.grid-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(43, 164, 169, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(43, 164, 169, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 70%);
}

.hero-content {
  position: relative;
  z-index: 20;
  text-align: center;
  max-width: 1100px;
  width: 100%;
}

.logo-container {
  position: relative;
  display: inline-block;
  margin-bottom: 1.5rem;
}

.hero-logo {
  width: 100px;
  height: 100px;
  animation: logoPulse 4s ease-in-out infinite;
  filter: drop-shadow(0 0 40px rgba(43, 164, 169, 0.6));
}

.logo-glow {
  position: absolute;
  inset: -30px;
  background: radial-gradient(circle, rgba(43, 164, 169, 0.3) 0%, transparent 70%);
  animation: glowPulse 3s ease-in-out infinite;
}

.logo-ring {
  position: absolute;
  inset: -20px;
  border: 2px solid transparent;
  border-radius: 50%;
  background: conic-gradient(
      from 0deg,
      transparent 0%,
      #2ba4a9 25%,
      #f5ca35 50%,
      #2ba4a9 75%,
      transparent 100%
    )
    border-box;
  -webkit-mask:
    linear-gradient(#fff 0 0) padding-box,
    linear-gradient(#fff 0 0);
  mask:
    linear-gradient(#fff 0 0) padding-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: ringRotate 8s linear infinite;
  opacity: 0.6;
}

@keyframes logoPulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes glowPulse {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.1);
  }
}

@keyframes ringRotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.hero-title {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: clamp(1.75rem, 5vw, 3.25rem);
  font-weight: 700;
  line-height: 1.1;
  margin-bottom: 1rem;
  background: linear-gradient(
    135deg,
    #1e7f82 0%,
    #2ba4a9 25%,
    #d4a82d 50%,
    #f5ca35 75%,
    #1e7f82 100%
  );
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradientFlow 8s ease infinite;
}

.dark .hero-title {
  background: linear-gradient(
    135deg,
    #2ba4a9 0%,
    #3fc1c1 25%,
    #f5ca35 50%,
    #ffdb5c 75%,
    #2ba4a9 100%
  );
  background-size: 300% 300%;
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: 0 0 80px rgba(43, 164, 169, 0.3);
}

@keyframes gradientFlow {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.hero-description {
  font-size: 1.125rem;
  color: #4b5563;
  max-width: 600px;
  margin: 0 auto 1.5rem;
  line-height: 1.6;
}

.dark .hero-description {
  color: #9ca3af;
}

.terminal-prompt {
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 1rem;
  margin-bottom: 1.5rem;
  padding: 0.875rem 1.25rem;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(43, 164, 169, 0.3);
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.dark .terminal-prompt {
  background: rgba(0, 0, 0, 0.4);
  box-shadow: none;
}

.terminal-prompt:hover {
  border-color: rgba(43, 164, 169, 0.5);
  background: rgba(255, 255, 255, 0.95);
}

.dark .terminal-prompt:hover {
  background: rgba(0, 0, 0, 0.5);
}

.prompt-char {
  color: #f5ca35;
}

.command-text {
  color: #1f2937;
}

.dark .command-text {
  color: #e6edf3;
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(43, 164, 169, 0.1);
  border: 1px solid rgba(43, 164, 169, 0.3);
  border-radius: 4px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: 0.5rem;
}

.dark .copy-btn {
  color: #9ca3af;
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

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 3rem;
}

.cta-btn {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 600;
  transition: all 0.3s ease;
}

.cta-btn--primary {
  background: linear-gradient(135deg, #2ba4a9 0%, #3ab8b8 100%);
  border: none;
  box-shadow: 0 0 30px rgba(43, 164, 169, 0.4);
}

.cta-btn--primary:hover {
  box-shadow: 0 0 50px rgba(43, 164, 169, 0.6);
  transform: translateY(-2px);
}

.btn-prompt {
  color: #f5ca35;
  opacity: 0.8;
}

.video-showcase {
  position: relative;
  max-width: 900px;
  margin: 0 auto;
}

.video-frame {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(43, 164, 169, 0.25);
  background: #f8fafb;
  box-shadow:
    0 0 40px rgba(43, 164, 169, 0.1),
    0 20px 40px -12px rgba(0, 0, 0, 0.15);
}

.dark .video-frame {
  background: #0d1117;
  box-shadow:
    0 0 40px rgba(43, 164, 169, 0.15),
    0 20px 40px -12px rgba(0, 0, 0, 0.4);
}

.demo-video {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  display: block;
}

@media (max-width: 768px) {
  .hero {
    padding: 4rem 1rem 2rem;
  }

  .hero-logo {
    width: 80px;
    height: 80px;
  }

  .terminal-prompt {
    font-size: 0.75rem;
    padding: 0.625rem 0.875rem;
  }

  .hero-description {
    font-size: 1rem;
  }

  .hero-actions {
    margin-bottom: 2rem;
  }

  .browser-content {
    aspect-ratio: 16 / 9;
  }
}
</style>
