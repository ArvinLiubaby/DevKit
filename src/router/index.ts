import { createRouter, createWebHistory } from "vue-router";
import { tools } from "../tools/registry";

/**
 * 路由骨架：懒加载（() => import(...)）保证工具模块按需加载。
 * 工具模块路由由注册表（tools/registry.ts）统一生成。
 */
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: () => import("../layouts/AppLayout.vue"),
      children: [
        { path: "", name: "home", component: () => import("../views/HomeView.vue") },
        { path: "about", name: "about", component: () => import("../views/AboutView.vue") },
        // 工具模块：注册表驱动，懒加载
        ...tools.map((t) => ({
          path: t.path,
          name: t.id,
          component: t.component,
        })),
      ],
    },
  ],
});

export default router;
