import { Button } from "@/components/ui/button"
import Icon from "@/components/ui/icon"
import { InstallButton } from "@/components/install-button"

// ⬇️ Укажите здесь ссылки на готовые установщики (например, релизы на GitHub).
// Пока ссылка пустая — кнопка ведёт к инструкции по сборке.
const WINDOWS_EXE_URL = ""
const ANDROID_APK_URL = ""

const BUILD_GUIDE_URL =
  "https://github.com/" // замените на ссылку на ваш репозиторий / страницу релизов

export function DownloadApps() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-red-500/20">
      <h2 className="font-orbitron text-2xl font-bold text-white mb-2 flex items-center gap-3">
        <Icon name="Download" className="text-red-500" size={24} />
        Скачать приложение
      </h2>
      <p className="font-geist text-muted-foreground mb-6 max-w-2xl">
        Установите приложение на компьютер или телефон — иконка на рабочем столе,
        запуск в отдельном окне, работа без интернета.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Windows */}
        <div className="bg-card border border-red-500/20 rounded-lg p-5 flex flex-col">
          <Icon name="Monitor" className="text-red-500 mb-3" size={28} />
          <h3 className="font-geist text-white font-semibold mb-1">Windows (.exe)</h3>
          <p className="font-geist text-sm text-muted-foreground mb-4 flex-1">
            Установщик для ПК. Скачайте и запустите — ярлык появится на рабочем столе.
          </p>
          <Button
            asChild
            className="bg-red-500 hover:bg-red-600 text-white w-full"
          >
            <a href={WINDOWS_EXE_URL || BUILD_GUIDE_URL} target="_blank" rel="noopener noreferrer">
              <Icon name="Download" size={16} className="mr-2" />
              {WINDOWS_EXE_URL ? "Скачать для Windows" : "Где взять .exe"}
            </a>
          </Button>
        </div>

        {/* Android */}
        <div className="bg-card border border-red-500/20 rounded-lg p-5 flex flex-col">
          <Icon name="Smartphone" className="text-red-500 mb-3" size={28} />
          <h3 className="font-geist text-white font-semibold mb-1">Android (.apk)</h3>
          <p className="font-geist text-sm text-muted-foreground mb-4 flex-1">
            Установочный файл для телефона и планшета на Android.
          </p>
          <Button
            asChild
            className="bg-red-500 hover:bg-red-600 text-white w-full"
          >
            <a href={ANDROID_APK_URL || BUILD_GUIDE_URL} target="_blank" rel="noopener noreferrer">
              <Icon name="Download" size={16} className="mr-2" />
              {ANDROID_APK_URL ? "Скачать для Android" : "Где взять .apk"}
            </a>
          </Button>
        </div>

        {/* PWA */}
        <div className="bg-card border border-red-500/20 rounded-lg p-5 flex flex-col">
          <Icon name="Globe" className="text-red-500 mb-3" size={28} />
          <h3 className="font-geist text-white font-semibold mb-1">Из браузера (PWA)</h3>
          <p className="font-geist text-sm text-muted-foreground mb-4 flex-1">
            Установка прямо со страницы, без скачивания файла. Работает офлайн.
          </p>
          <InstallButton className="w-full h-10 px-4 text-sm" />
          <p className="font-geist text-xs text-muted-foreground mt-2">
            Кнопка появится, если браузер поддерживает установку. На iPhone:
            «Поделиться» → «На экран Домой».
          </p>
        </div>
      </div>
    </section>
  )
}

export default DownloadApps
