<template>
  <div class="docs">
    <div class="hero mi-card">
      <p class="eyebrow">Developer Docs</p>
      <h1 class="mi-section-title hero-title">接口文档</h1>
      <p class="hero-desc">
        扫码填表系统完整 HTTP API。统一返回
        <code>{ code, data, msg }</code>
        ，其中 <code>code === 0</code> 表示成功。当前共
        <strong>{{ total }}</strong> 个接口。
      </p>
      <div class="hero-grid">
        <div class="hero-cell">
          <p class="mi-muted">后台鉴权</p>
          <p>Header x-openid</p>
        </div>
        <div class="hero-cell">
          <p class="mi-muted">作业端鉴权</p>
          <p>openid 或 x-openid</p>
        </div>
        <div class="hero-cell">
          <p class="mi-muted">Base URL</p>
          <p class="truncate">{{ baseUrl }}</p>
        </div>
      </div>
    </div>

    <el-row :gutter="16" class="quick">
      <el-col :lg="12" :xs="24">
        <section class="mi-card block">
          <h2>30 秒上手</h2>
          <ol>
            <li>
              <span>1.</span>调用 <code>POST /api/login</code> 拿到 openid / role
            </li>
            <li>
              <span>2.</span>后台接口在 Header 带上 <code>x-openid: &lt;openid&gt;</code>
            </li>
            <li>
              <span>3.</span>判断响应 <code>code === 0</code>，业务数据在 <code>data</code>
            </li>
            <li>
              <span>4.</span>扫码填表：先 <code>/api/qrcode/{scene}</code>，再查占用、提交
            </li>
          </ol>
        </section>
      </el-col>
      <el-col :lg="12" :xs="24">
        <section class="mi-card block">
          <h2>统一响应格式</h2>
          <div class="resp-grid">
            <div>
              <p class="ok">成功</p>
              <pre class="code">{{ JSON.stringify(COMMON_RESPONSE.success, null, 2) }}</pre>
            </div>
            <div>
              <p class="fail">失败</p>
              <pre class="code">{{ JSON.stringify(COMMON_RESPONSE.fail, null, 2) }}</pre>
            </div>
          </div>
        </section>
      </el-col>
    </el-row>

    <div class="toolbar mi-card">
      <div class="toolbar-row">
        <el-input
          v-model="query"
          clearable
          placeholder="搜索路径、方法、标题…"
          class="search"
        />
        <el-button @click="expandAll">全部展开</el-button>
        <el-button @click="collapseAll">全部收起</el-button>
        <span class="mi-muted">显示 {{ flatCount }} / {{ total }}</span>
      </div>
      <div class="cats">
        <button
          type="button"
          class="cat"
          :class="{ active: activeCat === 'all' }"
          @click="activeCat = 'all'"
        >
          全部
        </button>
        <button
          v-for="cat in API_DOC_CATEGORIES"
          :key="cat.id"
          type="button"
          class="cat"
          :class="{ active: activeCat === cat.id }"
          @click="activeCat = cat.id"
        >
          {{ cat.title }}
          <span>({{ cat.endpoints.length }})</span>
        </button>
      </div>
    </div>

    <div class="legend">
      <div v-for="(meta, key) in AUTH_LABELS" :key="key" class="legend-item">
        <span class="auth" :class="authClass(key as AuthKind)">{{ meta.label }}</span>
        <span class="mi-muted">{{ meta.tip }}</span>
      </div>
    </div>

    <div v-if="filtered.length === 0" class="mi-card empty">
      没有匹配的接口，试试其他关键词
    </div>

    <section
      v-for="cat in filtered"
      :id="`cat-${cat.id}`"
      :key="cat.id"
      class="cat-section"
    >
      <div class="cat-head">
        <h2>{{ cat.title }}</h2>
        <p class="mi-muted">{{ cat.description }}</p>
      </div>

      <article
        v-for="ep in cat.endpoints"
        :id="ep.id"
        :key="ep.id"
        class="mi-card ep"
        :class="{ open: openIds.has(ep.id), deprecated: ep.deprecated }"
      >
        <button type="button" class="ep-head" @click="toggle(ep.id)">
          <span class="method" :class="methodClass(ep.method)">{{ ep.method }}</span>
          <div class="ep-meta">
            <div class="ep-top">
              <code>{{ ep.path }}</code>
              <el-tag v-if="ep.deprecated" size="small" type="info" round>已废弃</el-tag>
              <span class="auth" :class="authClass(ep.auth)">{{ AUTH_LABELS[ep.auth].label }}</span>
            </div>
            <p class="ep-title">{{ ep.title }}</p>
            <p class="mi-muted">{{ ep.summary }}</p>
          </div>
          <span class="toggle">{{ openIds.has(ep.id) ? "收起" : "展开" }}</span>
        </button>

        <div v-if="openIds.has(ep.id)" class="ep-body">
          <div class="copy-row">
            <el-button size="small" @click="copyText(ep.path)">复制路径</el-button>
            <el-button size="small" type="primary" @click="copyText(curlOf(ep))">
              复制 cURL
            </el-button>
          </div>

          <div class="auth-tip">
            <strong>鉴权：</strong>{{ AUTH_LABELS[ep.auth].tip }}
          </div>

          <div v-if="ep.params?.length" class="block-inner">
            <h4>参数</h4>
            <el-table :data="ep.params" size="small" stripe>
              <el-table-column prop="name" label="名称" min-width="100" />
              <el-table-column prop="in" label="位置" width="80" />
              <el-table-column prop="type" label="类型" width="90" />
              <el-table-column label="必填" width="70">
                <template #default="{ row }">
                  <span :class="row.required ? 'req' : 'mi-muted'">
                    {{ row.required ? "是" : "否" }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="说明" min-width="160" />
            </el-table>
          </div>

          <div v-if="ep.bodyExample !== undefined" class="block-inner">
            <h4>请求示例</h4>
            <div class="code-wrap">
              <el-button class="copy-btn" size="small" @click="copyText(JSON.stringify(ep.bodyExample, null, 2))">
                复制
              </el-button>
              <pre class="code">{{ JSON.stringify(ep.bodyExample, null, 2) }}</pre>
            </div>
          </div>

          <div v-if="ep.responseExample !== undefined" class="block-inner">
            <h4>响应示例</h4>
            <div class="code-wrap">
              <el-button class="copy-btn" size="small" @click="copyText(JSON.stringify(ep.responseExample, null, 2))">
                复制
              </el-button>
              <pre class="code">{{ JSON.stringify(ep.responseExample, null, 2) }}</pre>
            </div>
          </div>

          <div class="block-inner">
            <h4>cURL</h4>
            <div class="code-wrap">
              <el-button class="copy-btn" size="small" @click="copyText(curlOf(ep))">复制</el-button>
              <pre class="code">{{ curlOf(ep) }}</pre>
            </div>
          </div>

          <ul v-if="ep.notes?.length" class="notes">
            <li v-for="n in ep.notes" :key="n">· {{ n }}</li>
          </ul>

          <div v-if="ep.errors?.length" class="block-inner">
            <h4>常见错误</h4>
            <ul class="errors">
              <li v-for="(e, i) in ep.errors" :key="`${e.msg}-${i}`">
                <span v-if="e.status" class="http">HTTP {{ e.status }}</span>
                <span class="err-msg">{{ e.msg }}</span>
              </li>
            </ul>
          </div>
        </div>
      </article>
    </section>

    <p class="footer mi-muted">文档随系统接口维护。对接问题请联系系统管理员。</p>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import {
  API_DOC_CATEGORIES,
  AUTH_LABELS,
  COMMON_RESPONSE,
  buildCurl,
  countEndpoints,
  type ApiEndpoint,
  type AuthKind,
  type HttpMethod,
} from "~/lib/api-docs-data";

definePageMeta({ layout: "admin", middleware: "admin" });

const query = ref("");
const activeCat = ref("all");
const openIds = ref<Set<string>>(new Set());
const total = countEndpoints();
const baseUrl = ref("https://YOUR_HOST");

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return API_DOC_CATEGORIES.map((cat) => {
    if (activeCat.value !== "all" && cat.id !== activeCat.value) {
      return { ...cat, endpoints: [] as ApiEndpoint[] };
    }
    const endpoints = cat.endpoints.filter((ep) => {
      if (!q) return true;
      const hay = `${ep.method} ${ep.path} ${ep.title} ${ep.summary}`.toLowerCase();
      return hay.includes(q);
    });
    return { ...cat, endpoints };
  }).filter((c) => c.endpoints.length > 0);
});

