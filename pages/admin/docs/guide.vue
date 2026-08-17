<template>
  <div class="wrap">
    <div class="head">
      <h1 class="mi-section-title">系统说明</h1>
      <p class="mi-muted">业务使用说明与角色权限概览（持续完善中）</p>
    </div>

    <section class="mi-card section">
      <h2>系统是做什么的</h2>
      <p>
        一码多面扫码填表系统：为每个物理点位生成二维码，作业人员扫码登录后填写动态表单并上传现场照片；管理员在
        PC 后台管理点位、模板、用户与数据记录。
      </p>
    </section>

    <section class="mi-card section">
      <h2>角色说明</h2>
      <ul>
        <li>
          <strong>作业人员</strong>
          ：扫码填表、查看/修改本人工单（受次数与时间窗口限制）
        </li>
        <li>
          <strong>维护员</strong>
          ：可登录管理后台，查看点位与数据记录（部分高危操作不可用）
        </li>
        <li>
          <strong>管理员</strong>
          ：完整后台权限，含用户、系统设置、模板配置等
        </li>
      </ul>
    </section>

    <section class="mi-card section">
      <h2>关键规则（当前默认）</h2>
      <ul class="disc">
        <li>同一二维码在占用窗口内仅允许一条有效填报（可在系统设置调整）</li>
        <li>提交后可在可改窗口内修改，且有次数上限（可在系统设置调整）</li>
        <li>管理后台登录入口仅管理员/维护员可用，作业人员请扫码进入</li>
      </ul>
    </section>

    <div class="mi-card tip">
      需要对接接口？请查看
      <NuxtLink to="/admin/docs/api">接口文档</NuxtLink>
      ，含完整路径、鉴权、参数与 cURL 示例。
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin" });
</script>

<style scoped>
.wrap {
  max-width: 720px;
}
.head {
  margin-bottom: 16px;
}
.section {
  padding: 18px 20px;
  margin-bottom: 14px;
}
.section h2 {
  margin: 0 0 10px;
  font-size: 15px;
}
.section p,
.section li {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--mi-ink-2);
}
.section ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}
.section ul.disc {
  padding-left: 18px;
  list-style: disc;
}
.tip {
  padding: 16px 18px;
  font-size: 14px;
  color: var(--mi-orange-pressed);
  background: var(--mi-orange-soft);
  border: 1px dashed var(--mi-orange-border);
}
.tip a {
  font-weight: 600;
  text-decoration: underline;
}
</style>
