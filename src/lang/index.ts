import { createI18n } from 'vue-i18n'
import type { I18n } from 'vue-i18n'

import type apache from './en/apache.json'
import type appLog from './en/appLog.json'
import type aside from './en/aside.json'
import type base from './en/base.json'
import type conf from './en/conf.json'
import type feedback from './en/feedback.json'
import type fork from './en/fork.json'
import type host from './en/host.json'
import type mailpit from './en/mailpit.json'
import type meilisearch from './en/meilisearch.json'
import type menu from './en/menu.json'
import type minio from './en/minio.json'
import type mysql from './en/mysql.json'
import type nginx from './en/nginx.json'
import type nodejs from './en/nodejs.json'
import type php from './en/php.json'
import type podman from './en/podman.json'
import type prompt from './en/prompt.json'
import type redis from './en/redis.json'
import type requestTimer from './en/requestTimer.json'
import type service from './en/service.json'
import type setup from './en/setup.json'
import type tokenGenerator from './en/token-generator.json'
import type tools from './en/tools.json'
import type toolType from './en/toolType.json'
import type tray from './en/tray.json'
import type update from './en/update.json'
import type util from './en/util.json'
import type versionmanager from './en/versionmanager.json'
import type rustfs from './en/rustfs.json'
import type mkcert from './en/mkcert.json'
import type flutter from './en/flutter.json'
import type cron from './en/cron.json'
import type common from './en/common.json'

type AppendStringToKeys<T extends object, Prefix extends string = ''> = {
  [K in keyof T]: K extends string
    ? T[K] extends object
      ? AppendStringToKeys<T[K], `${Prefix}.${K}`>
      : `${Prefix}.${K}`
    : K extends number
      ? T extends readonly any[]
        ? `${Prefix}.${K}`
        : never
      : never
}[keyof T]

type LangKey =
  | AppendStringToKeys<typeof common, 'common'>
  | AppendStringToKeys<typeof apache, 'apache'>
  | AppendStringToKeys<typeof appLog, 'appLog'>
  | AppendStringToKeys<typeof aside, 'aside'>
  | AppendStringToKeys<typeof base, 'base'>
  | AppendStringToKeys<typeof conf, 'conf'>
  | AppendStringToKeys<typeof feedback, 'feedback'>
  | AppendStringToKeys<typeof fork, 'fork'>
  | AppendStringToKeys<typeof host, 'host'>
| AppendStringToKeys<typeof mailpit, 'mailpit'>
  | AppendStringToKeys<typeof meilisearch, 'meilisearch'>
  | AppendStringToKeys<typeof menu, 'menu'>
  | AppendStringToKeys<typeof minio, 'minio'>
  | AppendStringToKeys<typeof mysql, 'mysql'>
  | AppendStringToKeys<typeof nginx, 'nginx'>
  | AppendStringToKeys<typeof nodejs, 'nodejs'>
  | AppendStringToKeys<typeof php, 'php'>
  | AppendStringToKeys<typeof podman, 'podman'>
  | AppendStringToKeys<typeof prompt, 'prompt'>
  | AppendStringToKeys<typeof redis, 'redis'>
  | AppendStringToKeys<typeof requestTimer, 'requestTimer'>
  | AppendStringToKeys<typeof service, 'service'>
  | AppendStringToKeys<typeof setup, 'setup'>
  | AppendStringToKeys<typeof tokenGenerator, 'token-generator'>
  | AppendStringToKeys<typeof tools, 'tools'>
  | AppendStringToKeys<typeof toolType, 'toolType'>
  | AppendStringToKeys<typeof tray, 'tray'>
  | AppendStringToKeys<typeof update, 'update'>
  | AppendStringToKeys<typeof util, 'util'>
  | AppendStringToKeys<typeof versionmanager, 'versionmanager'>
  | AppendStringToKeys<typeof rustfs, 'rustfs'>
  | AppendStringToKeys<typeof mkcert, 'mkcert'>
  | AppendStringToKeys<typeof flutter, 'flutter'>
  | AppendStringToKeys<typeof cron, 'cron'>

import EN from './en/index'

const lang = { ...EN }

export const AppAllLang: Record<string, string> = {
  en: 'English'
}

let i18n: I18n
export const AppI18n = (l?: string): I18n => {
  if (!i18n) {
    i18n = createI18n({
      locale: l || 'en',
      fallbackLocale: 'en',
      messages: lang as any
    })
  }
  if (l) {
    i18n.global.locale = l
  }
  return i18n
}

export const I18nT = (key: LangKey | string, ...args: any) => {
  const t: any = i18n.global.t
  return t(key, ...args)
}