const flatCount = computed(() =>
  filtered.value.reduce((n, c) => n + c.endpoints.length, 0)
);

onMounted(() => {
  baseUrl.value = window.location.origin;
  const hash = window.location.hash.replace("#", "");
  if (!hash) return;
  openIds.value = new Set([hash]);
  nextTick(() => {
    document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

function toggle(id: string) {
  const next = new Set(openIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  openIds.value = next;
}

function expandAll() {
  openIds.value = new Set(filtered.value.flatMap((c) => c.endpoints.map((e) => e.id)));
}

function collapseAll() {
  openIds.value = new Set();
}

function curlOf(ep: ApiEndpoint) {
  return buildCurl(ep.method, ep.path, {
    openid:
      ep.auth === "admin" || ep.auth === "adminOnly" || ep.auth === "openid"
        ? "YOUR_OPENID"
        : undefined,
    body: ep.bodyExample,
    form: ep.params?.some((p) => p.in === "form"),
  });
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success("已复制");
  } catch {
    ElMessage.error("复制失败");
  }
}

function methodClass(method: HttpMethod) {
  return {
    get: method === "GET",
    post: method === "POST",
    put: method === "PUT",
    del: method === "DELETE",
  };
}

function authClass(auth: AuthKind) {
  return {
    none: auth === "none",
    openid: auth === "openid",
    admin: auth === "admin",
    adminOnly: auth === "adminOnly",
    body: auth === "bodyIdentity",
  };
}
</script>

<style scoped>
.docs {
  max-width: 1100px;
}
.hero {
  padding: 22px 24px;
  margin-bottom: 16px;
  background:
    radial-gradient(900px 400px at 0% 0%, rgba(255, 105, 0, 0.16), transparent 55%),
    linear-gradient(180deg, #fff 0%, #fffaf6 100%);
}
.eyebrow {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--mi-orange);
  font-weight: 650;
}
.hero-title {
  margin-top: 8px;
  font-size: 1.6rem;
}
.hero-desc {
  margin: 10px 0 0;
  max-width: 720px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--mi-ink-2);
}
.hero-desc code {
  background: rgba(255, 105, 0, 0.08);
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--mi-orange-pressed);
}
.hero-grid {
  display: grid;
  gap: 10px;
  margin-top: 18px;
  grid-template-columns: 1fr;
}
@media (min-width: 640px) {
  .hero-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
.hero-cell {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--mi-orange-border);
  padding: 10px 12px;
}
.hero-cell p {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.hero-cell .mi-muted {
  font-weight: 500;
  margin-bottom: 4px;
}
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quick {
  margin-bottom: 8px;
}
.block {
  padding: 16px 18px;
  margin-bottom: 16px;
  min-height: 100%;
}
.block h2 {
  margin: 0 0 12px;
  font-size: 15px;
}
.block ol {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}
.block li {
  font-size: 13px;
  line-height: 1.6;
  color: var(--mi-ink-2);
}
.block li span {
  color: var(--mi-orange);
  font-weight: 700;
  margin-right: 6px;
}
.block code {
  font-size: 12px;
  background: #f5f5f5;
  padding: 1px 5px;
  border-radius: 5px;
}
.resp-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: 1fr;
}
@media (min-width: 640px) {
  .resp-grid {
    grid-template-columns: 1fr 1fr;
  }
}
.ok {
  margin: 0 0 6px;
  font-size: 12px;
  color: #16a34a;
}
.fail {
  margin: 0 0 6px;
  font-size: 12px;
  color: #e11d48;
}
.code {
  margin: 0;
  overflow-x: auto;
  border-radius: 12px;
  background: #1a1a1a;
  color: #f5f5f5;
  padding: 12px 14px;
  font-size: 12px;
  line-height: 1.55;
}
.toolbar {
  position: sticky;
  top: 64px;
  z-index: 5;
  padding: 12px 14px;
  margin-bottom: 14px;
  backdrop-filter: blur(8px);
}
.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.search {
  flex: 1;
  min-width: 220px;
}
.cats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.cat {
  border: none;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  background: #f0f0f0;
  color: var(--mi-ink-2);
}
.cat.active {
  background: var(--mi-orange);
  color: #fff;
  font-weight: 600;
}
.cat span {
  opacity: 0.75;
  margin-left: 2px;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  margin-bottom: 18px;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.auth {
  display: inline-flex;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
}
.auth.none {
  background: #f0f0f0;
  color: #666;
}
.auth.openid {
  background: #fff4eb;
  color: #c2410c;
}
.auth.admin {
  background: #fff0e6;
  color: #ea580c;
}
.auth.adminOnly {
  background: #fee2e2;
  color: #dc2626;
}
.auth.body {
  background: #f5f5f5;
  color: #525252;
}
.empty {
  padding: 48px 16px;
  text-align: center;
  color: var(--mi-ink-3);
  font-size: 14px;
  border-style: dashed;
}
.cat-section {
  margin-bottom: 28px;
}
.cat-head {
  margin-bottom: 10px;
}
.cat-head h2 {
  margin: 0;
  font-size: 16px;
}
.ep {
  margin-bottom: 10px;
  overflow: hidden;
}
.ep.open {
  border-color: var(--mi-orange-border);
  box-shadow: var(--mi-shadow-hover);
}
.ep.deprecated {
  border-style: dashed;
  opacity: 0.85;
}
.ep-head {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  text-align: left;
  border: none;
  background: transparent;
  padding: 14px 16px;
  cursor: pointer;
}
.method {
  min-width: 3.6rem;
  text-align: center;
  border-radius: 8px;
  border: 1px solid;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.method.get {
  background: #ecfdf5;
  color: #047857;
  border-color: #a7f3d0;
}
.method.post {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}
.method.put {
  background: #fff7ed;
  color: #c2410c;
  border-color: #fed7aa;
}
.method.del {
  background: #fff1f2;
  color: #be123c;
  border-color: #fecdd3;
}
.ep-meta {
  flex: 1;
  min-width: 0;
}
.ep-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ep-top code {
  font-size: 13px;
  font-weight: 700;
  word-break: break-all;
}
.ep-title {
  margin: 6px 0 2px;
  font-size: 14px;
  font-weight: 600;
}
.toggle {
  font-size: 12px;
  color: var(--mi-ink-3);
  margin-top: 4px;
  flex-shrink: 0;
}
.ep-body {
  border-top: 1px solid #f0f0f0;
  padding: 14px 16px 16px;
  display: grid;
  gap: 14px;
}
.copy-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.auth-tip {
  border-radius: 12px;
  background: #fafafa;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--mi-ink-2);
}
.block-inner h4 {
  margin: 0 0 8px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--mi-ink-3);
}
.code-wrap {
  position: relative;
}
.copy-btn {
  position: absolute;
  right: 8px;
  top: 8px;
  z-index: 1;
}
.notes {
  margin: 0;
  padding: 10px 12px;
  list-style: none;
  border-radius: 12px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 12px;
  display: grid;
  gap: 4px;
}
.errors {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}
.errors li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.http {
  background: #f5f5f5;
  border-radius: 6px;
  padding: 2px 6px;
  font-family: ui-monospace, monospace;
  color: #737373;
}
.err-msg {
  color: #e11d48;
}
.req {
  color: #e11d48;
}
.footer {
  margin: 28px 0 8px;
  padding-top: 14px;
  border-top: 1px solid #eee;
  text-align: center;
}
</style>
