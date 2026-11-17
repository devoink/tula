import { CONCURRENCY_MAX, CONCURRENCY_MIN } from '../../../shared/schema'
import type { Settings } from '../../../shared/types'
import { SegmentedControl } from '../components/SegmentedControl'
import { useApp } from '../store'

export function SettingsView() {
  const settings = useApp((state) => state.settings)
  const updateSettings = useApp((state) => state.updateSettings)

  function patch(next: Partial<Settings>) {
    void updateSettings(next)
  }

  return (
    <div className="settings">
      <section className="setting-row">
        <h2>外观</h2>
        <SegmentedControl
          label="外观"
          value={settings.theme}
          options={[
            { value: 'system', label: '跟随系统' },
            { value: 'light', label: '亮色' },
            { value: 'dark', label: '暗色' }
          ]}
          onChange={(theme) => patch({ theme })}
        />
      </section>

      <section className="setting-row">
        <h2>并行张数</h2>
        <div className="concurrency">
          <input
            className="slider"
            type="range"
            aria-label="并行张数"
            min={CONCURRENCY_MIN}
            max={CONCURRENCY_MAX}
            step={1}
            value={settings.concurrency}
            style={{ ['--fill' as string]: `${((settings.concurrency - CONCURRENCY_MIN) / (CONCURRENCY_MAX - CONCURRENCY_MIN)) * 100}%` }}
            onChange={(event) => patch({ concurrency: Number(event.target.value) })}
          />
          <span className="mono">{settings.concurrency} 张</span>
        </div>
      </section>
    </div>
  )
}
