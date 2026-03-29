const ACCENT_COLORS = ['blue', 'green', 'red', 'orange', 'teal', 'indigo', 'violet'] as const;
const NEUTRAL_COLORS = ['slate', 'gray', 'zinc', 'neutral', 'stone'] as const;

type AccentColor = (typeof ACCENT_COLORS)[number];
type NeutralColor = (typeof NEUTRAL_COLORS)[number];

interface AppSettings {
  accentColor: AccentColor;
  neutralColor: NeutralColor;
}

const STORAGE_KEY = 'supaslidev-settings';

const DEFAULT_SETTINGS: AppSettings = {
  accentColor: 'teal',
  neutralColor: 'stone',
};

function loadSettings(): AppSettings {
  if (import.meta.server) return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        accentColor:
          parsed.accentColor && ACCENT_COLORS.includes(parsed.accentColor as AccentColor)
            ? (parsed.accentColor as AccentColor)
            : DEFAULT_SETTINGS.accentColor,
        neutralColor:
          parsed.neutralColor && NEUTRAL_COLORS.includes(parsed.neutralColor as NeutralColor)
            ? (parsed.neutralColor as NeutralColor)
            : DEFAULT_SETTINGS.neutralColor,
      };
    }
  } catch {
    // Ignore localStorage errors
  }
  return { ...DEFAULT_SETTINGS };
}

const _settings = ref<AppSettings>(loadSettings());
let watcherInitialized = false;

function useSettings() {
  if (!watcherInitialized) {
    watcherInitialized = true;
    watch(
      _settings,
      (value) => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        } catch (error) {
          console.error(`Failed to persist settings to "${STORAGE_KEY}":`, error, value);
        }
        updateAppConfig({
          ui: { colors: { primary: value.accentColor, neutral: value.neutralColor } },
        });
      },
      { deep: true },
    );
  }

  // Apply on first use
  updateAppConfig({
    ui: {
      colors: {
        primary: _settings.value.accentColor,
        neutral: _settings.value.neutralColor,
      },
    },
  });

  return { settings: _settings };
}

export { ACCENT_COLORS, DEFAULT_SETTINGS, NEUTRAL_COLORS, useSettings };
export type { AccentColor, NeutralColor, AppSettings };
