<template>
  <div>
    <div class="head">
      <h1 class="mi-section-title">首页</h1>
      <p class="mi-muted">实时掌握点位与填报概况</p>
    </div>

    <el-row :gutter="16" class="stats">
      <el-col :xs="12" :sm="6" v-for="item in statCards" :key="item.label">
        <div class="mi-card stat">
          <div class="mi-muted">{{ item.label }}</div>
          <div class="mi-stat-num">{{ item.value }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mt">
      <el-col :md="14" :xs="24">
        <div class="mi-card panel">
          <h3>近 7 日填报趋势</h3>
          <ClientOnly>
            <VChart class="chart" :option="chartOption" autoresize />
          </ClientOnly>
        </div>
      </el-col>
      <el-col :md="10" :xs="24">
        <div class="mi-card panel">
          <h3>最近动态</h3>
          <el-timeline v-if="activities.length">
            <el-timeline-item
              v-for="a in activities"
              :key="a.id"
              :timestamp="a.time"
              placement="top"
              color="#FF6900"
            >
              {{ a.text }}
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无动态" :image-size="72" />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
} from "echarts/components";
import VChart from "vue-echarts";

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent]);

definePageMeta({ layout: "admin", middleware: "admin" });

const { adminRequest } = useApi();
const stats = ref({
  totalPoints: 0,
  activePoints: 0,
  todaySubmissions: 0,
  totalSubmissions: 0,
});
const trend = ref<{ day: string; count: number }[]>([]);
const activities = ref<any[]>([]);

const statCards = computed(() => [
  { label: "点位总数", value: stats.value.totalPoints },
  { label: "启用点位", value: stats.value.activePoints },
  { label: "今日填报", value: stats.value.todaySubmissions },
  { label: "累计填报", value: stats.value.totalSubmissions },
]);

const chartOption = computed(() => ({
  color: ["#FF6900"],
  grid: { left: 36, right: 16, top: 24, bottom: 28 },
  tooltip: { trigger: "axis" },
  xAxis: {
    type: "category",
    data: trend.value.map((t) => t.day),
    axisLine: { lineStyle: { color: "#e5e5e5" } },
    axisLabel: { color: "#8a8a8a" },
  },
  yAxis: {
    type: "value",
    splitLine: { lineStyle: { color: "#f0f0f0" } },
    axisLabel: { color: "#8a8a8a" },
  },
  series: [
    {
      type: "line",
      smooth: true,
      areaStyle: { color: "rgba(255,105,0,0.12)" },
      data: trend.value.map((t) => t.count),
    },
  ],
}));

onMounted(async () => {
  try {
    const data = await adminRequest<any>("/api/admin/dashboard");
    stats.value = data.stats;
    trend.value = data.trend || [];
    activities.value = data.activities || [];
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
  }
});
</script>

<style scoped>
.head {
  margin-bottom: 20px;
}
.stats .stat {
  padding: 18px 20px;
  margin-bottom: 16px;
}
.mt {
  margin-top: 4px;
}
.panel {
  padding: 18px 20px;
  margin-bottom: 16px;
  min-height: 320px;
}
.panel h3 {
  margin: 0 0 12px;
  font-size: 15px;
}
.chart {
  height: 260px;
  width: 100%;
}
</style>
