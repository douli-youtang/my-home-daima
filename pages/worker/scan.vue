<template>
  <div class="page">
    <div class="scanner mi-card">
      <div id="worker-qr-reader" class="reader" />
      <div v-if="starting" class="overlay">正在启动摄像头...</div>
    </div>

    <p :class="error ? 'err' : 'hint'">
      {{ error || "将二维码置于框内即可自动识别" }}
    </p>

    <div class="mi-card manual">
      <p class="title">手动输入点位编码</p>
      <el-input v-model="manual" placeholder="如 qr_test_001" clearable />
      <el-button
        type="primary"
        class="mi-press go"
        :disabled="!manual.trim()"
        @click="goWithScene(manual)"
      >
        进入填写
      </el-button>
    </div>

    <el-button text type="primary" @click="router.push('/worker')">返回我的工单</el-button>
  </div>
</template>

<script setup lang="ts">
import { Html5Qrcode } from "html5-qrcode";
import { extractSceneFromScanText } from "~/lib/scan-scene";

definePageMeta({
  layout: "worker",
  middleware: "worker",
  title: "扫码填写",
});

const SCANNER_ID = "worker-qr-reader";
const router = useRouter();
const { getStoredSession } = useSession();

const scannerRef = shallowRef<Html5Qrcode | null>(null);
const handled = ref(false);
const error = ref("");
const manual = ref("");
const starting = ref(true);

async function stopScanner() {
  const scanner = scannerRef.value;
  scannerRef.value = null;
  if (!scanner) return;
  try {
    await scanner.stop();
    scanner.clear();
  } catch {
    /* ignore */
  }
}

function goWithScene(raw: string) {
  const scene = extractSceneFromScanText(raw);
  if (!scene) {
    error.value = "请输入有效的点位编码或扫码链接";
    return;
  }
  handled.value = true;
  void stopScanner().finally(() => {
    router.replace(`/scan?scene=${encodeURIComponent(scene)}`);
  });
}

let cancelled = false;

onMounted(() => {
  const session = getStoredSession();
  if (!session || session.role !== "worker") {
    router.replace("/worker/login");
    return;
  }

  async function start() {
    starting.value = true;
    error.value = "";
    try {
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.value = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (handled.value || cancelled) return;
          const scene = extractSceneFromScanText(decoded);
          if (!scene) {
            error.value = "无法识别点位码，请对准工单二维码";
            return;
          }
          handled.value = true;
          void scanner
            .stop()
            .catch(() => undefined)
            .finally(() => {
              router.replace(`/scan?scene=${encodeURIComponent(scene)}`);
            });
        },
        () => undefined
      );
    } catch (err: any) {
      if (!cancelled) {
        error.value = err?.message
          ? `无法打开摄像头：${err.message}`
          : "无法打开摄像头，请使用下方手动输入";
      }
    } finally {
      if (!cancelled) starting.value = false;
    }
  }

  start();
});

onBeforeUnmount(() => {
  cancelled = true;
  void stopScanner();
});
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: stretch;
}
.scanner {
  position: relative;
  overflow: hidden;
  background: #000;
  min-height: 280px;
}
.reader {
  min-height: 280px;
  width: 100%;
}
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 14px;
}
.hint,
.err {
  margin: 0;
  text-align: center;
  font-size: 12px;
}
.hint {
  color: #8a8a8a;
}
.err {
  color: #f56c6c;
}
.manual {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.go {
  width: 100%;
  height: 42px;
}
</style>
