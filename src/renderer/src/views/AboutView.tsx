import { useEffect, useState } from 'react'
import logo from '../../../../resources/logo.png'
import { APP_NAME } from '../../../shared/appName'
import type { Appearance } from '../../../shared/types'

export function AboutView() {
  const [version, setVersion] = useState('')
  const [appearance, setAppearance] = useState<Appearance | null>(null)

  useEffect(() => {
    const desktop = window.desktop
    if (!desktop) return
    let alive = true
    void desktop.getBootstrap().then((data) => {
      if (!alive) return
      setVersion(data.version)
      setAppearance(data.appearance)
    }).catch(() => {})
    const off = desktop.onTheme(setAppearance)
    return () => {
      alive = false
      off()
    }
  }, [])

  useEffect(() => {
    if (appearance) document.documentElement.dataset.theme = appearance
  }, [appearance])

  return (
    <div className="about">
      <img src={logo} alt="" />
      <h1>{APP_NAME}</h1>
      <p className="about-version">{version ? `版本 ${version}` : '\u00a0'}</p>
      <p className="about-note">离线运行，图片不会上传</p>
    </div>
  )
}
